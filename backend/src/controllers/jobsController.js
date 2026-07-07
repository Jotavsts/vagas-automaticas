import { collectJobs } from '../services/jobCollector.js';
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

export async function listJobs(req, res) {
  const { status } = req.query;
  try {
    const result = status
      ? await pool.query('SELECT * FROM jobs WHERE status = $1 ORDER BY posted_at DESC NULLS LAST', [status])
      : await pool.query('SELECT * FROM jobs ORDER BY posted_at DESC NULLS LAST');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao listar vagas', details: err.message });
  }
}
