import { fetchJobs as fetchArbeitnow } from './jobSources/arbeitnow.js';
import { fetchJobs as fetchWWR } from './jobSources/weworkremotely.js';
import { fetchJobs as fetchRemoteOK } from './jobSources/remoteok.js';
import { fetchJobs as fetchRemotar } from './jobSources/remotar.js';
import { fetchJobs as fetchVagasComBr } from './jobSources/vagascombr.js';
import { fetchJobs as fetchEmpregaju } from './jobSources/empregaju.js';
import { fetchJobs as fetchSolides } from './jobSources/solides.js';
import { pool } from '../utils/db.js';

const SOURCES = [
  { name: 'arbeitnow', fn: fetchArbeitnow },
  { name: 'weworkremotely', fn: fetchWWR },
  { name: 'remoteok', fn: fetchRemoteOK },
  { name: 'remotar', fn: fetchRemotar },
  { name: 'vagascombr', fn: fetchVagasComBr },
  { name: 'empregaju', fn: fetchEmpregaju },
  { name: 'solides', fn: fetchSolides },
];

async function getKeywords() {
  const { rows } = await pool.query('SELECT keywords FROM preferences ORDER BY id LIMIT 1');
  return rows[0]?.keywords || [];
}

// João é JÚNIOR. O score prioriza vagas do nível dele: rebaixa sênior/lead/principal
// (ainda ficam visíveis, só afundam no ranking) e valoriza júnior/estágio/entry.
// O sinal vem do TÍTULO, que é bem mais confiável que a descrição pra indicar nível.
const SENIOR_SIGNALS = ['senior', 'sênior', 'sr.', 'lead', 'principal', 'staff', 'head of'];
const JUNIOR_SIGNALS = ['junior', 'júnior', 'jr.', 'entry', 'trainee', 'estági', 'iniciante'];

function seniorityAdjustment(title) {
  const t = (title || '').toLowerCase();
  if (SENIOR_SIGNALS.some((s) => t.includes(s))) return -30;
  if (JUNIOR_SIGNALS.some((s) => t.includes(s))) return 15;
  return 0;
}

export function computeRelevanceScore(job, keywords) {
  if (keywords.length === 0) return 0;
  const haystack = `${job.title} ${job.description} ${(job.tags || []).join(' ')}`.toLowerCase();
  const matches = keywords.filter((k) => haystack.includes(k.toLowerCase())).length;
  const base = Math.round((matches / keywords.length) * 100);
  const adjusted = base + seniorityAdjustment(job.title);
  return Math.max(0, Math.min(100, adjusted));
}

export async function collectJobs() {
  const keywords = await getKeywords();
  const results = await Promise.allSettled(SOURCES.map(s => s.fn()));

  const bySource = {};
  let totalFound = 0;
  let newInserted = 0;

  for (let i = 0; i < SOURCES.length; i++) {
    const sourceName = SOURCES[i].name;
    const result = results[i];
    if (result.status === 'rejected') {
      console.error(`[jobCollector] fonte ${sourceName} falhou:`, result.reason);
      bySource[sourceName] = { found: 0, inserted: 0, error: String(result.reason) };
      continue;
    }
    const jobs = result.value || [];
    totalFound += jobs.length;
    let insertedCount = 0;

    for (const job of jobs) {
      const score = computeRelevanceScore(job, keywords);
      const insertResult = await pool.query(
        `INSERT INTO jobs (source, external_id, title, company, location, description, tags, url, posted_at, relevance_score)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (source, external_id) DO NOTHING
         RETURNING id`,
        [job.source, job.externalId, job.title, job.company, job.location, job.description, job.tags, job.url, job.postedAt, score]
      );
      if (insertResult.rows.length > 0) insertedCount++;
    }
    newInserted += insertedCount;
    bySource[sourceName] = { found: jobs.length, inserted: insertedCount };
  }

  return { totalFound, newInserted, bySource };
}
