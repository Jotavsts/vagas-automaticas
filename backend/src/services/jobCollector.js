import { fetchJobs as fetchArbeitnow } from './jobSources/arbeitnow.js';
import { fetchJobs as fetchWWR } from './jobSources/weworkremotely.js';
import { fetchJobs as fetchRemoteOK } from './jobSources/remoteok.js';
import { fetchJobs as fetchRemotar } from './jobSources/remotar.js';
import { pool } from '../utils/db.js';

const SOURCES = [
  { name: 'arbeitnow', fn: fetchArbeitnow },
  { name: 'weworkremotely', fn: fetchWWR },
  { name: 'remoteok', fn: fetchRemoteOK },
  { name: 'remotar', fn: fetchRemotar },
];

async function getKeywords() {
  const { rows } = await pool.query('SELECT keywords FROM preferences ORDER BY id LIMIT 1');
  return rows[0]?.keywords || [];
}

function computeRelevanceScore(job, keywords) {
  if (keywords.length === 0) return 0;
  const haystack = `${job.title} ${job.description} ${(job.tags || []).join(' ')}`.toLowerCase();
  const matches = keywords.filter(k => haystack.includes(k.toLowerCase())).length;
  return Math.round((matches / keywords.length) * 100);
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
