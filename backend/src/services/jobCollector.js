import { fetchJobs as fetchRemotar } from './jobSources/remotar.js';
import { fetchJobs as fetchVagasComBr } from './jobSources/vagascombr.js';
import { fetchJobs as fetchEmpregaju } from './jobSources/empregaju.js';
import { fetchJobs as fetchSolides } from './jobSources/solides.js';
import { summarizeJob } from './jobSummarizer.js';
import { pool } from '../utils/db.js';

const SOURCES = [
  { name: 'remotar', fn: fetchRemotar },
  { name: 'vagascombr', fn: fetchVagasComBr },
  { name: 'empregaju', fn: fetchEmpregaju },
  { name: 'solides', fn: fetchSolides },
];

const SUMMARIZE_CONCURRENCY = 5;

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

/**
 * Calcula o score de relevância de uma vaga para um conjunto de keywords.
 * Chamado por usuário em tempo de leitura (cada usuário tem suas próprias keywords
 * em preferences), não mais gravado globalmente na coleta.
 */
export function computeRelevanceScore(job, keywords) {
  if (keywords.length === 0) return 0;
  const haystack = `${job.title} ${job.summary || ''} ${(job.keywords || []).join(' ')} ${(job.tags || []).join(' ')}`.toLowerCase();
  const matches = keywords.filter((k) => haystack.includes(k.toLowerCase())).length;
  const base = Math.round((matches / keywords.length) * 100);
  const adjusted = base + seniorityAdjustment(job.title);
  return Math.max(0, Math.min(100, adjusted));
}

/**
 * Resume um lote de vagas em paralelo limitado (evita disparar dezenas de
 * chamadas de IA simultâneas numa coleta grande).
 */
async function summarizeInBatches(jobs) {
  const summarized = [];
  for (let i = 0; i < jobs.length; i += SUMMARIZE_CONCURRENCY) {
    const batch = jobs.slice(i, i + SUMMARIZE_CONCURRENCY);
    const results = await Promise.all(batch.map((job) => summarizeJob(job)));
    batch.forEach((job, idx) => {
      summarized.push({
        ...job,
        summary: results[idx].summary,
        keywords: results[idx].keywords,
        modality: results[idx].modality,
        state: results[idx].state,
      });
    });
  }
  return summarized;
}

/**
 * Coleta vagas de todas as fontes (Brasil-only) e insere no pool global de vagas,
 * compartilhado entre todos os usuários. A descrição bruta de cada vaga nunca é
 * gravada — só o resumo e as keywords extraídas por IA (summarizeJob). Não grava
 * relevance_score aqui — cada usuário calcula sua própria pontuação em tempo de
 * leitura via computeRelevanceScore.
 */
const DEFAULT_AREAS = [{ vagascombr_slug: 'tecnologia', remotar_category_ids: [4, 7, 13, 14, 8, 9], solides_query: '' }];

export async function collectJobs() {
  const { rows: areas } = await pool.query('SELECT * FROM active_job_areas WHERE active = true ORDER BY id');
  const effectiveAreas = areas.length ? areas : DEFAULT_AREAS; // defensivo: funciona mesmo antes da seed rodar

  const results = await Promise.allSettled(SOURCES.map((s) => s.fn(effectiveAreas)));

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

    // Filtra vagas já coletadas antes de resumir, pra não gastar chamada de IA à toa
    const existingResult = jobs.length
      ? await pool.query('SELECT external_id FROM jobs WHERE source = $1 AND external_id = ANY($2)', [
          sourceName,
          jobs.map((j) => j.externalId),
        ])
      : { rows: [] };
    const existingIds = new Set(existingResult.rows.map((r) => r.external_id));
    const newJobs = jobs.filter((j) => !existingIds.has(j.externalId));

    const summarized = await summarizeInBatches(newJobs);

    let insertedCount = 0;
    for (const job of summarized) {
      const insertResult = await pool.query(
        `INSERT INTO jobs (source, external_id, title, company, location, modality, state, summary, keywords, tags, url, posted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (source, external_id) DO NOTHING
         RETURNING id`,
        [
          job.source,
          job.externalId,
          job.title,
          job.company,
          job.location,
          job.modality,
          job.state,
          job.summary,
          job.keywords,
          job.tags,
          job.url,
          job.postedAt,
        ]
      );
      if (insertResult.rows.length > 0) insertedCount++;
    }
    newInserted += insertedCount;
    bySource[sourceName] = { found: jobs.length, inserted: insertedCount };
  }

  return { totalFound, newInserted, bySource };
}
