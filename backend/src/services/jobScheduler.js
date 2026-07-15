import cron from 'node-cron';
import { collectJobs } from './jobCollector.js';

// Expressão cron da coleta automática. Default: a cada 6 horas (minuto 0 das
// horas 0/6/12/18). Configurável via COLLECT_CRON no .env; defina 'off' pra
// desativar a coleta agendada (ex: em ambiente de dev/CI).
const DEFAULT_CRON = '0 */6 * * *';

// Trava anti-sobreposição: garante que coleta manual e agendada nunca rodem
// ao mesmo tempo (evita gastar chamadas de IA em dobro na mesma vaga nova).
let isCollecting = false;

/**
 * Roda a coleta de vagas com trava de concorrência. Usado tanto pela coleta
 * agendada quanto pelo endpoint manual, pra compartilharem a mesma trava.
 *
 * @param {string} trigger - 'agendada' | 'manual' (só pra log)
 * @returns {Promise<object>} summary da coleta, ou { skipped: true } se já havia uma rodando
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
