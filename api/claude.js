// Proxy LLM con routing inteligente por intent:
//
//   intent: 'chat'       → Claude Haiku (Anthropic) — evaluación + wizard
//   intent: 'extraction' → Claude Haiku (Anthropic) — extracción semántica
//   intent: 'generation' → Claude Sonnet (Anthropic) — genera 3 HTMLs nuevos
//   intent: 'redesign'   → Claude Sonnet (Anthropic) — regenera HTML existente
//
// Features:
//   - Rate limiting distribuido via Upstash Redis por IP + intent
//   - Validación de input: longitud máxima, sección válida
//   - Inyección de contexto histórico comprimido por sección
//   - CORS centralizado via _lib/cors.js

import Anthropic from '@anthropic-ai/sdk';
import { RATE_LIMITS, checkRateLimit, getBrief, getMessages, touchSession, compressBriefForSection, getSessionCostUsd, trackTokenUsage } from './_lib/redis.js';
import { applyCors } from './_lib/cors.js';

// Habilita respuestas streaming (SSE) en Vercel Node functions
export const config = { supportsResponseStreaming: true };

const ANTHROPIC_MODELS = {
  generation: 'claude-sonnet-4-6',
  redesign:   'claude-sonnet-4-6',
  chat:       'claude-haiku-4-5-20251001',
  extraction: 'claude-haiku-4-5-20251001',
};

const VALID_SECTIONS  = new Set(['evaluating', 'hero', 'sobre_mi', 'servicios', 'testimonios', 'contacto', 'diseno']);
const VALID_INTENTS   = new Set(['chat', 'generation', 'redesign', 'extraction']);
const MAX_MSG_CONTENT_CHAT = 3000;  // chars por mensaje en chat/extraction
const MAX_MESSAGES         = 20;    // mensajes por request

const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function buildContextBlock(sessionId, currentSection) {
  const [rawBrief, allMessages] = await Promise.all([
    getBrief(sessionId),
    getMessages(sessionId, 60),
  ]);

  let block = '';

  // Inyectar solo los campos del brief relevantes para la sección actual
  const compressed = rawBrief ? compressBriefForSection(rawBrief, currentSection) : null;
  if (compressed && Object.keys(compressed).length > 0) {
    block += `\n\n--- DATOS YA RECOLECTADOS (no volver a preguntar) ---\n`;
    block += JSON.stringify(compressed);
    block += `\n--- FIN DATOS ---`;
  }

  // Solo mensajes de secciones ANTERIORES, máx. 10
  const sectionOrder = ['evaluating', 'hero', 'sobre_mi', 'servicios', 'testimonios', 'contacto', 'diseno'];
  const currentIdx   = sectionOrder.indexOf(currentSection);
  const prevMessages = allMessages
    .filter(m => m.section && sectionOrder.indexOf(m.section) >= 0 && sectionOrder.indexOf(m.section) < currentIdx)
    .slice(-10);

  if (prevMessages.length > 0) {
    block += `\n\n--- CONVERSACIÓN PREVIA (solo referencia) ---\n`;
    for (const m of prevMessages) {
      const role = m.role === 'user' ? 'Cliente' : 'Asistente';
      // Truncar mensajes largos en el contexto
      const content = m.content.length > 200 ? m.content.slice(0, 200) + '…' : m.content;
      block += `[${m.section}] ${role}: ${content}\n`;
    }
    block += `--- FIN CONVERSACIÓN PREVIA ---`;
  }

  if (block) {
    block = `\n\nCONTEXTO DE SESIÓN:${block}\n\nUsa este contexto para inferir datos ya mencionados. No hagas preguntas sobre datos que ya están registrados.`;
  }

  return block;
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    model      = 'claude-haiku-4-5-20251001',
    system,
    messages   = [],
    max_tokens = 1024,
    intent     = 'chat',
    session_id,
    section,
  } = req.body || {};

  // ── Validación de input ────────────────────────────────────────────────────
  if (!VALID_INTENTS.has(intent)) {
    return res.status(400).json({ error: `intent inválido: ${intent}` });
  }
  if (section && !VALID_SECTIONS.has(section)) {
    return res.status(400).json({ error: `section inválido: ${section}` });
  }
  if (!Array.isArray(messages) || messages.length > MAX_MESSAGES) {
    return res.status(400).json({ error: `messages debe ser array de máximo ${MAX_MESSAGES} elementos` });
  }
  if (intent === 'chat' || intent === 'extraction') {
    for (const m of messages) {
      if (typeof m.content === 'string' && m.content.length > MAX_MSG_CONTENT_CHAT) {
        return res.status(400).json({ error: `Mensaje demasiado largo (máx. ${MAX_MSG_CONTENT_CHAT} chars)` });
      }
    }
  }

  // ── Rate limiting por IP ───────────────────────────────────────────────────
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
           || req.socket?.remoteAddress
           || 'unknown';

  const limitConfig = RATE_LIMITS[intent] ?? RATE_LIMITS.chat;
  if (limitConfig.max < 999) {
    const { allowed, remaining } = await checkRateLimit(ip, intent);
    if (!allowed) {
      res.setHeader('Retry-After', limitConfig.ttl);
      const msgs = {
        generation: 'Límite diario de generación alcanzado. Intentá mañana.',
        redesign:   'Límite diario de rediseño alcanzado. Intentá mañana.',
        chat:       'Demasiadas consultas. Esperá un momento.',
      };
      return res.status(429).json({ error: msgs[intent] || msgs.chat, remaining });
    }
  }

  // ── Budget guard: verificar costo acumulado antes de llamar al LLM ──────────
  if (session_id) {
    const ars_rate       = parseFloat(process.env.ARS_USD_RATE   || '1200');
    const cost_limit_ars = parseFloat(process.env.COST_LIMIT_ARS || '4000');
    const cost_limit_usd = cost_limit_ars / ars_rate;
    const currentCostUsd = await getSessionCostUsd(session_id).catch(() => 0);
    if (currentCostUsd >= cost_limit_usd) {
      return res.status(402).json({
        error: 'budget_exceeded',
        message: 'Se alcanzó el límite de esta sesión. Escribinos a hola@martinduarte.com para continuar.',
      });
    }
  }

  // ── Actualizar actividad de sesión (para detección de abandonadas) ─────────
  if (session_id) await touchSession(session_id).catch(() => {});

  // ── Modelo y contexto ──────────────────────────────────────────────────────
  const resolvedModel = ANTHROPIC_MODELS[intent] || ANTHROPIC_MODELS.chat;

  // System en bloques: el prompt base (estable por sección) lleva cache_control
  // para aprovechar prompt caching; el contexto de sesión (dinámico, cambia por
  // turno) va en un bloque aparte sin cache para no invalidar el prefijo.
  const systemBlocks = [];
  if (system) {
    systemBlocks.push({ type: 'text', text: system, cache_control: { type: 'ephemeral' } });
  }
  if (session_id && section && intent === 'chat') {
    const contextBlock = await buildContextBlock(session_id, section);
    if (contextBlock) systemBlocks.push({ type: 'text', text: contextBlock });
  }

  const llmParams = {
    model:     resolvedModel,
    max_tokens,
    system:    systemBlocks.length > 0 ? systemBlocks : undefined,
    messages,
  };

  console.log(`[claude] intent=${intent} model=${resolvedModel} section=${section || '-'}`);

  const isStreamingIntent = intent === 'generation' || intent === 'redesign';

  try {
    if (isStreamingIntent) {
      // SSE: al emitir bytes apenas empieza la generación, la función no muere
      // por timeout de inicio de respuesta y el cliente ve progreso real.
      res.writeHead(200, {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection':    'keep-alive',
      });

      const stream = anthropicClient.messages.stream(llmParams);

      stream.on('text', (delta) => {
        res.write(`event: delta\ndata: ${JSON.stringify({ t: delta })}\n\n`);
      });

      const final = await stream.finalMessage();

      if (session_id && final.usage) {
        trackTokenUsage(session_id, resolvedModel,
          final.usage.input_tokens, final.usage.output_tokens).catch(() => {});
      }

      res.write(`event: done\ndata: ${JSON.stringify({ stop_reason: final.stop_reason })}\n\n`);
      return res.end();
    }

    const response = await anthropicClient.messages.create(llmParams);
    // Acumular costo de tokens en Redis (fire-and-forget, no bloquea la respuesta)
    if (session_id && response.usage) {
      trackTokenUsage(session_id, resolvedModel,
        response.usage.input_tokens, response.usage.output_tokens).catch(() => {});
    }
    return res.status(200).json(response);
  } catch (err) {
    console.error(`[claude]`, err.status, err.message?.slice(0, 100));
    if (isStreamingIntent && res.headersSent) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'generation_failed' })}\n\n`);
      return res.end();
    }
    if (err.status === 429) return res.status(429).json({ error: 'Rate limit del LLM. Reintentá en un momento.' });
    if (err.status === 401) return res.status(500).json({ error: 'Error de autenticación con el LLM.' });
    return res.status(500).json({ error: 'Error al contactar el LLM' });
  }
}
