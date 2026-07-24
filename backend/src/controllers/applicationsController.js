import { pool } from '../utils/db.js';

/** @type {ReadonlyArray<string>} */
const VALID_STATUSES = ['enviado', 'em_processo', 'oferta', 'rejeitado', 'desistiu'];

/**
 * @typedef {'enviado'|'em_processo'|'oferta'|'rejeitado'|'desistiu'} ApplicationStatus
 */

/**
 * GET /api/applications - histórico de candidaturas aprovadas (join applications + jobs).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function listApplications(req, res) {
  try {
    const result = await pool.query(
      `SELECT a.id, a.approved_at, a.pdf_path, a.opened_url, a.status,
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

/**
 * PATCH /api/applications/:id/status - atualiza o estado de progresso de uma candidatura.
 * Body: { status: ApplicationStatus }
 *
 * @param {import('express').Request<{id: string}, {}, {status: ApplicationStatus}>} req
 * @param {import('express').Response} res
 */
export async function updateApplicationStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status inválido. Valores aceitos: ${VALID_STATUSES.join(', ')}` });
  }

  try {
    const result = await pool.query(
      `UPDATE applications SET status = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, status, approved_at`,
      [status, id, req.userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Candidatura não encontrada.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao atualizar status', details: err.message });
  }
}

