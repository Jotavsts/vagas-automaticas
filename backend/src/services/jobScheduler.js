import cron from 'node-cron';
import { collectJobs } from './jobCollector.js';
import { pool } from '../utils/db.js';
import { notifyNewJobs } from './notifier.js';


// Expressão cron da coleta automática. Default: a cada 6 horas (minuto 0 das
// horas 0/6/12/18). Configurável via COLLECT_CRON no .env; defina 'off' pra
// desativar a coleta agendada (ex: em ambiente de dev/CI).
const DEFAULT_CRON = '0 */6 * * *';

// Trava anti-sobreposição: garante que coleta manual e agendada nunca rodem
// ao mesmo tempo (evita gastar chamadas de IA em dobro na mesma vaga nova).
let isCollecting = false;

/**
 * @typedef {Object} CollectionSummary
 * @property {number} totalFound - Total de vagas encontradas nas fontes
 * @property {number} newInserted - Vagas efetivamente inseridas (novas)
 * @property {Object.<string, {found: number, inserted: number, error?: string}>} bySource
 */

/**
 * Roda a coleta de vagas com trava de concorrência. Usado tanto pela coleta
 * agendada quanto pelo endpoint manual, pra compartilharem a mesma trava.
 *
 * @param {'agendada'|'manual'} [trigger='manual'] - Origem da chamada (só pra log)
 * @returns {Promise<CollectionSummary|{skipped: true}>}
 */
export async function runCollection(trigger = 'manual') {
  if (isCollecting) {
    console.log(`[scheduler] coleta ${trigger} ignorada — já existe uma em andamento.`);
    return { skipped: true };
  }

  isCollecting = true;
  const startedAt = Date.now();
  try {
    console.log(`[scheduler] coleta ${trigger} iniciada...`);
    const summary = await collectJobs();
    const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(
      `[scheduler] coleta ${trigger} concluída em ${secs}s — ${summary.newInserted} vagas novas de ${summary.totalFound} encontradas.`
    );

    // Notificar usuários sobre vagas novas (fire-and-forget — falha não bloqueia)
    if (summary.newInserted > 0) {
      const { rows: users } = await pool.query('SELECT user_id FROM preferences');
      const { rows: newJobs } = await pool.query(
        `SELECT * FROM jobs ORDER BY collected_at DESC LIMIT $1`,
        [summary.newInserted]
      );
      users.forEach(({ user_id }) => {
        notifyNewJobs(user_id, newJobs).catch(() => {});
      });
    }

    return summary;
  } finally {
    isCollecting = false;
  }
}

/**
 * Agenda a coleta automática de vagas via cron.
 * Chamado uma vez no boot do servidor.
 */
export function startScheduler() {
  const expr = process.env.COLLECT_CRON || DEFAULT_CRON;

  if (expr.toLowerCase() === 'off') {
    console.log('[scheduler] coleta agendada desativada (COLLECT_CRON=off).');
    return;
  }

  if (!cron.validate(expr)) {
    console.error(`[scheduler] COLLECT_CRON inválido ("${expr}"), coleta agendada NÃO iniciada.`);
    return;
  }

  cron.schedule(expr, () => {
    runCollection('agendada').catch((err) =>
      console.error('[scheduler] erro na coleta agendada:', err)
    );
  });

  console.log(`[scheduler] coleta agendada ativa (cron "${expr}").`);
}

/**
 * Agenda a limpeza semanal de vagas antigas sem interação.
 * Remove vagas com mais de 60 dias que nenhum usuário adaptou ou aprovou.
 * Vagas com cv_adaptations ou applications vinculadas são preservadas.
 * Roda toda segunda-feira às 03:00 (fora do pico de uso).
 */
export function startCleanupScheduler() {
  cron.schedule('0 3 * * 1', async () => {
    try {
      const result = await pool.query(
        `DELETE FROM jobs
         WHERE collected_at < NOW() - INTERVAL '60 days'
           AND id NOT IN (SELECT DISTINCT job_id FROM cv_adaptations WHERE job_id IS NOT NULL)
           AND id NOT IN (SELECT DISTINCT job_id FROM applications WHERE job_id IS NOT NULL)
         RETURNING id`
      );
      console.log(`[cleanup] ${result.rowCount} vagas antigas removidas.`);
    } catch (err) {
      console.error('[cleanup] erro na limpeza semanal:', err);
    }
  });

  console.log('[cleanup] limpeza semanal agendada (toda segunda às 03:00).');
}

