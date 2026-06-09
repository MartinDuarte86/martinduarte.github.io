// api/save-session.js
// Persiste la sesión del usuario en Upstash Redis (TTL 48h).
// Llamado desde chat.js del frontend al avanzar entre fases y secciones.
//
// Datos que persiste:
//   - fullBrief: datos JSON acumulados sección por sección
//   - messages: historial completo de mensajes (todas las secciones)
//   - meta: fase actual, email, timestamps

import { saveBrief, saveSessionMeta, appendMessage } from './_lib/redis.js';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') return res.status(204).set(headers).end();
  if (req.method !== 'POST') return res.status(405).set(headers).json({ error: 'Method not allowed' });
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  const { session_id, type, payload } = req.body || {};

  if (!session_id || !type) {
    return res.status(400).json({ error: 'session_id y type son requeridos' });
  }

  try {
    switch (type) {
      // Guardar o actualizar el fullBrief completo
      case 'brief':
        await saveBrief(session_id, payload);
        break;

      // Guardar un mensaje individual (user o assistant)
      // payload: { role: 'user'|'assistant', content: string, section: string }
      case 'message':
        if (!payload?.role || !payload?.content) {
          return res.status(400).json({ error: 'payload debe tener role y content' });
        }
        await appendMessage(session_id, payload);
        break;

      // Guardar varios mensajes en batch (al cerrar una sección)
      // payload: Array<{ role, content, section }>
      case 'messages_batch':
        if (!Array.isArray(payload)) {
          return res.status(400).json({ error: 'payload debe ser un array de mensajes' });
        }
        for (const msg of payload) {
          await appendMessage(session_id, msg);
        }
        break;

      // Actualizar metadatos (fase, estado, etc.)
      case 'meta':
        await saveSessionMeta(session_id, payload);
        break;

      default:
        return res.status(400).json({ error: `Tipo desconocido: ${type}` });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('[save-session]', err);
    return res.status(500).json({ error: 'Error al guardar sesión', detail: err.message });
  }
}
