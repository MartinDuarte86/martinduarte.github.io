// Recupera la sesión completa desde Upstash Redis.

import { getBrief, getSessionMeta, getMessages, getPreviews } from './_lib/redis.js';
import { applyCors } from './_lib/cors.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: 'session_id requerido' });

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
