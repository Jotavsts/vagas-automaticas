import { pool } from '../utils/db.js';

/**
 * GET /api/channels — lista os canais do Telegram configurados pelo usuário.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function listChannels(req, res) {
  try {
    const result = await pool.query(
      'SELECT telegram_channels FROM preferences WHERE user_id = $1',
      [req.userId]
    );
    const channels = result.rows[0]?.telegram_channels || [];
    res.json({ channels });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao listar canais', details: err.message });
  }
}

/**
 * POST /api/channels — adiciona um canal ao perfil do usuário.
 * Body: { channel: string }
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function addChannel(req, res) {
  const rawChannel = (req.body.channel || '').trim().replace(/^@/, '').toLowerCase();
  if (!rawChannel || !/^[a-z0-9_]{3,}$/.test(rawChannel)) {
    return res.status(400).json({ error: 'Nome de canal inválido. Use apenas letras, números e underscores (mínimo 3 caracteres).' });
  }

  try {
    // Garante que preferences existe para o usuário
    await pool.query(
      `INSERT INTO preferences (user_id, telegram_channels)
       VALUES ($1, ARRAY[$2::text])
       ON CONFLICT (user_id) DO UPDATE
       SET telegram_channels = (
         SELECT ARRAY(
           SELECT DISTINCT unnest(COALESCE(preferences.telegram_channels, '{}') || ARRAY[$2::text])
         )
       )`,
      [req.userId, rawChannel]
    );

    const result = await pool.query(
      'SELECT telegram_channels FROM preferences WHERE user_id = $1',
      [req.userId]
    );
    res.json({ channels: result.rows[0]?.telegram_channels || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao adicionar canal', details: err.message });
  }
}

/**
 * DELETE /api/channels/:channel — remove um canal do perfil do usuário.
 * @param {import('express').Request<{channel: string}>} req
 * @param {import('express').Response} res
 */
export async function removeChannel(req, res) {
  const channelToRemove = (req.params.channel || '').trim().toLowerCase().replace(/^@/, '');

  try {
    await pool.query(
      `UPDATE preferences
       SET telegram_channels = ARRAY(
         SELECT unnest(telegram_channels) EXCEPT SELECT $2::text
       )
       WHERE user_id = $1`,
      [req.userId, channelToRemove]
    );

    const result = await pool.query(
      'SELECT telegram_channels FROM preferences WHERE user_id = $1',
      [req.userId]
    );
    res.json({ channels: result.rows[0]?.telegram_channels || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Falha ao remover canal', details: err.message });
  }
}
