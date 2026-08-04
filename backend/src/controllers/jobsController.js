import { computeRelevanceScoreWithBreakdown } from '../services/jobCollector.js';
import { runCollection } from '../services/jobScheduler.js';
import { pool } from '../utils/db.js';

/**
 * POST /api/jobs/collect - dispara coleta manual de vagas.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function collect(req, res) {
  try {
    const summary = await runCollection('manual');
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao coletar vagas', details: err.message });
  }
}

/**
 * GET /api/jobs - lista o pool global de vagas, com relevance_score e score_breakdown
 * calculados por usuário (a vaga é compartilhada, mas score/status são pessoais).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function listJobs(req, res) {
  const { status: statusFilter } = req.query;
  try {
    const prefResult = await pool.query(
      'SELECT keywords, min_relevance_score FROM preferences WHERE user_id = $1',
      [req.userId]
    );
    const keywords = prefResult.rows[0]?.keywords || [];
    const minScore = prefResult.rows[0]?.min_relevance_score ?? 0;

    const jobsResult = await pool.query(
      `SELECT j.*,
        (SELECT id FROM applications WHERE job_id = j.id AND user_id = $1 ORDER BY approved_at DESC LIMIT 1) AS applied_id,
        (SELECT id FROM cv_adaptations WHERE job_id = j.id AND user_id = $1 ORDER BY created_at DESC LIMIT 1) AS adapted_id
       FROM jobs j
       ORDER BY j.posted_at DESC NULLS LAST`,
      [req.userId]
    );

    const jobs = jobsResult.rows.map((row) => {
      const { applied_id, adapted_id, ...job } = row;
      const status = applied_id ? 'approved' : adapted_id ? 'adapted' : 'new';
      const breakdown = computeRelevanceScoreWithBreakdown(job, keywords);
      return { ...job, status, relevance_score: breakdown.score, score_breakdown: breakdown };
    });

    // Só aplica o score mínimo em vagas ainda não adaptadas/aprovadas — e só
    // quando o usuário tem keywords configuradas (sem keywords, score é sempre
    // 0 pra tudo, então filtrar esconderia o pool inteiro em vez de refinar).
    const relevant =
      keywords.length > 0
        ? jobs.filter((j) => j.status !== 'new' || j.relevance_score >= minScore)
        : jobs;

    const filtered = statusFilter ? relevant.filter((j) => j.status === statusFilter) : relevant;

    res.json(filtered);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao listar vagas', details: err.message });
  }
}
