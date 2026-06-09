// api/claude.js
// Proxy LLM con routing inteligente por intent:
//
//   intent: 'chat'       → OpenRouter free (nemotron-nano) — evaluación + wizard
//   intent: 'extraction' → OpenRouter free (nemotron-nano) — extracción semántica
//   intent: 'generation' → Claude Sonnet (Anthropic)       — genera 3 HTMLs nuevos
//   intent: 'redesign'   → Claude Sonnet (Anthropic)       — regenera HTML existente
//
// LLM_PROVIDER env var solo afecta a los intents 'chat' y 'extraction'.
// 'generation' y 'redesign' SIEMPRE usan Anthropic (Claude Sonnet) por calidad.
//
// Otros features:
//   - Rate limiting distribuido via Upstash Redis (seguro en múltiples instancias Vercel)
//   - Inyección del historial completo de mensajes previos (48h) como contexto del LLM
//   - CORS whitelist

import Anthropic from '@anthropic-ai/sdk';
import { checkRateLimit, getMessages, getBrief } from './lib/redis.js';

// ─── Configuración de modelos por intent ────────────────────────────────────

// Modelos Anthropic — siempre usados para generation y redesign
const ANTHROPIC_MODELS = {
  generation: 'claude-sonnet-4-6',
  redesign:   'claude-sonnet-4-6',
  chat:       'claude-haiku-4-5-20251001',
};

// Modelos OpenRouter free — usados para chat y extraction
const OPENROUTER_MODELS = {
  chat:       'nvidia/nemotron-nano-9b-v2:free',
  extraction: 'nvidia/nemotron-nano-9b-v2:free',
};

// Intents que siempre van a Anthropic (ignorar LLM_PROVIDER)
const ALWAYS_ANTHROPIC = new Set(['generation', 'redesign']);

// Rate limits por intent
const RATE_LIMITS = {
  chat:       { max: 10, ttl: 3600  },   // 10/hora
  extraction: { max: 999, ttl: 3600 },   // sin límite práctico
  generation: { max: 2,  ttl: 86400 },   // 2/24h (caro)
  redesign:   { max: 2,  ttl: 86400 },   // 2/24h (comparte cuota con generation)
};

/**
 * Convierte una request en formato Anthropic a OpenRouter (OpenAI-compatible).
 * Diferencias clave:
 *   - Anthropic: { system: "...", messages: [...] }
 *   - OpenAI:    { messages: [{ role: "system", content: "..." }, ...] }
 */
function toOpenRouterRequest(params) {
  const { model, system, messages, max_tokens } = params;
  const orMessages = [];

  if (system) {
    orMessages.push({ role: 'system', content: system });
  }

  for (const m of messages) {
    if (typeof m.content === 'string') {
      orMessages.push({ role: m.role, content: m.content });
    } else if (Array.isArray(m.content)) {
      // Anthropic soporta content blocks — extraemos solo el texto
      const text = m.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n');
      orMessages.push({ role: m.role, content: text });
    }
  }

  return {
    model:      OPENROUTER_MODELS[params.intent] || OPENROUTER_MODELS.chat,
    messages:   orMessages,
    max_tokens: max_tokens ?? 1024,
  };
}

/**
 * Convierte la respuesta de OpenRouter al formato de Anthropic.
 * Para que el frontend no necesite distinguir entre providers.
 */
function fromOpenRouterResponse(orResponse, originalModel) {
  const choice  = orResponse.choices?.[0];
  const content = choice?.message?.content || '';
  return {
    id:    orResponse.id || 'or-' + Date.now(),
    type:  'message',
    role:  'assistant',
    model: originalModel,
    content: [{ type: 'text', text: content }],
    stop_reason: choice?.finish_reason === 'stop' ? 'end_turn' : choice?.finish_reason,
    usage: {
      input_tokens:  orResponse.usage?.prompt_tokens     || 0,
      output_tokens: orResponse.usage?.completion_tokens || 0,
    },
  };
}

/**
 * Llama a OpenRouter con formato OpenAI-compatible.
 */
async function callOpenRouter(params) {
  const body = toOpenRouterRequest(params);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type':  'application/json',
      'HTTP-Referer':  process.env.BASE_URL || 'https://martinduarte.com',
      'X-Title':       'Landing Page Service',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${err}`);
  }

  const orResponse = await response.json();
  return fromOpenRouterResponse(orResponse, params.model);
}

const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const LLM_PROVIDER    = process.env.LLM_PROVIDER || 'anthropic'; // para intents 'chat' y 'extraction'

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());
const ALLOWED_MODELS  = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6'];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

/**
 * Construye el bloque de contexto previo para inyectar al system prompt.
 * Incluye el fullBrief acumulado y fragmentos relevantes del historial de mensajes,
 * para que cada LLM de sección pueda inferir datos ya mencionados sin volver a preguntar.
 *
 * @param {string} sessionId
 * @param {string} currentSection - sección actual (para excluir sus propios mensajes)
 * @returns {string}
 */
async function buildContextBlock(sessionId, currentSection) {
  const [brief, allMessages] = await Promise.all([
    getBrief(sessionId),
    getMessages(sessionId, 60),
  ]);

  let block = '';

  // ── 1. Datos ya recolectados (fullBrief) ──────────────────────────────────
  if (brief && Object.keys(brief).length > 0) {
    block += `\n\n--- DATOS YA RECOLECTADOS DEL CLIENTE (no volver a preguntar) ---\n`;
    block += JSON.stringify(brief, null, 2);
    block += `\n--- FIN DATOS RECOLECTADOS ---`;
  }

  // ── 2. Fragmento del historial de conversaciones anteriores ───────────────
  // Solo incluimos mensajes de secciones ANTERIORES a la actual.
  // Limitamos a los últimos 20 para no saturar el contexto.
  const sectionOrder = ['evaluating','hero','sobre_mi','servicios','testimonios','contacto','diseno'];
  const currentIdx   = sectionOrder.indexOf(currentSection);

  const prevMessages = allMessages
    .filter(m => {
      if (!m.section) return false;
      const idx = sectionOrder.indexOf(m.section);
      return idx >= 0 && idx < currentIdx;
    })
    .slice(-20); // últimos 20 mensajes de secciones anteriores

  if (prevMessages.length > 0) {
    block += `\n\n--- CONVERSACIÓN PREVIA (solo referencia, no repetir) ---\n`;
    for (const m of prevMessages) {
      const role = m.role === 'user' ? 'Cliente' : 'Asistente';
      block += `[${m.section}] ${role}: ${m.content}\n`;
    }
    block += `--- FIN CONVERSACIÓN PREVIA ---`;
  }

  if (block) {
    block = `\n\nCONTEXTO DE SESIÓN ACTIVA:${block}\n\nInstrucción: Usa este contexto para inferir información que el cliente ya mencionó. No hagas preguntas sobre datos que ya están en los datos recolectados.`;
  }

  return block;
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') return res.status(204).set(headers).end();
  if (req.method !== 'POST') return res.status(405).set(headers).json({ error: 'Method not allowed' });
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  const {
    model    = 'claude-haiku-4-5-20251001',
    system,
    messages = [],
    max_tokens = 1024,
    intent     = 'chat',  // 'chat' | 'generation' | 'redesign' | 'extraction'
    session_id,            // para recuperar contexto histórico
    section,               // sección actual ('hero', 'servicios', etc.)
  } = req.body || {};

  // ── Rate limiting distribuido (Redis) ──────────────────────────────────────
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
           || req.socket?.remoteAddress
           || 'unknown';

  const limitConfig = RATE_LIMITS[intent] ?? RATE_LIMITS.chat;
  if (limitConfig.max < 999) {
    const { allowed, remaining } = await checkRateLimit(ip, intent);
    if (!allowed) {
      res.setHeader('Retry-After', limitConfig.ttl);
      const msgs = {
        generation: 'Límite de generación alcanzado (2/24h). Intentá mañana.',
        redesign:   'Límite de rediseño alcanzado (2/24h). Intentá mañana.',
        chat:       'Demasiadas consultas. Esperá un momento.',
      };
      return res.status(429).json({ error: msgs[intent] || msgs.chat, remaining });
    }
  }

  // ── Determinar provider y modelo según intent ──────────────────────────────
  // generation y redesign SIEMPRE usan Anthropic Sonnet (sin importar LLM_PROVIDER)
  const useAnthropic  = ALWAYS_ANTHROPIC.has(intent) || LLM_PROVIDER === 'anthropic';
  const resolvedModel = useAnthropic
    ? (ANTHROPIC_MODELS[intent] || ANTHROPIC_MODELS.chat)
    : (OPENROUTER_MODELS[intent] || OPENROUTER_MODELS.chat);

  // ── Inyectar contexto histórico en el system prompt (solo en chat) ─────────
  let systemWithContext = system || '';
  if (session_id && section && intent === 'chat') {
    const contextBlock = await buildContextBlock(session_id, section);
    systemWithContext = systemWithContext + contextBlock;
  }

  // ── Llamada al LLM ─────────────────────────────────────────────────────────
  const llmParams = {
    model:      resolvedModel,
    max_tokens,
    system:     systemWithContext || undefined,
    messages,
  };

  const providerLabel = useAnthropic ? 'anthropic' : 'openrouter';
  console.log(`[claude proxy] intent=${intent} provider=${providerLabel} model=${resolvedModel}`);

  try {
    let response;

    if (useAnthropic) {
      response = await anthropicClient.messages.create(llmParams);
    } else {
      response = await callOpenRouter(llmParams);
    }

    return res.status(200).json(response);

  } catch (err) {
    console.error(`[claude proxy / ${providerLabel}]`, err);

    if (err.status === 429 || err.message?.includes('429')) {
      return res.status(429).json({ error: 'Rate limit del LLM alcanzado. Reintentá en un momento.' });
    }
    if (err.status === 401 || err.message?.includes('401')) {
      return res.status(500).json({ error: 'Error de autenticación con el LLM.' });
    }

    return res.status(500).json({ error: 'Error al contactar el LLM', detail: err.message });
  }
}
