import axios from 'axios';
import * as cheerio from 'cheerio';
import { chromium } from 'playwright';

const BASE_URL = 'https://www.infojobs.com.br';
const MAX_SCROLL_ATTEMPTS = 30;
const SCROLL_STABLE_ROUNDS = 2;

// Regra de negócio explícita (não é a lógica de área/categoria dinâmica das
// outras fontes): Aracaju entra por inteiro (presencial + remoto, é onde o
// usuário mora); fora de Aracaju só entra vaga remota. O site não tem uma
// URL nacional única pra "todas as vagas remotas do Brasil" — o filtro
// "home office" é sempre amarrado a uma cidade de busca (confirmado por
// inspeção real: buscar remoto em "São Paulo" só traz vaga de empresa
// baseada em SP) — então cobrimos remoto via um punhado de capitais-polo
// em vez de rodar as 27 capitais.
const ARACAJU_SLUG = 'aracaju';
const REMOTE_HUB_CITY_SLUGS = [
  'sao-paulo',
  'rio-de-janeiro',
  'belo-horizonte',
  'curitiba',
  'porto-alegre',
  'brasilia',
  'salvador',
  'recife',
  'maceio',
  'fortaleza',
];

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

function citySearchUrl(citySlug, { remoteOnly }) {
  const base = `${BASE_URL}/vagas-de-emprego-em-${citySlug}.aspx`;
  return remoteOnly ? base.replace('.aspx', '-trabalho-home-office.aspx') : base;
}

// Estrutura confirmada via inspeção real do HTML server-renderizado (2026-07-16):
// cada resultado é um <div class="card ... js_rowCard" data-typesimilar="..."> contendo
// um <div id="vacancy{id}" data-id="{id}" data-href="/vaga-de-...aspx"> com:
//   h2.js_vacancyTitle          -> título
//   .text-body a.text-body      -> nome da empresa (pode vir "Empresa - Filial")
//   .mb-8                       -> localização (texto direto, ignorando o span de distância)
//   .js_date[data-value]        -> data de publicação, formato "YYYY/MM/DD HH:mm:ss"
//   .icon-buildings + texto     -> modalidade (Presencial/Home office/Híbrido)
//   último .text-medium         -> trecho da descrição
// data-typesimilar="" (vazio) = resultado real da busca; qualquer outro valor = vaga
// "semelhante" que o site injeta como preenchimento depois que os resultados reais
// acabam (confirmado ao vivo: scroll numa busca com 202 resultados reais trouxe 404
// cards) — pulamos essas pra não coletar vaga de fora do filtro pedido.
function parseCards(html) {
  const $ = cheerio.load(html);
  const jobs = [];

  $('div.card.js_rowCard').each((_, el) => {
    const outer = $(el);
    const typesimilar = outer.attr('data-typesimilar');
    if (typesimilar !== '') return; // vaga "semelhante" (preenchimento), não é resultado real

    const inner = outer.find('[id^="vacancy"]').first();
    if (!inner.length) return;

    const externalId = inner.attr('data-id');
    const href = inner.attr('data-href') || '';
    if (!externalId || !href) return;

    const url = href.startsWith('http') ? href : `${BASE_URL}${href}`;
    const title = inner.find('.js_vacancyTitle').first().text().replace(/\s+/g, ' ').trim();
    if (!title) return;

    const company =
      inner.find('.text-body a.text-body').first().text().replace(/\s+/g, ' ').trim() || null;

    const localEl = inner.find('.mb-8').first().clone();
    localEl.find('.js_divUserVagaDistance').remove();
    const location = localEl.text().replace(/\s+/g, ' ').trim() || null;

    const modality =
      inner
        .find('.icon-buildings')
        .first()
        .parent()
        .text()
        .replace(/\s+/g, ' ')
        .trim() || null;

    const textMediumBlocks = inner.find('.text-medium');
    const description = textMediumBlocks.length
      ? $(textMediumBlocks[textMediumBlocks.length - 1])
          .text()
          .replace(/\s+/g, ' ')
          .trim()
      : '';

    const dateRaw = inner.find('.js_date').first().attr('data-value');
    const postedAt = dateRaw ? new Date(dateRaw) : null;

    jobs.push({
      source: 'infojobs',
      externalId: String(externalId),
      title,
      company,
      location,
      description: description || title,
      tags: modality ? [modality] : [],
      url,
      postedAt: postedAt && !isNaN(postedAt.getTime()) ? postedAt : null,
    });
  });

  return jobs;
}

async function fetchCity(citySlug, opts) {
  const url = citySearchUrl(citySlug, opts);
  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
      timeout: 15000,
    });
    return parseCards(html);
  } catch (err) {
    console.warn(`[infojobs] falha ao coletar "${citySlug}" (best-effort, seguindo pras próximas):`, err.message);
    return [];
  }
}

// Aracaju usa scroll infinito via Playwright pra pegar TODAS as vagas reais
// (não só o primeiro lote server-renderizado) — confirmado ao vivo que o
// scroll estabiliza exatamente no total real da busca, sem misturar vaga
// "semelhante" (data-typesimilar continua "" em todos os cards carregados
// via scroll, não só nos iniciais).
async function fetchAracajuFull() {
  const url = citySearchUrl(ARACAJU_SLUG, { remoteOnly: false });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

    let lastCount = -1;
    let stableRounds = 0;
    for (let i = 0; i < MAX_SCROLL_ATTEMPTS; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(900);
      const count = await page.evaluate(() => document.querySelectorAll('div.card.js_rowCard').length);
      if (count === lastCount) {
        stableRounds++;
        if (stableRounds >= SCROLL_STABLE_ROUNDS) break;
      } else {
        stableRounds = 0;
      }
      lastCount = count;
    }

    const html = await page.content();
    return parseCards(html);
  } catch (err) {
    console.warn('[infojobs] falha ao coletar Aracaju via scroll (best-effort, retornando vazio):', err.message);
    return [];
  } finally {
    await browser.close();
  }
}

// Ignora o argumento "areas" de propósito — essa fonte não segue o sistema
// de áreas dinâmico (active_job_areas) das outras, tem regra fixa própria
// (Aracaju tudo, resto só remoto).
export async function fetchJobs() {
  const allJobs = [];
  const seenIds = new Set();

  const aracajuJobs = await fetchAracajuFull();
  for (const job of aracajuJobs) {
    if (seenIds.has(job.externalId)) continue;
    seenIds.add(job.externalId);
    allJobs.push(job);
  }

  for (const citySlug of REMOTE_HUB_CITY_SLUGS) {
    const cityJobs = await fetchCity(citySlug, { remoteOnly: true });
    for (const job of cityJobs) {
      if (seenIds.has(job.externalId)) continue;
      seenIds.add(job.externalId);
      allJobs.push(job);
    }
  }

  if (!allJobs.length) {
    console.warn('[infojobs] nenhuma vaga encontrada em nenhuma cidade (best-effort, retornando vazio)');
  }
  return allJobs;
}
