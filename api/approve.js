// api/approve.js
// Aprueba el deploy de una landing page.
// Seguridad vs versión anterior (base64 inseguro):
//   - Verifica firma JWT con APPROVAL_SECRET
//   - Verifica expiración (48h)
//   - Verifica que el token no fue usado antes (one-time-use via Redis)
//   - Actualiza estado del cliente en Supabase

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { isTokenUsed, markTokenUsed } from './_lib/redis.js';
import supabase from './_lib/supabase.js';

const GH_TOKEN  = process.env.GH_TOKEN;
const GH_OWNER  = process.env.GH_OWNER;
const GH_REPO   = process.env.GH_REPO;
const BASE_URL  = process.env.BASE_URL || `https://${process.env.VERCEL_URL}`;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;

  if (!token) {
    return res.status(400).send(errorPage('Token faltante', 'El link de aprobación no contiene un token válido.'));
  }

  // ── 1. Verificar firma y expiración del JWT ───────────────────────────────
  let payload;
  try {
    payload = jwt.verify(token, process.env.APPROVAL_SECRET);
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? 'Este link expiró (48 horas). Solicitá un nuevo link al cliente.'
      : 'Token inválido o manipulado.';
    return res.status(401).send(errorPage('Link inválido', msg));
  }

  if (payload.action !== 'approve') {
    return res.status(400).send(errorPage('Acción incorrecta', 'Este es un link de rechazo, no de aprobación.'));
  }

  // ── 2. Verificar que no fue usado antes (one-time-use) ────────────────────
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const alreadyUsed = await isTokenUsed(tokenHash);
  if (alreadyUsed) {
    return res.status(410).send(errorPage('Link ya utilizado', 'Este link de aprobación ya fue usado anteriormente.'));
  }
  await markTokenUsed(tokenHash);

  const { session_id, nombre_marca, rubro, template } = payload;

  try {
    // ── 3. Actualizar estado en Supabase ─────────────────────────────────────
    await supabase
      .from('clients')
      .update({ estado: 'aprobado' })
      .eq('session_id', session_id);

    // ── 4. Disparar GitHub Actions para el deploy ─────────────────────────────
    const slug = (nombre_marca || 'cliente')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Recuperar el HTML del diseño elegido desde Supabase
    const { data: dsn } = await supabase
      .from('design_sets')
      .select('html_preview')
      .eq('session_id', session_id)
      .eq('template_name', template)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!dsn?.html_preview) {
      return res.status(404).send(errorPage(
        'Diseño no encontrado',
        'No se encontró el HTML del diseño. Puede haber expirado. Contactá al cliente para regenerar.'
      ));
    }

    const htmlBase64 = Buffer.from(dsn.html_preview).toString('base64');

    const ghResponse = await fetch(
      `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/deploy-landing.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GH_TOKEN}`,
          'Content-Type':  'application/json',
          'Accept':        'application/vnd.github+json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            cliente_slug: slug,
            html_content: htmlBase64,
          },
        }),
      }
    );

    if (!ghResponse.ok) {
      const ghError = await ghResponse.text();
      console.error('[approve] GitHub Actions error:', ghError);
      // No devolvemos error al operador — el estado ya se actualizó en Supabase
    }

    const landingUrl = `${BASE_URL}/clientes/${slug}/`;

    return res.status(200).send(successPage(
      '✅ Deploy aprobado',
      `La landing de <strong>${nombre_marca}</strong> fue aprobada. GitHub Actions está desplegando ahora.`,
      landingUrl
    ));

  } catch (err) {
    console.error('[approve]', err);
    return res.status(500).send(errorPage('Error interno', err.message));
  }
}

// ─── HTML helpers ────────────────────────────────────────────────────────────

function successPage(title, msg, url) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f0fdf4}
  .card{background:#fff;border-radius:12px;padding:40px;max-width:500px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.08)}
  h1{color:#16a34a}a{color:#16a34a}</style></head>
  <body><div class="card"><h1>${title}</h1><p>${msg}</p>
  ${url ? `<p><a href="${url}" target="_blank">Ver landing page →</a></p>` : ''}
  </div></body></html>`;
}

function errorPage(title, msg) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fef2f2}
  .card{background:#fff;border-radius:12px;padding:40px;max-width:500px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.08)}
  h1{color:#dc2626}</style></head>
  <body><div class="card"><h1>❌ ${title}</h1><p>${msg}</p></div></body></html>`;
}
