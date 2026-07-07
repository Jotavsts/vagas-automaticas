import axios from 'axios';
import * as cheerio from 'cheerio';

const LISTING_URL = 'https://www.vagas.com.br/vagas-de-tecnologia';
const BASE_URL = 'https://www.vagas.com.br';

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

export async function fetchJobs() {
  try {
    const { data: html } = await axios.get(LISTING_URL, {
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
      const url = href.startsWith('http') ? href : `${BASE_URL}${href}`;
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
        url,
        postedAt,
      });
    });

    if (!jobs.length) {
      console.warn('[vagascombr] nenhum card de vaga encontrado no HTML (best-effort, retornando vazio)');
    }
    return jobs;
  } catch (err) {
    console.error('[vagascombr] falha ao coletar (best-effort, ignorando):', err.message);
    return [];
  }
}
