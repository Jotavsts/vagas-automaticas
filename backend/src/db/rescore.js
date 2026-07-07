// Recalcula o relevance_score de TODAS as vagas já no banco usando as keywords
// de preferência atuais + o ajuste de senioridade. Rode isto sempre que mudar as
// keywords ou a lógica de score (ex: `node src/db/rescore.js`), já que a coleta
// normal só pontua vagas novas (ON CONFLICT DO NOTHING não repontua as existentes).
import { pool } from '../utils/db.js';
import { computeRelevanceScore } from '../services/jobCollector.js';

async function rescore() {
  try {
    const { rows: prefRows } = await pool.query(
      'SELECT keywords FROM preferences ORDER BY id LIMIT 1'
    );
    const keywords = prefRows[0]?.keywords || [];

    const { rows: jobs } = await pool.query(
      'SELECT id, title, description, tags FROM jobs'
    );

    let updated = 0;
    for (const job of jobs) {
      const score = computeRelevanceScore(job, keywords);
      await pool.query('UPDATE jobs SET relevance_score = $1 WHERE id = $2', [score, job.id]);
      updated++;
    }

    console.log(`Rescore concluído: ${updated} vagas repontuadas com ${keywords.length} keywords.`);
  } catch (err) {
    console.error('Erro no rescore:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

rescore();
