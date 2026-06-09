import { applyCors } from './_lib/cors.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email requerido' });

  const key = process.env.ABSTRACT_API_KEY;
  if (!key) {
    // No revelar qué key falta — respuesta genérica que no bloquea el flujo
    return res.status(200).json({ deliverable: true, disposable: false, reason: 'UNCHECKED' });
  }

  try {
    const url = `https://emailvalidation.abstractapi.com/v1/?api_key=${key}&email=${encodeURIComponent(email)}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Abstract API: ${r.status}`);
    const data = await r.json();

    return res.status(200).json({
      deliverable: data.deliverability === 'DELIVERABLE',
      disposable:  data.is_disposable_email?.value === true,
      reason:      data.deliverability,
    });
  } catch (err) {
    console.error('[validate-email]', err.message);
    // Si el servicio externo falla, dejamos pasar al usuario (no bloqueante)
    return res.status(200).json({ deliverable: true, disposable: false, reason: 'ERROR' });
  }
}
