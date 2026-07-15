import { pool } from '../utils/db.js';
import { adaptCv } from '../services/cvAdapter.js';
import { generatePdf } from '../services/cvPdfGenerator.js';
import { extractCv } from '../services/cvExtractor.js';
import { selectCv } from '../services/cvSelector.js';

// Limite de currículos por usuário no plano gratuito. Gancho de assinatura
// futura: quando existir plano pago, isso vira um limite por usuário/tier.
export const FREE_TIER_MAX_CVS = 2;

const ALLOWED_MIMETYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/**
 * GET /api/cv - lista todos os currículos do usuário.
 */
export async function listCvs(req, res) {
  try {
    const result = await pool.query(
      'SELECT * FROM cv_base WHERE user_id = $1 ORDER BY id',
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao buscar currículos', details: err.message });
  }
}

/**
 * POST /api/cv - adiciona um novo currículo (extraído por IA), respeitando o limite do plano.
 */
export async function addCv(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'arquivo de currículo (campo "cv") é obrigatório' });
  }
  if (!ALLOWED_MIMETYPES.has(req.file.mimetype)) {
    return res.status(400).json({ error: 'formato de arquivo não suportado. Envie PDF ou DOCX.' });
  }

  try {
    const countResult = await pool.query('SELECT COUNT(*) FROM cv_base WHERE user_id = $1', [
      req.userId,
    ]);
    const current = Number(countResult.rows[0].count);
    if (current >= FREE_TIER_MAX_CVS) {
      return res.status(409).json({
        error: `Limite de ${FREE_TIER_MAX_CVS} currículos atingido no plano gratuito.`,
        limit: FREE_TIER_MAX_CVS,
      });
    }

    const extraction = await extractCv(req.file.buffer, req.file.mimetype);
    if (!extraction.extracted) {
      return res.status(400).json({
        error: 'Não foi possível extrair os dados do currículo enviado',
        details: extraction.reason,
      });
    }
    const cv = extraction.content;

    const insert = await pool.query(
      `INSERT INTO cv_base (user_id, label, full_name, contact, summary, experience, education, skills)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        req.userId,
        cv.label,
        cv.full_name,
        JSON.stringify(cv.contact || {}),
        cv.summary || '',
        JSON.stringify(cv.experience || []),
        JSON.stringify(cv.education || []),
        JSON.stringify(cv.skills || {}),
      ]
    );

    return res.status(201).json(insert.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao adicionar currículo', details: err.message });
  }
}

/**
 * PATCH /api/cv/:id - renomeia o rótulo de um currículo do usuário.
 */
export async function renameCv(req, res) {
  const { id } = req.params;
  const { label } = req.body;
  if (!label || typeof label !== 'string' || !label.trim()) {
    return res.status(400).json({ error: 'label é obrigatório' });
  }

  try {
    const result = await pool.query(
      'UPDATE cv_base SET label = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [label.trim(), id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Currículo não encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao renomear currículo', details: err.message });
  }
}

/**
 * DELETE /api/cv/:id - remove um currículo do usuário (nunca o último).
 */
export async function deleteCv(req, res) {
  const { id } = req.params;
  try {
    const countResult = await pool.query('SELECT COUNT(*) FROM cv_base WHERE user_id = $1', [
      req.userId,
    ]);
    if (Number(countResult.rows[0].count) <= 1) {
      return res.status(409).json({ error: 'Você precisa manter pelo menos um currículo.' });
    }

    const result = await pool.query(
      'DELETE FROM cv_base WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Currículo não encontrado' });
    }
    res.json({ deleted: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao remover currículo', details: err.message });
  }
}

/**
 * POST /api/jobs/:id/adapt - a IA escolhe o CV mais relevante dentre os do usuário
 * e adapta ele para a vaga via Claude.
 */
export async function adaptForJob(req, res) {
  const { id } = req.params;
  try {
    const jobResult = await pool.query('SELECT * FROM jobs WHERE id = $1', [id]);
    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Vaga não encontrada' });
    }
    const job = jobResult.rows[0];

    const cvResult = await pool.query('SELECT * FROM cv_base WHERE user_id = $1 ORDER BY id', [
      req.userId,
    ]);
    if (cvResult.rows.length === 0) {
      return res.status(400).json({ error: 'Nenhum currículo cadastrado' });
    }

    // A IA escolhe qual CV base usar (se houver mais de um)
    const { cv_base_id } = await selectCv(job, cvResult.rows);
    const cvBase = cvResult.rows.find((c) => c.id === cv_base_id) || cvResult.rows[0];

    const result = await adaptCv(job, cvBase);

    if (result.adapted === true) {
      // Limpa adaptações anteriores desta vaga feitas por este usuário
      await pool.query('DELETE FROM cv_adaptations WHERE job_id = $1 AND user_id = $2', [
        id,
        req.userId,
      ]);

      const insert = await pool.query(
        `INSERT INTO cv_adaptations (job_id, user_id, cv_base_id, adapted_content, match_score, match_notes, model_used)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          id,
          req.userId,
          cvBase.id,
          JSON.stringify(result.content),
          result.match_score,
          result.match_notes,
          result.model_used,
        ]
      );

      return res.json({ adapted: true, adaptation: { ...insert.rows[0], cv_label: cvBase.label } });
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
      'SELECT * FROM cv_adaptations WHERE job_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Nenhuma adaptação encontrada para esta vaga. Chame /adapt primeiro.',
      });
    }

    const adaptation = result.rows[0];

    const jobResult = await pool.query('SELECT title, company FROM jobs WHERE id = $1', [id]);
    const jobTitle = jobResult.rows[0]?.title;
    const jobCompany = jobResult.rows[0]?.company;

    const { filePath, fileName } = await generatePdf(adaptation.adapted_content, id, jobTitle, jobCompany);
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
      'SELECT * FROM cv_adaptations WHERE job_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1',
      [id, req.userId]
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

    const { fileName } = await generatePdf(adaptation.adapted_content, id, job.title, job.company);
    const downloadUrl = `/generated-cvs/${fileName}`;

    const insert = await pool.query(
      `INSERT INTO applications (job_id, user_id, cv_adaptation_id, pdf_path, opened_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, req.userId, adaptation.id, downloadUrl, job.url]
    );

    return res.json({ application: insert.rows[0], downloadUrl, jobUrl: job.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao aprovar candidatura', details: err.message });
  }
}

/**
 * GET /api/jobs/:id/adaptation - retorna a adaptação já salva (sem reprocessar via IA),
 * incluindo o rótulo do CV base usado.
 */
export async function getAdaptationForJob(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT a.*, cb.label AS cv_label
       FROM cv_adaptations a
       LEFT JOIN cv_base cb ON cb.id = a.cv_base_id
       WHERE a.job_id = $1 AND a.user_id = $2
       ORDER BY a.created_at DESC LIMIT 1`,
      [id, req.userId]
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
