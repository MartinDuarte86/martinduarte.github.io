// api/lib/redis.js
// Cliente Upstash Redis singleton para todas las serverless functions.
// Usa REST HTTP — no requiere conexión persistente (compatible con Vercel serverless).

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

export default redis;

// ─── Helpers de sesión ─────────────────────────────────────────────────────

const SESSION_TTL = 60 * 60 * 48; // 48 horas en segundos

/**
 * Guarda o actualiza el fullBrief de una sesión.
 * @param {string} sessionId
 * @param {object} brief
 */
export async function saveBrief(sessionId, brief) {
  await redis.set(`session:${sessionId}:brief`, JSON.stringify(brief), { ex: SESSION_TTL });
}

/**
 * Recupera el fullBrief de una sesión.
 * @param {string} sessionId
 * @returns {object|null}
 */
export async function getBrief(sessionId) {
  const raw = await redis.get(`session:${sessionId}:brief`);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

/**
 * Guarda los metadatos de la sesión (fase actual, email, etc.).
 * @param {string} sessionId
 * @param {object} meta
 */
export async function saveSessionMeta(sessionId, meta) {
  const existing = await getSessionMeta(sessionId);
  const merged = { ...existing, ...meta, updatedAt: Date.now() };
  await redis.set(`session:${sessionId}:meta`, JSON.stringify(merged), { ex: SESSION_TTL });
}

/**
 * Recupera los metadatos de sesión.
 * @param {string} sessionId
 * @returns {object|null}
 */
export async function getSessionMeta(sessionId) {
  const raw = await redis.get(`session:${sessionId}:meta`);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

/**
 * Agrega un mensaje al historial global de la sesión (todas las secciones).
 * Mantiene los últimos 100 mensajes para no crecer indefinidamente.
 * @param {string} sessionId
 * @param {{ role: 'user'|'assistant', content: string, section: string }} message
 */
export async function appendMessage(sessionId, message) {
  const key = `session:${sessionId}:messages`;
  const entry = JSON.stringify({ ...message, ts: Date.now() });
  await redis.lpush(key, entry);
  await redis.ltrim(key, 0, 99);      // máximo 100 mensajes totales
  await redis.expire(key, SESSION_TTL);
}

/**
 * Recupera el historial completo de mensajes de la sesión, ordenado del más antiguo al más nuevo.
 * @param {string} sessionId
 * @param {number} limit - cuántos mensajes recuperar (default: 60)
 * @returns {Array}
 */
export async function getMessages(sessionId, limit = 60) {
  const key = `session:${sessionId}:messages`;
  const raw = await redis.lrange(key, 0, limit - 1);
  if (!raw || raw.length === 0) return [];
  return raw
    .map(m => (typeof m === 'string' ? JSON.parse(m) : m))
    .reverse(); // Redis LPUSH = más nuevo primero, revertimos para cronológico
}

/**
 * Guarda los HTMLs de previews generados (TTL 48h — solo mientras la sesión está activa).
 * @param {string} sessionId
 * @param {Array<{templateName: string, html: string}>} previews
 */
export async function savePreviews(sessionId, previews) {
  await redis.set(`session:${sessionId}:previews`, JSON.stringify(previews), { ex: SESSION_TTL });
}

/**
 * Recupera los previews de una sesión.
 * @param {string} sessionId
 * @returns {Array|null}
 */
export async function getPreviews(sessionId) {
  const raw = await redis.get(`session:${sessionId}:previews`);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

// ─── Rate limiting distribuido ──────────────────────────────────────────────

/**
 * Verifica y registra una llamada para rate limiting distribuido.
 * Atómico via Redis INCR — seguro con múltiples instancias Vercel.
 * @param {string} ip
 * @param {'chat'|'generation'} intent
 * @returns {{ allowed: boolean, remaining: number }}
 */
export async function checkRateLimit(ip, intent) {
  const limits = {
    chat:       { max: 10,  ttl: 3600  },  // 10/hora
    generation: { max: 2,   ttl: 86400 },  // 2/24h
    extraction: { max: 999, ttl: 3600  },  // sin límite práctico
  };
  const { max, ttl } = limits[intent] ?? limits.chat;
  const key = `ratelimit:${intent}:${ip}`;

  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, ttl);

  return {
    allowed:   count <= max,
    remaining: Math.max(0, max - count),
    count,
  };
}

// ─── Tokens JWT one-time-use ────────────────────────────────────────────────

/**
 * Marca un token JWT como ya usado (previene doble ejecución de approve/reject).
 * @param {string} tokenHash - SHA256 hex del token JWT
 */
export async function markTokenUsed(tokenHash) {
  await redis.set(`token:used:${tokenHash}`, 1, { ex: SESSION_TTL });
}

/**
 * Verifica si un token JWT ya fue usado.
 * @param {string} tokenHash
 * @returns {boolean}
 */
export async function isTokenUsed(tokenHash) {
  const val = await redis.get(`token:used:${tokenHash}`);
  return val !== null;
}
