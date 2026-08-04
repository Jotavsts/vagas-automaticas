import Anthropic from '@anthropic-ai/sdk';

/**
 * Client único de IA com failover automático entre provedores.
 *
 * Ordem tentada = AI_PROVIDERS (env, csv). Se um provedor falhar (sem chave,
 * sem crédito, rate limit, erro de rede...), tenta o próximo da lista. Só
 * lança erro se TODOS falharem.
 *
 * Provedores conhecidos falam o protocolo OpenAI /chat/completions (Groq,
 * OpenRouter, Google AI Studio, Cerebras, Cohere, Mistral, NVIDIA NIM — ver
 * https://github.com/cheahjs/free-llm-api-resources). "anthropic" é o único
 * caso especial (SDK própria, suporta PDF nativo via vision).
 */

const KNOWN_PROVIDERS = {
  groq: { baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'openai/gpt-oss-20b:free' },
  google: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-flash-latest' },
  cerebras: { baseUrl: 'https://api.cerebras.ai/v1', defaultModel: 'gpt-oss-120b' },
  cohere: { baseUrl: 'https://api.cohere.ai/compatibility/v1', defaultModel: 'command-a-03-2025' },
  mistral: { baseUrl: 'https://api.mistral.ai/v1', defaultModel: 'mistral-small-latest' },
  nvidia: { baseUrl: 'https://integrate.api.nvidia.com/v1', defaultModel: 'meta/llama-3.1-70b-instruct' },
};

function providerOrder() {
  return (process.env.AI_PROVIDERS || 'anthropic')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function callAnthropic({ system, prompt, pdfBuffer, maxTokens }) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error('sem ANTHROPIC_API_KEY/CLAUDE_API_KEY configurada');
  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

  const client = new Anthropic({ apiKey });
  const content = pdfBuffer
    ? [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBuffer.toString('base64') } },
        { type: 'text', text: prompt },
      ]
    : prompt;

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content }],
  });
  const block = response.content && response.content[0];
  const text = block && block.type === 'text' ? block.text : '';
  return { text, provider: 'anthropic', model };
}

let pdfParse; // lazy import, só quando algum provedor não-anthropic precisar ler PDF

async function extractPdfText(buffer) {
  if (!pdfParse) pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
  return (await pdfParse(buffer)).text;
}

async function callOpenAiCompatible(name, { system, prompt, pdfBuffer, maxTokens }) {
  const known = KNOWN_PROVIDERS[name];
  const envName = name.toUpperCase();
  const apiKey = process.env[`${envName}_API_KEY`];
  if (!apiKey) throw new Error(`sem ${envName}_API_KEY configurada`);
  const baseUrl = process.env[`${envName}_BASE_URL`] || known?.baseUrl;
  const model = process.env[`${envName}_MODEL`] || known?.defaultModel;
  if (!baseUrl || !model) {
    throw new Error(`provedor "${name}" desconhecido — configure ${envName}_BASE_URL e ${envName}_MODEL`);
  }

  let userContent = prompt;
  if (pdfBuffer) {
    const text = await extractPdfText(pdfBuffer);
    userContent = `TEXTO DO CURRÍCULO (extraído do PDF):\n${text}\n\n${prompt}`;
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  return { text, provider: name, model };
}

/**
 * @param {{system: string, prompt: string, pdfBuffer?: Buffer, maxTokens?: number}} opts
 * @returns {Promise<{text: string, provider: string, model: string}>}
 */
export async function generateText({ system, prompt, pdfBuffer, maxTokens = 4096 }) {
  const errors = [];
  for (const name of providerOrder()) {
    try {
      if (name === 'anthropic') {
        return await callAnthropic({ system, prompt, pdfBuffer, maxTokens });
      }
      return await callOpenAiCompatible(name, { system, prompt, pdfBuffer, maxTokens });
    } catch (err) {
      console.error(`[aiClient] provedor "${name}" falhou:`, err.message);
      errors.push(`${name}: ${err.message}`);
    }
  }
  throw new Error(`Todos os provedores de IA falharam (${providerOrder().join(', ')}). ${errors.join(' | ')}`);
}
