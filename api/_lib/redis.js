// Cliente Upstash Redis singleton para todas las serverless functions.
// Usa REST HTTP — no requiere conexión persistente (compatible con Vercel serverless).

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

export default redis;

const SESSION_TTL     = 60 * 60 * 48; // 48 horas
const ABANDONED_TTL   = 60 * 60 * 2;  // 2 horas sin actividad = sesión abandonada

// ─── Helpers de sesión ─────────────────────────────────────────────────────────

export async function saveBrief(sessionId, brief) {
  await redis.set(`session:${sessionId}:brief`, JSON.stringify(brief), { ex: SESSION_TTL });
}

export async function getBrief(sessionId) {
  const raw = await redis.get(`session:${sessionId}:brief`);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

export async function saveSessionMeta(sessionId, meta) {
  const existing = await getSessionMeta(sessionId);
  const merged = { ...existing, ...meta, updatedAt: Date.now() };
  await redis.set(`session:${sessionId}:meta`, JSON.stringify(merged), { ex: SESSION_TTL });
}

export async function getSessionMeta(sessionId) {
  const raw = await redis.get(`session:${sessionId}:meta`);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

export async function appendMessage(sessionId, message) {
  const key   = `session:${sessionId}:messages`;
  const entry = JSON.stringify({ ...message, ts: Date.now() });
  await redis.lpush(key, entry);
  await redis.ltrim(key, 0, 99);
  await redis.expire(key, SESSION_TTL);
}

export async function getMessages(sessionId, limit = 60) {
  const key = `session:${sessionId}:messages`;
  const raw = await redis.lrange(key, 0, limit - 1);
  if (!raw || raw.length === 0) return [];
  return raw
    .map(m => (typeof m === 'string' ? JSON.parse(m) : m))
    .reverse();
}

export async function savePreviews(sessionId, previews) {
  await redis.set(`session:${sessionId}:previews`, JSON.stringify(previews), { ex: SESSION_TTL });
}

export async function getPreviews(sessionId) {
  const raw = await redis.get(`session:${sessionId}:previews`);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

// ─── Limpieza de sesiones abandonadas ─────────────────────────────────────────
// Marca una sesión como abandonada cuando lleva más de 2h sin actividad.
// Se llama en save-session para renovar el TTL de actividad.

export async function touchSession(sessionId) {
  await redis.set(`session:${sessionId}:last_activity`, Date.now(), { ex: ABANDONED_TTL });
}

export async function isSessionAbandoned(sessionId) {
  const ts = await redis.get(`session:${sessionId}:last_activity`);
  return ts === null;
}

// ─── Cache de templates por rubro (TTL 24h) ───────────────────────────────────
// Reduce un ~60% las llamadas de generación para rubros repetidos.

const RUBRO_CACHE_TTL = 60 * 60 * 24; // 24 horas

export async function getCachedRubroTemplate(ruboCategory, templateId) {
  const key = `rubro-cache:${ruboCategory}:${templateId}`;
  const raw = await redis.get(key);
  if (!raw) return null;
  return typeof raw === 'string' ? raw : JSON.stringify(raw);
}

export async function setCachedRubroTemplate(ruboCategory, templateId, html) {
  const key = `rubro-cache:${ruboCategory}:${templateId}`;
  await redis.set(key, html, { ex: RUBRO_CACHE_TTL });
}

// ─── Rate limiting distribuido ─────────────────────────────────────────────────

const RATE_LIMITS = {
  chat:       { max: 10,  ttl: 3600  },
  generation: { max: 2,   ttl: 86400 },
  extraction: { max: 999, ttl: 3600  },
  redesign:   { max: 2,   ttl: 86400 },
};

export async function checkRateLimit(ip, intent) {
  const { max, ttl } = RATE_LIMITS[intent] ?? RATE_LIMITS.chat;
  const key = `ratelimit:${intent}:${ip}`;

  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, ttl);

  return {
    allowed:   count <= max,
    remaining: Math.max(0, max - count),
    count,
  };
}

// ─── Tokens JWT one-time-use (TOCTOU-safe via SET NX) ─────────────────────────
// SET NX es atómico — garantiza que solo la primera llamada concurrente lo marca.
// Devuelve true si el token fue marcado ahora (primer uso), false si ya estaba usado.

export async function markTokenUsedIfNew(tokenHash) {
  // SET NX retorna "OK" si se creó, null si ya existía
  const result = await redis.set(`token:used:${tokenHash}`, 1, { ex: SESSION_TTL, nx: true });
  return result !== null; // true = primer uso, false = ya usado
}

// Mantener compatibilidad con código legacy
export async function markTokenUsed(tokenHash) {
  await redis.set(`token:used:${tokenHash}`, 1, { ex: SESSION_TTL });
}

export async function isTokenUsed(tokenHash) {
  const val = await redis.get(`token:used:${tokenHash}`);
  return val !== null;
}

// ─── Compresión de brief para context injection ────────────────────────────────
// Extrae solo los campos relevantes para cada sección, evitando saturar el contexto.

const BRIEF_FIELDS_BY_SECTION = {
  evaluating: [],
  hero:       ['nombre_marca', 'rubro', 'slogan'],
  sobre_mi:   ['nombre_marca', 'rubro', 'slogan', 'tipo', 'historia'],
  servicios:  ['nombre_marca', 'rubro', 'tipo', 'diferencial'],
  testimonios:['nombre_marca', 'rubro', 'servicios'],
  contacto:   ['nombre_marca', 'rubro', 'servicios'],
  diseno:     ['nombre_marca', 'rubro', 'slogan', 'colores', 'estilo_visual', 'tono'],
};

export function compressBriefForSection(brief, section) {
  if (!brief || Object.keys(brief).length === 0) return null;
  const fields = BRIEF_FIELDS_BY_SECTION[section];
  if (!fields || fields.length === 0) return brief;

  const compressed = {};
  for (const key of fields) {
    if (brief[key] !== undefined && brief[key] !== null && brief[key] !== '') {
      compressed[key] = brief[key];
    }
  }
  return Object.keys(compressed).length > 0 ? compressed : null;
}
