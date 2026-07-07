import { pool } from '../utils/db.js';
import { adaptCv } from '../services/cvAdapter.js';
import { generatePdf } from '../services/cvPdfGenerator.js';

/**
 * GET /api/cv - retorna o CV base do candidato.
 */
export async function getCv(req, res) {
  try {
    const result = await pool.query('SELECT * FROM cv_base ORDER BY id LIMIT 1');
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'CV base não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao buscar CV', details: err.message });
  }
}

/**
 * POST /api/jobs/:id/adapt - gera a adaptação do CV para a vaga via Claude.
 */
export async function adaptForJob(req, res) {
  const { id } = req.params;
  try {
    const jobResult = await pool.query('SELECT * FROM jobs WHERE id = $1', [id]);
    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Vaga não encontrada' });
    }
    const job = jobResult.rows[0];

    const cvResult = await pool.query('SELECT * FROM cv_base ORDER BY id LIMIT 1');
    if (cvResult.rows.length === 0) {
      return res
        .status(400)
        .json({ error: 'CV base não cadastrado (rode o seed)' });
    }
    const cvBase = cvResult.rows[0];

    const result = await adaptCv(job, cvBase);

    if (result.adapted === true) {
      // Limpa adaptações anteriores desta vaga
      await pool.query('DELETE FROM cv_adaptations WHERE job_id = $1', [id]);

      const insert = await pool.query(
        `INSERT INTO cv_adaptations (job_id, adapted_content, match_score, match_notes, model_used)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          id,
          JSON.stringify(result.content),
          result.match_score,
          result.match_notes,
          result.model_used,
        ]
      );

      await pool.query("UPDATE jobs SET status = 'adapted' WHERE id = $1", [id]);

      return res.json({ adapted: true, adaptation: insert.rows[0] });
    }

    // adapted === false: não atualiza status nem insere; front mostra CV original
    return res.status(200).json({
      adapted: false,
      reason: result.reason,
      content: result.content,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: 'Falha ao adaptar CV', details: err.message });
  }
}

/**
 * POST /api/jobs/:id/generate-pdf - gera o PDF do CV adaptado mais recente para a vaga.
 */
export async function generatePdfForJob(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM cv_adaptations WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Nenhuma adaptação encontrada para esta vaga. Chame /adapt primeiro.',
      });
    }

    const adaptation = result.rows[0];
    const { filePath, fileName } = await generatePdf(adaptation.adapted_content, id);
    const downloadUrl = `/generated-cvs/${fileName}`;

    return res.json({ pdfPath: filePath, downloadUrl });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: 'Falha ao gerar PDF', details: err.message });
  }
}

/**
 * POST /api/jobs/:id/approve - gera o PDF, grava em applications e marca a vaga como aprovada.
 */
export async function approveJob(req, res) {
  const { id } = req.params;
  try {
    const adaptationResult = await pool.query(
      'SELECT * FROM cv_adaptations WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1',
      [id]
    );
    if (adaptationResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Nenhuma adaptação encontrada para esta vaga. Chame /adapt primeiro.',
      });
    }
    const adaptation = adaptationResult.rows[0];

    const jobResult = await pool.query('SELECT * FROM jobs WHERE id = $1', [id]);
    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Vaga não encontrada' });
    }
    const job = jobResult.rows[0];

    const { fileName } = await generatePdf(adaptation.adapted_content, id);
    const downloadUrl = `/generated-cvs/${fileName}`;

    const insert = await pool.query(
      `INSERT INTO applications (job_id, cv_adaptation_id, pdf_path, opened_url)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, adaptation.id, downloadUrl, job.url]
    );

    await pool.query("UPDATE jobs SET status = 'approved' WHERE id = $1", [id]);

    return res.json({ application: insert.rows[0], downloadUrl, jobUrl: job.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao aprovar candidatura', details: err.message });
  }
}

/**
 * GET /api/jobs/:id/adaptation - retorna a adaptação já salva (sem reprocessar via IA).
 */
export async function getAdaptationForJob(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM cv_adaptations WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Nenhuma adaptação encontrada para esta vaga.' });
    }
    res.json({ adaptation: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao buscar adaptação', details: err.message });
  }
}
