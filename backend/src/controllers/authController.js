import bcrypt from 'bcrypt';
import { pool } from '../utils/db.js';
import { signToken } from '../utils/jwt.js';
import { extractCv, deriveKeywordsFromSkills } from '../services/cvExtractor.js';
import { ensureAreaForLabel } from '../services/jobAreaResolver.js';

const ALLOWED_MIMETYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/**
 * POST /api/auth/register - cria a conta, extrai o CV enviado por IA e popula cv_base/preferences.
 */
export async function register(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email e password são obrigatórios' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'arquivo de currículo (campo "cv") é obrigatório' });
  }
  if (!ALLOWED_MIMETYPES.has(req.file.mimetype)) {
    return res.status(400).json({ error: 'formato de arquivo não suportado. Envie PDF ou DOCX.' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'já existe uma conta com esse email' });
    }

    const extraction = await extractCv(req.file.buffer, req.file.mimetype);
    if (!extraction.extracted) {
      return res.status(400).json({
        error: 'Não foi possível extrair os dados do currículo enviado',
        details: extraction.reason,
      });
    }
    const cv = extraction.content;
    const keywords = deriveKeywordsFromSkills(cv.skills);

    const passwordHash = await bcrypt.hash(password, 10);

    const client = await pool.connect();
    let user;
    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
        [email, passwordHash]
      );
      user = userResult.rows[0];

      await client.query(
        `INSERT INTO cv_base (user_id, label, full_name, contact, summary, experience, education, skills)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          user.id,
          cv.label,
          cv.full_name,
          JSON.stringify(cv.contact || {}),
          cv.summary || '',
          JSON.stringify(cv.experience || []),
          JSON.stringify(cv.education || []),
          JSON.stringify(cv.skills || {}),
        ]
      );

      await client.query('INSERT INTO preferences (user_id, keywords) VALUES ($1, $2)', [
        user.id,
        keywords,
      ]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Fire-and-forget: não atrasa a resposta do cadastro. Se a área do CV for
    // nova, só passa a ser coletada a partir do próximo ciclo do cron.
    ensureAreaForLabel(cv.label, user.id).catch((err) =>
      console.error('[jobAreaResolver] falha ao registrar área no cadastro (best-effort):', err.message)
    );

    const token = signToken(user.id);
    return res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Falha ao criar conta', details: err.message });
  }
}

/**
 * POST /api/auth/login
 */
export async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email e password são obrigatórios' });
  }

  try {
    const result = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [
      email,
    ]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'email ou senha inválidos' });
    }

    const row = result.rows[0];
    const match = await bcrypt.compare(password, row.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'email ou senha inválidos' });
    }

    const token = signToken(row.id);
    return res.json({ token, user: { id: row.id, email: row.email } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Falha ao autenticar', details: err.message });
  }
}
