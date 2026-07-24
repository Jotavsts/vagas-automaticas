import axios from 'axios';
import { computeRelevanceScoreWithBreakdown } from './jobCollector.js';
import { pool } from '../utils/db.js';

const TELEGRAM_API = 'https://api.telegram.org';

/**
 * @typedef {Object} JobRow
 * @property {number} id
 * @property {string} title
 * @property {string|null} company
 * @property {string|null} modality
 * @property {string|null} state
 * @property {string} url
 * @property {string[]} keywords
 * @property {string[]} tags
 * @property {string|null} summary
 */

/**
 * Envia mensagem para um chat_id via Telegram Bot API.
 * Silencioso se TELEGRAM_BOT_TOKEN não estiver configurado.
 *
 * @param {string|number} chatId
 * @param {string} text - Mensagem em HTML
 * @returns {Promise<void>}
 */
async function sendMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;

  await axios.post(
    `${TELEGRAM_API}/bot${token}/sendMessage`,
    { chat_id: chatId, text, parse_mode: 'HTML' },
    { timeout: 8000 }
  );
}

/**
 * Formata uma vaga para a mensagem do Telegram.
 *
 * @param {JobRow} job
 * @param {number} score
 * @returns {string}
 */
function formatJobMessage(job, score) {
  const modality = job.modality ? ` · ${job.modality}` : '';
  const state = job.state ? ` (${job.state})` : '';
  const scoreBar = score >= 80 ? '🟢' : score >= 55 ? '🟡' : '🔴';

  return [
    `<b>${job.title}</b>`,
    `${job.company || 'Empresa não informada'}${modality}${state}`,
    `${scoreBar} Score: ${score}%`,
    `🔗 ${job.url}`,
  ].join('\n');
}

/**
 * Notifica um usuário no Telegram sobre vagas novas com score acima do threshold.
 * Nunca lança exceção — falha é logada e silenciada para não bloquear a coleta.
 *
 * @param {number} userId
 * @param {JobRow[]} newJobs - Array de vagas recém-inseridas no banco
 * @returns {Promise<void>}
 */
export async function notifyNewJobs(userId, newJobs) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return; // notificações desativadas — sem token configurado

  try {
    // Busca preferências e chat_id do usuário
    const prefResult = await pool.query(
      'SELECT keywords, min_relevance_score, telegram_chat_id FROM preferences WHERE user_id = $1',
      [userId]
    );
    const prefs = prefResult.rows[0];
    if (!prefs) return;

    // chat_id: prioridade para o salvo nas preferences; fallback para a variável de ambiente (Fase 1)
    const chatId = prefs.telegram_chat_id || process.env.TELEGRAM_CHAT_ID;
    if (!chatId) return;

    const keywords = /** @type {string[]} */ (prefs.keywords || []);
    const threshold = /** @type {number} */ (prefs.min_relevance_score ?? 40);

    // Filtra e pontua apenas vagas acima do threshold
    const relevant = newJobs
      .map((job) => ({ job, score: computeRelevanceScoreWithBreakdown(job, keywords).score }))
      .filter(({ score }) => score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // máximo 5 vagas por notificação para não poluir

    if (relevant.length === 0) return;

    const header =
      relevant.length === 1
        ? `🚀 <b>1 vaga nova no Adapta Aí!</b>`
        : `🚀 <b>${relevant.length} vagas novas no Adapta Aí!</b>`;

    const body = relevant.map(({ job, score }) => formatJobMessage(job, score)).join('\n\n─────────────\n\n');

    const footer = `\n\nAbra o dashboard para adaptar o currículo e candidatar.`;

    await sendMessage(chatId, `${header}\n\n${body}${footer}`);
    console.log(`[notifier] ${relevant.length} vaga(s) notificadas para usuário ${userId} via Telegram.`);
  } catch (err) {
    // Nunca deixar o notificador derrubar a coleta
    console.error(`[notifier] erro ao notificar usuário ${userId}:`, err.message);
  }
}
