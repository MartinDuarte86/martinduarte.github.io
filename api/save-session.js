// Persiste la sesión en Upstash Redis (TTL 48h).

import { saveBrief, saveSessionMeta, appendMessage, touchSession } from './_lib/redis.js';
import { applyCors } from './_lib/cors.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { session_id, type, payload } = req.body || {};

  if (!session_id || !type) {
    return res.status(400).json({ error: 'session_id y type son requeridos' });
  }

  try {
    // Renovar actividad para detección de sesiones abandonadas
    await touchSession(session_id).catch(() => {});

    switch (type) {
      case 'brief':
        await saveBrief(session_id, payload);
        break;

      case 'message':
        if (!payload?.role || !payload?.content) {
          return res.status(400).json({ error: 'payload debe tener role y content' });
        }
        await appendMessage(session_id, payload);
        break;

      case 'messages_batch':
        if (!Array.isArray(payload)) {
          return res.status(400).json({ error: 'payload debe ser un array' });
        }
        for (const msg of payload) {
          await appendMessage(session_id, msg);
        }
        break;

      case 'meta':
        await saveSessionMeta(session_id, payload);
        break;

      default:
        return res.status(400).json({ error: `Tipo desconocido: ${type}` });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('[save-session]', err.message);
    return res.status(500).json({ error: 'Error al guardar sesión' });
  }
}
