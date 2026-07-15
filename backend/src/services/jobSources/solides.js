import axios from 'axios';

// vagas.solides.com.br é uma SPA Next.js. Via inspeção de rede real com Playwright (2026-07-07)
// descobrimos o endpoint JSON interno que a SPA consome:
//   GET https://apigw.solides.com.br/jobs/v3/portal-vacancies-new?title=&locations=&take=N&page=N
// Ele retorna { success, errors, data: { totalPages, currentPage, count, data: [ ...vagas ] } }.
// Usar esse endpoint direto com axios é muito mais estável/rápido que raspar o DOM.
//
// NOTA (2026-07-07): no momento da implementação o portal retornava count=0 para TODAS as
// consultas (home, /vagas, filtro de TI, busca por "desenvolvedor") — confirmado tanto via curl
// quanto via browser real. Ou seja, o portal público está sem vagas ativas agora. O código
// abaixo é defensivo: mapeia os campos esperados e retorna [] com aviso quando não há vagas,
// passando a coletar automaticamente assim que houver vagas publicadas.

const API_URL = 'https://apigw.solides.com.br/jobs/v3/portal-vacancies-new';
const PORTAL_URL = 'https://vagas.solides.com.br';
const TAKE = 40; // quantas vagas puxar por vez
const MAX_PAGES = 30; // limite defensivo

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// O payload de cada vaga da Solides pode variar de nomes de campo; extraímos defensivamente
// tentando as chaves mais prováveis (o portal usa PT/EN misto em APIs Solides).
function pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

function normalize(v) {
  const id = pick(v, ['id', 'vacancyId', 'uuid', 'slug', 'code']);
  const title = pick(v, ['title', 'name', 'position', 'vacancyName', 'occupation']);
  if (id === undefined || !title) return null;

  const company =
    pick(v, ['companyName', 'company', 'enterpriseName', 'enterprise']) || null;
  const companyName =
    company && typeof company === 'object'
      ? pick(company, ['name', 'title', 'fantasyName']) || null
      : company;

  const city = pick(v, ['city', 'cityName', 'locationCity']);
  const state = pick(v, ['state', 'uf', 'stateName', 'locationState']);
  const locationRaw = pick(v, ['location', 'locations', 'address']);
  let location = null;
  if (city || state) location = [city, state].filter(Boolean).join(' / ');
  else if (typeof locationRaw === 'string') location = locationRaw;
  if (pick(v, ['homeOffice', 'isHomeOffice', 'remote', 'isRemote'])) {
    location = location ? `${location} (Home Office)` : 'Home Office';
  }

  const description =
    pick(v, ['description', 'summary', 'about', 'activities']) || title;

  const slug = pick(v, ['slug', 'friendlyUrl', 'url']);
  const url =
    typeof slug === 'string' && slug.startsWith('http')
      ? slug
      : slug
      ? `${PORTAL_URL}/vaga/${slug}`
      : `${PORTAL_URL}/vaga/${id}`;

  const area = pick(v, ['occupationArea', 'area', 'department', 'segment']);
  const contract = pick(v, ['contractType', 'contract', 'hiringType', 'workModel']);
  const tags = [area, contract]
    .map((t) => (t && typeof t === 'object' ? pick(t, ['name', 'title']) : t))
    .filter(Boolean);

  const dateRaw = pick(v, ['publishedAt', 'createdAt', 'publicationDate', 'date']);
  const postedAt = dateRaw ? new Date(dateRaw) : null;

  return {
    source: 'solides',
    externalId: String(id),
    title: String(title).replace(/\s+/g, ' ').trim(),
    company: companyName,
    location,
    description: String(description).replace(/\s+/g, ' ').trim(),
    tags,
    url,
    postedAt: postedAt && !isNaN(postedAt.getTime()) ? postedAt : null,
  };
}

async function fetchPage(page) {
  const { data } = await axios.get(API_URL, {
    params: { title: '', locations: '', take: TAKE, page },
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: 'application/json, text/plain, */*',
      Origin: PORTAL_URL,
      Referer: `${PORTAL_URL}/`,
    },
    timeout: 15000,
  });

  const list = data?.data?.data;
  const totalPages = Number(data?.data?.totalPages) || 0;
  return { list: Array.isArray(list) ? list : [], totalPages };
}

export async function fetchJobs() {
  try {
    const { list: firstPageList, totalPages } = await fetchPage(1);
    if (!firstPageList.length) {
      console.warn(
        `[solides] endpoint retornou 0 vagas — portal sem vagas ativas no momento (best-effort, retornando vazio)`
      );
      return [];
    }

    const rawJobs = [...firstPageList];
    const lastPage = Math.min(totalPages, MAX_PAGES);
    for (let page = 2; page <= lastPage; page++) {
      try {
        const { list: pageList } = await fetchPage(page);
        if (!pageList.length) break;
        rawJobs.push(...pageList);
      } catch (err) {
        console.warn(`[solides] falha na página ${page} (best-effort, parando paginação):`, err.message);
        break;
      }
    }

    const jobs = rawJobs.map(normalize).filter(Boolean);
    if (!jobs.length) {
      console.warn('[solides] endpoint retornou itens, mas nenhum pôde ser normalizado (best-effort, retornando vazio)');
    }
    return jobs;
  } catch (err) {
    console.error('[solides] falha ao coletar (best-effort, ignorando):', err.message);
    return [];
  }
}
