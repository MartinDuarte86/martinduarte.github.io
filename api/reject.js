// api/reject.js
// Rechaza el deploy de una landing page.
// Misma lógica de seguridad JWT que approve.js.

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { isTokenUsed, markTokenUsed } from './lib/redis.js';
import supabase from './lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;

  if (!token) {
    return res.status(400).send(errorPage('Token faltante', 'El link de rechazo no contiene un token válido.'));
  }

  // ── 1. Verificar firma y expiración ───────────────────────────────────────
  let payload;
  try {
    payload = jwt.verify(token, process.env.APPROVAL_SECRET);
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? 'Este link expiró (48 horas).'
      : 'Token inválido o manipulado.';
    return res.status(401).send(errorPage('Link inválido', msg));
  }

  if (payload.action !== 'reject') {
    return res.status(400).send(errorPage('Acción incorrecta', 'Este es un link de aprobación, no de rechazo.'));
  }

  // ── 2. One-time-use ───────────────────────────────────────────────────────
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const alreadyUsed = await isTokenUsed(tokenHash);
  if (alreadyUsed) {
    return res.status(410).send(errorPage('Link ya utilizado', 'Este link de rechazo ya fue usado.'));
  }
  await markTokenUsed(tokenHash);

  const { session_id, nombre_marca } = payload;

  try {
    // ── 3. Actualizar estado en Supabase ─────────────────────────────────────
    await supabase
      .from('clients')
      .update({ estado: 'rechazado' })
      .eq('session_id', session_id);

    // Nota: no eliminamos los previews de Redis — expiran solos en 48h.
    // El diseño ya fue guardado en design_sets (DSN) al momento de notify.

    return res.status(200).send(successPage(
      '❌ Deploy rechazado',
      `El pedido de <strong>${nombre_marca}</strong> fue rechazado y no se hará deploy.`
    ));

  } catch (err) {
    console.error('[reject]', err);
    return res.status(500).send(errorPage('Error interno', err.message));
  }
}

function successPage(title, msg) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fff7ed}
  .card{background:#fff;border-radius:12px;padding:40px;max-width:500px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.08)}
  h1{color:#ea580c}</style></head>
  <body><div class="card"><h1>${title}</h1><p>${msg}</p></div></body></html>`;
}

function errorPage(title, msg) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fef2f2}
  .card{background:#fff;border-radius:12px;padding:40px;max-width:500px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.08)}
  h1{color:#dc2626}</style></head>
  <body><div class="card"><h1>❌ ${title}</h1><p>${msg}</p></div></body></html>`;
}
