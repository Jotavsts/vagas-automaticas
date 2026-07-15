import { collectJobs, computeRelevanceScore } from '../services/jobCollector.js';
import { pool } from '../utils/db.js';

export async function collect(req, res) {
  try {
    const summary = await collectJobs();
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao coletar vagas', details: err.message });
  }
}

/**
 * GET /api/jobs - lista o pool global de vagas, com relevance_score e status
 * calculados por usuário (a vaga é compartilhada, mas score/status são pessoais).
 */
export async function listJobs(req, res) {
  const { status: statusFilter } = req.query;
  try {
    const prefResult = await pool.query('SELECT keywords FROM preferences WHERE user_id = $1', [
      req.userId,
    ]);
    const keywords = prefResult.rows[0]?.keywords || [];

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
      return { ...job, status, relevance_score: computeRelevanceScore(job, keywords) };
    });

    const filtered = statusFilter ? jobs.filter((j) => j.status === statusFilter) : jobs;

    res.json(filtered);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao listar vagas', details: err.message });
  }
}
