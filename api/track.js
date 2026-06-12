// Tracking de eventos de funnel y negocio — costo $0 sobre el Upstash existente.
// POST { step, rubro? }  →  INCR funnel:{step}:{YYYY-MM-DD}  (TTL 90 días)
//                           INCR biz:rubro:{rubro}            (si viene rubro)

import redis from './_lib/redis.js';
import { applyCors } from './_lib/cors.js';

const VALID_STEPS = new Set([
  'modal_open',       // abrió el modal de flujo
  'registro',         // completó el registro
  'wizard_inicio',    // la evaluación aprobó → arrancó el wizard
  'seccion_3',        // llegó a la mitad del wizard (servicios completada)
  'wizard_fin',       // completó las 6 secciones (handoff)
  'preview_visto',    // vio diseños (generados o del carrusel DSN)
  'pago_click',       // hizo clic en el link de MercadoPago
  'pago_confirmado',  // confirmó el pago (venta)
]);

const TTL_90_DIAS = 60 * 60 * 24 * 90;

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { step, rubro } = req.body || {};
  if (!VALID_STEPS.has(step)) return res.status(400).json({ error: 'step inválido' });

  try {
    const day = new Date().toISOString().slice(0, 10);
    const key = `funnel:${step}:${day}`;
    await redis.incr(key);
    await redis.expire(key, TTL_90_DIAS);

    if (rubro && typeof rubro === 'string' && rubro.length <= 60) {
      const rubroKey = `biz:rubro:${rubro.toLowerCase().trim().slice(0, 60)}`;
      await redis.incr(rubroKey);
      await redis.expire(rubroKey, TTL_90_DIAS);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[track]', err.message);
    return res.status(500).json({ error: 'tracking falló' });
  }
}
