import { chromium } from 'playwright';

const BASE_URL = 'https://remotar.com.br';
// Categorias tech no filtro do site (descobertas via inspeção real, 2026-07-15):
// 4=Data Science/Analytics, 7=DevOps, 8=QA, 9=SysAdmin, 13=Programação, 14=Programação Mobile.
// Sem esse filtro a listagem traz TODAS as áreas (vendas, RH, jurídico etc. — ~650 vagas);
// filtrando na fonte já cai pra ~50 vagas relevantes, economizando resumo por IA à toa.
const SEARCH_URL = 'https://remotar.com.br/search/jobs?q=&c=4&c=7&c=13&c=14&c=8&c=9';
const GOTO_TIMEOUT_MS = 15000;
const DETAIL_CONCURRENCY = 6; // páginas de detalhe abertas em paralelo (lotes, não uma aba por vaga isolada)
const MAX_DETAIL_PAGES = 100; // limite defensivo (listagem filtrada por categoria já é bem menor que o site inteiro)
const MAX_SCROLL_ATTEMPTS = 40; // trava de segurança pro loop de scroll infinito
const SCROLL_STABLE_ROUNDS = 2; // quantas rodadas sem novos cards até considerar "carregou tudo"

let browserPromise = null;

// Instância única de browser, reaproveitada entre chamadas (lazy-initialized).
function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch();
  }
  return browserPromise;
}

async function gotoWithRetry(page, url, waitUntil = 'networkidle') {
  try {
    await page.goto(url, { waitUntil, timeout: GOTO_TIMEOUT_MS });
  } catch (err) {
    if (err.name !== 'TimeoutError' && !/Timeout/i.test(err.message)) throw err;
    // retry único em caso de timeout
    await page.goto(url, { waitUntil, timeout: GOTO_TIMEOUT_MS });
  }
}

// Extrai os cards da listagem principal.
// Estrutura confirmada via inspeção real (Playwright, page.evaluate) em 2026-07-06:
// cada vaga é um `.job-content-box` contendo:
//   - a.job-title  -> título + href relativo "/job/{id}/{company-slug}/{title-slug}"
//   - a.company    -> nome da empresa
//   - .tag-list a  -> badges (ex: "🤝🏽 PJ", "🌍 100% Remoto", "😎 Pleno")
// `.job-detail` dentro do card SEMPRE vem vazio na listagem (confirmado em 50 cards) —
// a descrição completa só existe na página de detalhe da vaga, dentro de `.job-info-box`.
async function extractListingCards(page) {
  return page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.job-content-box'));
    return cards
      .map(card => {
        const titleEl = card.querySelector('a.job-title');
        const companyEl = card.querySelector('a.company');
        const tagEls = Array.from(card.querySelectorAll('.tag-list a'));
        if (!titleEl) return null;
        const href = titleEl.getAttribute('href') || '';
        return {
          title: titleEl.textContent.trim(),
          href,
          company: companyEl ? companyEl.textContent.trim() : null,
          tags: tagEls.map(t => t.textContent.trim()).filter(Boolean),
        };
      })
      .filter(Boolean);
  });
}

// Extrai a descrição completa da página de detalhe.
// IMPORTANTE (descoberto via inspeção real com Playwright): a página tem MÚLTIPLOS elementos
// `.job-info-box` — o primeiro é o cabeçalho (título/badges, já capturado separadamente na
// listagem), e os seguintes contêm as seções reais: "Sobre", "Responsabilidades", "Requisitos",
// "Desejáveis", "Benefícios", "Outras Informações". Usar querySelectorAll e pular o primeiro.
// Usa 'domcontentloaded' (bem mais rápido que 'networkidle' nessa página — 'networkidle' chegou
// a estourar timeout de 15s em teste real, provavelmente por polling/analytics contínuo).
async function extractDetailDescription(browser, url) {
  const page = await browser.newPage();
  try {
    await gotoWithRetry(page, url, 'domcontentloaded');
    const readSections = () => page.evaluate(() => {
      const boxes = Array.from(document.querySelectorAll('.job-info-box'));
      return boxes.slice(1).map(b => b.innerText.trim()).filter(Boolean).join('\n\n');
    });
    let description = await readSections();
    if (!description) {
      await page.waitForSelector('.job-info-box', { timeout: 5000 }).catch(() => {});
      description = await readSections();
    }
    return description;
  } finally {
    await page.close();
  }
}

// A listagem carrega mais cards via scroll infinito (sem paginação por URL nem "carregar mais"
// visível) - vai scrollando até o número de cards parar de crescer por algumas rodadas seguidas.
async function scrollUntilStable(page) {
  let lastCount = -1;
  let stableRounds = 0;
  for (let i = 0; i < MAX_SCROLL_ATTEMPTS; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);
    const count = await page.evaluate(() => document.querySelectorAll('.job-content-box').length);
    if (count === lastCount) {
      stableRounds++;
      if (stableRounds >= SCROLL_STABLE_ROUNDS) break;
    } else {
      stableRounds = 0;
    }
    lastCount = count;
  }
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current], current);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function fetchJobs() {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    let cards;
    try {
      await gotoWithRetry(page, SEARCH_URL);
      await scrollUntilStable(page);
      cards = await extractListingCards(page);
    } finally {
      await page.close();
    }

    if (!cards.length) {
      console.warn('[remotar] nenhum card de vaga encontrado na listagem (best-effort, retornando vazio)');
      return [];
    }

    const cardsToDetail = cards.slice(0, MAX_DETAIL_PAGES);

    const jobs = await mapWithConcurrency(cardsToDetail, DETAIL_CONCURRENCY, async (card) => {
      const url = card.href.startsWith('http') ? card.href : `${BASE_URL}${card.href}`;
      // externalId extraído do path: /job/{id}/{company-slug}/{title-slug}
      const match = card.href.match(/\/job\/(\d+)\//);
      const externalId = match ? match[1] : card.href;

      let description = '';
      try {
        description = await extractDetailDescription(browser, url);
      } catch (err) {
        console.warn(`[remotar] falha ao extrair descrição de ${url} (best-effort):`, err.message);
      }

      return {
        source: 'remotar',
        externalId,
        title: card.title,
        company: card.company,
        location: card.tags.some(t => /remoto/i.test(t)) ? 'Remoto' : null,
        description: description || card.tags.join(', ') || card.title,
        tags: card.tags,
        url,
        postedAt: null, // Remotar só expõe tempo relativo ("50 minutos atrás"), não uma data absoluta parseável
      };
    });

    return jobs;
  } catch (err) {
    console.error('[remotar] falha ao coletar (best-effort, ignorando):', err.message);
    return [];
  }
}

export async function closeBrowser() {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}
