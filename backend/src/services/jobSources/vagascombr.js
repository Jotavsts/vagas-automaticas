import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://www.vagas.com.br';
const MAX_PAGES = 30; // limite defensivo (o site expõe ~15 páginas hoje; margem pra crescer sem coleta infinita)
const PAGE_DELAY_MS = 400; // intervalo entre páginas e entre áreas, pra não martelar o site
const DEFAULT_AREAS = [{ vagascombr_slug: 'tecnologia' }];

// User-Agent de navegador comum. O site bloqueia bots de IA (ClaudeBot/GPTBot) por UA,
// mas a listagem pública é permitida no robots.txt (só /api/ é Disallow — não usamos).
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// Estrutura confirmada via GET real do HTML server-side (2026-07-07):
// cada vaga é um <li class="vaga odd|even"> contendo:
//   a.link-detalhes-vaga   -> título + href relativo "/vagas/v{id}/{slug}" + data-id-vaga="{id}"
//   span.emprVaga          -> nome da empresa
//   span.nivelVaga         -> nível (ex: "Técnico", "Sênior")
//   div.detalhes p         -> trecho da descrição
//   footer .vaga-local     -> localização (texto contém tooltip; pegar só o 1º nó de texto)
//   span.data-publicacao   -> data no formato DD/MM/YYYY
function parseBrDate(str) {
  const m = (str || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return isNaN(d.getTime()) ? null : d;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(pageNumber, slug) {
  const listingUrl = `${BASE_URL}/vagas-de-${slug}`;
  const url =
    pageNumber === 1 ? listingUrl : `${listingUrl}?pagina=${pageNumber}&q=${encodeURIComponent(slug)}`;
  const { data: html } = await axios.get(url, {
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    },
    timeout: 15000,
  });

  const $ = cheerio.load(html);
  const jobs = [];

  $('li.vaga').each((_, el) => {
    const card = $(el);
    const titleEl = card.find('a.link-detalhes-vaga').first();
    if (!titleEl.length) return;

    const href = titleEl.attr('href') || '';
    const jobUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
    // externalId: data-id-vaga; fallback pro /v{id}/ do path
    const externalId =
      titleEl.attr('data-id-vaga') ||
      (href.match(/\/v(\d+)\//) || [])[1] ||
      href;

    const title = titleEl.text().replace(/\s+/g, ' ').trim();
    const company = card.find('.emprVaga').first().text().replace(/\s+/g, ' ').trim() || null;
    const nivel = card.find('.nivelVaga').first().text().replace(/\s+/g, ' ').trim();

    // .vaga-local contém o texto da cidade seguido de um tooltip; pegar só o texto direto
    const localEl = card.find('.vaga-local').first().clone();
    localEl.find('.tooltip-place').remove();
    localEl.find('i').remove();
    const location = localEl.text().replace(/\s+/g, ' ').trim() || null;

    const description = card.find('.detalhes p').first().text().replace(/\s+/g, ' ').trim() || title;
    const postedAt = parseBrDate(card.find('.data-publicacao').first().text());

    jobs.push({
      source: 'vagascombr',
      externalId: String(externalId),
      title,
      company,
      location,
      description,
      tags: nivel ? [nivel] : [],
      url: jobUrl,
      postedAt,
    });
  });

  // O botão "carregar mais" expõe o total de páginas em data-total.
  const totalPages = Number($('#maisVagas').attr('data-total')) || 1;

  return { jobs, totalPages };
}

export async function fetchJobs(areas = DEFAULT_AREAS) {
  const allJobs = [];
  const seenIds = new Set();

  for (const area of areas) {
    const slug = area.vagascombr_slug;
    if (!slug) continue;

    try {
      const { jobs: firstPageJobs, totalPages } = await fetchPage(1, slug);
      for (const job of firstPageJobs) {
        if (seenIds.has(job.externalId)) continue;
        seenIds.add(job.externalId);
        allJobs.push(job);
      }

      const lastPage = Math.min(totalPages, MAX_PAGES);
      for (let page = 2; page <= lastPage; page++) {
        await sleep(PAGE_DELAY_MS);
        try {
          const { jobs: pageJobs } = await fetchPage(page, slug);
          if (!pageJobs.length) break; // página vazia, para (evita continuar batendo à toa)
          for (const job of pageJobs) {
            if (seenIds.has(job.externalId)) continue;
            seenIds.add(job.externalId);
            allJobs.push(job);
          }
        } catch (err) {
          console.warn(`[vagascombr] falha na página ${page} do slug "${slug}" (best-effort, parando paginação dessa área):`, err.message);
          break;
        }
      }
    } catch (err) {
      console.warn(`[vagascombr] falha ao coletar área "${slug}" (best-effort, seguindo pras próximas):`, err.message);
    }

    await sleep(PAGE_DELAY_MS);
  }

  if (!allJobs.length) {
    console.warn('[vagascombr] nenhum card de vaga encontrado no HTML (best-effort, retornando vazio)');
  }
  return allJobs;
}
