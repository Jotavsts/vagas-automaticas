import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';

const LISTING_URL = 'https://empregaju.aracaju.se.gov.br/cidadao';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// Portal de empregos da prefeitura de Aracaju/SE. Vagas locais (perfil operacional/CLT).
// Estrutura confirmada via GET real do HTML server-side (2026-07-07):
// cada vaga é um <div class="vaga-card"> contendo:
//   h5.vaga-title              -> título
//   .vaga-badge (badge-clt etc)-> tipo de contrato / modalidade (CLT, Presencial)
//   .empresa-tag               -> empresa (ex: "Empresa Parceira")
//   p.vaga-desc                -> descrição curta
//   .vaga-detail-item span     -> local (ex: "Aracaju/SE"), qtd vagas, tag
//   button.btn-detalhes onclick="verDetalhes({id})" -> id da vaga (só abre modal, sem URL própria)
//   a.btn-candidatar[href]     -> link de candidatura (register)
// Não há página/URL de detalhe por vaga (verDetalhes só abre um modal client-side),
// então a URL usada é a da listagem com âncora do id.
function hashId(str) {
  return crypto.createHash('sha1').update(str).digest('hex').slice(0, 16);
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

    $('.vaga-card').each((_, el) => {
      const card = $(el);
      const title = card.find('.vaga-title').first().text().replace(/\s+/g, ' ').trim();
      if (!title) return;

      const company = card.find('.empresa-tag').first().text().replace(/\s+/g, ' ').trim() || null;
      const description = card.find('.vaga-desc').first().text().replace(/\s+/g, ' ').trim() || title;

      const tags = [];
      card.find('.vaga-badge').each((__, b) => {
        const t = $(b).text().replace(/\s+/g, ' ').trim();
        if (t) tags.push(t);
      });

      // Primeiro .vaga-detail-item costuma ser o local (ícone geo-alt)
      let location = null;
      const geoItem = card.find('.vaga-detail-item').filter((__, item) =>
        $(item).find('.bi-geo-alt-fill').length > 0
      ).first();
      if (geoItem.length) {
        location = geoItem.find('span').first().text().replace(/\s+/g, ' ').trim() || null;
      }

      // externalId: id do verDetalhes(id); fallback pra hash do título+empresa
      const onclick = card.find('.btn-detalhes').attr('onclick') || '';
      const idMatch = onclick.match(/verDetalhes\((\d+)\)/);
      const externalId = idMatch ? idMatch[1] : hashId(`${title}|${company || ''}`);

      // Sem URL de detalhe própria: usa a listagem com âncora do id.
      const url = `${LISTING_URL}#vaga-${externalId}`;

      jobs.push({
        source: 'empregaju',
        externalId: String(externalId),
        title,
        company,
        location,
        description,
        tags,
        url,
        postedAt: null, // portal não expõe data de publicação nos cards
      });
    });

    if (!jobs.length) {
      console.warn('[empregaju] nenhum card de vaga encontrado no HTML (best-effort, retornando vazio)');
    }
    return jobs;
  } catch (err) {
    console.error('[empregaju] falha ao coletar (best-effort, ignorando):', err.message);
    return [];
  }
}
