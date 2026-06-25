// Recupera la sesión completa desde Upstash Redis.

import { getBrief, getSessionMeta, getMessages, getPreviews } from './_lib/redis.js';
import { applyCors } from './_lib/cors.js';
import { requireSession } from './_lib/session.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // El session_id sale de la cookie firmada, NO del query: así una sesión solo la
  // puede leer su dueño (cierra el IDOR de lectura / mezcla de conversaciones).
  const session_id = requireSession(req, res);
  if (!session_id) return;

  try {
    const [meta, brief, messages, previews] = await Promise.all([
      getSessionMeta(session_id),
      getBrief(session_id),
      getMessages(session_id),
      getPreviews(session_id),
    ]);

    if (!meta && !brief) {
      return res.status(404).json({ found: false });
    }

    // No incluir email en el response (PII — solo el owner de la sesión lo necesita)
    return res.status(200).json({
      found:    true,
      meta:     meta ? { phase: meta.phase, updatedAt: meta.updatedAt, progress: meta.progress } : null,
      brief,
      messages,
      previews,
    });

  } catch (err) {
    console.error('[get-session]', err.message);
    return res.status(500).json({ error: 'Error al recuperar sesión' });
  }
}
