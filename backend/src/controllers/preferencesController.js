import { pool } from '../utils/db.js';

/**
 * GET /api/preferences - retorna as preferências de vaga do usuário.
 */
export async function getPreferences(req, res) {
  try {
    const result = await pool.query(
      'SELECT keywords, min_relevance_score FROM preferences WHERE user_id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Preferências não encontradas' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao buscar preferências', details: err.message });
  }
}

/**
 * PATCH /api/preferences - atualiza keywords e/ou score mínimo de relevância.
 */
export async function updatePreferences(req, res) {
  const { keywords, min_relevance_score } = req.body;

  if (keywords !== undefined && !Array.isArray(keywords)) {
    return res.status(400).json({ error: 'keywords deve ser uma lista de strings' });
  }
  if (
    min_relevance_score !== undefined &&
    (typeof min_relevance_score !== 'number' || min_relevance_score < 0 || min_relevance_score > 100)
  ) {
    return res.status(400).json({ error: 'min_relevance_score deve ser um número entre 0 e 100' });
  }

  try {
    const cleanKeywords = keywords
      ? Array.from(new Set(keywords.map((k) => String(k).toLowerCase().trim()).filter(Boolean)))
      : undefined;

    const result = await pool.query(
      `UPDATE preferences SET
         keywords = COALESCE($1, keywords),
         min_relevance_score = COALESCE($2, min_relevance_score),
         updated_at = now()
       WHERE user_id = $3
       RETURNING keywords, min_relevance_score`,
      [cleanKeywords ?? null, min_relevance_score ?? null, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Preferências não encontradas' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao atualizar preferências', details: err.message });
  }
}
