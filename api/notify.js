// api/notify.js
// Notifica a Martín cuando un cliente completó el flujo y eligió un diseño.
// Cambios vs versión anterior:
//   - Token de approve/reject: JWT firmado con APPROVAL_SECRET (antes era base64 inseguro)
//   - Preview: guardado en Redis TTL 48h (accesible mientras la sesión está activa)
//   - Al finalizar, guarda el diseño en DSN (diseños anteriores) en Supabase

import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import { savePreviews } from './lib/redis.js';
import supabase from './lib/supabase.js';

const resend = new Resend(process.env.RESEND_API_KEY);

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());
const BASE_URL        = process.env.BASE_URL || process.env.VERCEL_URL
                          ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

/**
 * Genera un JWT firmado para approve o reject.
 * Incluye todos los datos necesarios + expiración de 48h.
 */
function generateApprovalToken(payload, action) {
  return jwt.sign(
    { ...payload, action, iat: Math.floor(Date.now() / 1000) },
    process.env.APPROVAL_SECRET,
    { expiresIn: '48h' }
  );
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') return res.status(204).set(headers).end();
  if (req.method !== 'POST') return res.status(405).set(headers).json({ error: 'Method not allowed' });
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  const {
    session_id,
    client_id,
    nombre_marca,
    rubro,
    email_cliente,
    template_elegido,
    secciones,
    full_brief,
    html_preview,     // HTML del diseño elegido
    all_previews,     // Array<{templateName, html}> — los 3 diseños generados
  } = req.body || {};

  if (!session_id || !nombre_marca || !template_elegido) {
    return res.status(400).json({ error: 'session_id, nombre_marca y template_elegido son requeridos' });
  }

  try {
    // ── 1. Guardar los 3 previews en Redis (TTL 48h) ──────────────────────────
    if (all_previews?.length) {
      await savePreviews(session_id, all_previews);
    }

    // ── 2. Guardar el diseño elegido en DSN (diseños anteriores en Supabase) ──
    if (html_preview && rubro && template_elegido) {
      await supabase.from('design_sets').insert({
        session_id,
        client_id:    client_id || null,
        rubro,
        template_name: template_elegido,
        html_preview,
        visible_en_carousel: true,
      });
    }

    // ── 3. Actualizar estado del cliente a 'pago_pendiente' ───────────────────
    await supabase
      .from('clients')
      .update({
        estado:          'pago_pendiente',
        template_elegido,
        full_brief:      full_brief || null,
      })
      .eq('session_id', session_id);

    // ── 4. Generar tokens JWT seguros ─────────────────────────────────────────
    const tokenPayload = {
      session_id,
      client_id:    client_id || null,
      nombre_marca,
      rubro:        rubro || '',
      template:     template_elegido,
    };

    const approveToken = generateApprovalToken(tokenPayload, 'approve');
    const rejectToken  = generateApprovalToken(tokenPayload, 'reject');

    const approveUrl   = `${BASE_URL}/api/approve?token=${approveToken}`;
    const rejectUrl    = `${BASE_URL}/api/reject?token=${rejectToken}`;
    // URL para ver la preview (accesible mientras la sesión esté en Redis)
    const previewUrl   = `${BASE_URL}/landing_page/preview.html?session_id=${session_id}`;

    // ── 5. Construir el brief legible para el email ────────────────────────────
    const briefLines = [];
    if (full_brief?.hero)         briefLines.push(`<b>Marca:</b> ${full_brief.hero.nombre_marca || nombre_marca}`);
    if (full_brief?.hero?.slogan) briefLines.push(`<b>Slogan:</b> ${full_brief.hero.slogan}`);
    if (rubro)                    briefLines.push(`<b>Rubro:</b> ${rubro}`);
    if (full_brief?.servicios?.servicios?.length) {
      const svcs = full_brief.servicios.servicios.map(s => `• ${s.nombre}`).join('<br>');
      briefLines.push(`<b>Servicios:</b><br>${svcs}`);
    }
    if (full_brief?.contacto?.contacto_wsp) briefLines.push(`<b>WhatsApp:</b> ${full_brief.contacto.contacto_wsp}`);
    if (email_cliente)            briefLines.push(`<b>Email cliente:</b> ${email_cliente}`);

    // ── 6. Enviar email a Martín ─────────────────────────────────────────────
    const { error: emailError } = await resend.emails.send({
      from:    process.env.EMAIL_FROM || 'Landing Bot <noreply@martinduarte.com>',
      to:      'martynduarte@gmail.com',
      subject: `🆕 Nuevo cliente — ${nombre_marca} [${rubro || 'sin rubro'}]`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#1a1a1a">Nuevo cliente — Landing Page</h2>
          <hr style="border:1px solid #eee">

          ${briefLines.map(l => `<p style="margin:6px 0">${l}</p>`).join('')}

          <p style="margin:6px 0"><b>Template elegido:</b> ${template_elegido}</p>
          <p style="margin:6px 0"><b>Session ID:</b> <code>${session_id}</code></p>
          <p style="margin:6px 0"><b>Estado pago:</b> <span style="color:#e67e22">⏳ PENDIENTE DE CONFIRMACIÓN</span></p>

          <hr style="border:1px solid #eee;margin:20px 0">

          <p><a href="${previewUrl}"
               style="background:#1a1a1a;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;margin-right:10px">
            👁 Ver preview (48h)
          </a></p>

          <br>

          <p>
            <a href="${approveUrl}"
               style="background:#27ae60;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;margin-right:10px">
              ✅ Aprobar deploy
            </a>
            <a href="${rejectUrl}"
               style="background:#e74c3c;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px">
              ❌ Rechazar
            </a>
          </p>

          <p style="color:#999;font-size:12px;margin-top:20px">
            Estos links expiran en 48 horas y solo pueden usarse una vez.
          </p>
        </div>
      `,
    });

    if (emailError) {
      console.error('[notify] Error al enviar email:', emailError);
      // No falla el flujo completo — el cliente ya eligió diseño
    }

    return res.status(200).json({ ok: true, preview_url: previewUrl });

  } catch (err) {
    console.error('[notify]', err);
    return res.status(500).json({ error: 'Error al notificar', detail: err.message });
  }
}
