// api/get-session.js
// Recupera la sesión completa desde Upstash Redis.
// Llamado desde chat.js al cargar la página: si existe sesión previa en localStorage,
// permite al cliente retomar el wizard desde donde lo dejó.

import { getBrief, getSessionMeta, getMessages, getPreviews } from './_lib/redis.js';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') return res.status(204).set(headers).end();
  if (req.method !== 'GET') return res.status(405).set(headers).json({ error: 'Method not allowed' });
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  const { session_id } = req.query;

  if (!session_id) {
    return res.status(400).json({ error: 'session_id requerido' });
  }

  try {
    const [meta, brief, messages, previews] = await Promise.all([
      getSessionMeta(session_id),
      getBrief(session_id),
      getMessages(session_id),
      getPreviews(session_id),
    ]);

    // Si no existe ningún dato, la sesión expiró o nunca existió
    if (!meta && !brief) {
      return res.status(404).json({ found: false });
    }

    return res.status(200).json({
      found:    true,
      meta,
      brief,
      messages,
      previews,
    });

  } catch (err) {
    console.error('[get-session]', err);
    return res.status(500).json({ error: 'Error al recuperar sesión', detail: err.message });
  }
}
