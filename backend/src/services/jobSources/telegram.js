import axios from 'axios';
import * as cheerio from 'cheerio';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// Lista de canais públicos do Telegram focados em vagas de tecnologia e trabalho remoto.
// Pode ser sobrescrita via TELEGRAM_JOB_CHANNELS no .env (separada por vírgula).
const DEFAULT_CHANNELS = [
  'canalvagasdeti',
];

function getChannels() {
  const envChannels = process.env.TELEGRAM_JOB_CHANNELS;
  if (!envChannels || !envChannels.trim()) {
    return DEFAULT_CHANNELS;
  }
  return envChannels
    .split(',')
    .map((c) => c.trim().replace(/^@/, ''))
    .filter(Boolean);
}

const JOB_KEYWORDS = [
  'vaga',
  'oportunidade',
  'desenvolvedor',
  'desenvolvedora',
  'developer',
  'frontend',
  'backend',
  'fullstack',
  'estágio',
  'estagios',
  'junior',
  'júnior',
  'analista',
  'remoto',
  'tech',
  'programador',
  'programadora',
];

/**
 * Normaliza o texto de uma postagem para estimar um título inicial.
 * @param {string} text
 * @returns {string}
 */
function extractTitleFromText(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return 'Vaga via Telegram';

  // Tenta achar a primeira linha útil sem emojis soltos
  const firstLine = lines[0].replace(/^[^\w\sÀ-ú]+/g, '').trim();
  if (firstLine.length >= 5 && firstLine.length <= 100) {
    return firstLine;
  }
  return text.slice(0, 70).replace(/\n/g, ' ').trim();
}

/**
 * Coleta vagas de canais públicos do Telegram via a interface de Web Preview (t.me/s/canal).
 * Se `channelList` for passado, usa essa lista em vez dos canais do .env.
 *
 * @param {Array} [_areas] - Áreas ativas (não usadas diretamente)
 * @param {string[]} [channelList] - Lista de canais explícita (vinda do banco)
 * @returns {Promise<Array<{source: string, externalId: string, title: string, company: string|null, location: string|null, description: string, tags: string[], url: string, postedAt: string|null}>>}
 */
export async function fetchJobs(_areas, channelList) {
  const allJobs = [];

  // Junta canais do .env com os canais passados pelo chamador (do banco)
  const envChannels = getChannels();
  const allChannels = Array.from(new Set([...envChannels, ...(channelList || [])]));
  const channels = allChannels.length > 0 ? allChannels : DEFAULT_CHANNELS;
  for (const channel of channels) {
    const channelUrl = `https://t.me/s/${channel}`;
    try {
      const { data: html } = await axios.get(channelUrl, {
        headers: {
          'User-Agent': BROWSER_UA,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        },
        timeout: 12000,
      });

      const $ = cheerio.load(html);

      $('.tgme_widget_message').each((_, el) => {
        const msg = $(el);
        const text = msg.find('.tgme_widget_message_text').text().trim();
        const postUrl = msg.find('.tgme_widget_message_date').attr('href');
        const timeStr = msg.find('time').attr('datetime');

        if (!text || text.length < 40 || !postUrl) return;

        // Verifica se a mensagem fala de vagas
        const lowerText = text.toLowerCase();
        const isJobPost = JOB_KEYWORDS.some((kw) => lowerText.includes(kw));
        if (!isJobPost) return;

        // Extrai id do post no formato "canal_123"
        const idMatch = postUrl.match(/t\.me\/([^/]+)\/(\d+)/);
        const externalId = idMatch ? `${idMatch[1]}_${idMatch[2]}` : `${channel}_${Date.now()}`;

        const title = extractTitleFromText(text);

        allJobs.push({
          source: 'telegram',
          externalId,
          title,
          company: null,
          location: 'Remoto / Brasil',
          description: text,
          tags: ['Telegram'],
          url: postUrl,
          postedAt: timeStr ? new Date(timeStr).toISOString() : null,
        });
      });
    } catch (err) {
      console.error(`[telegram] falha ao coletar canal @${channel}:`, err.message);
    }
  }

  return allJobs;
}
