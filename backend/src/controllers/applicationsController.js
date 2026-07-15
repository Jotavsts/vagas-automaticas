import { pool } from '../utils/db.js';

/**
 * GET /api/applications - histórico de candidaturas aprovadas (join applications + jobs).
 */
export async function listApplications(req, res) {
  try {
    const result = await pool.query(
      `SELECT a.id, a.approved_at, a.pdf_path, a.opened_url,
             j.title, j.company, j.url AS job_url, j.source
      FROM applications a
      JOIN jobs j ON j.id = a.job_id
      WHERE a.user_id = $1
      ORDER BY a.approved_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao listar histórico', details: err.message });
  }
}
