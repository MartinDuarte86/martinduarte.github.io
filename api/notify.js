// Notifica a Martín cuando un cliente completó el flujo y eligió un diseño.
// También envía un email de confirmación al cliente.

import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import { savePreviews } from './_lib/redis.js';
import { applyCors } from './_lib/cors.js';
import supabase from './_lib/supabase.js';

const resend  = new Resend(process.env.RESEND_API_KEY);
const BASE_URL = process.env.BASE_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

function generateApprovalToken(payload, action) {
  return jwt.sign(
    { ...payload, action, iat: Math.floor(Date.now() / 1000) },
    process.env.APPROVAL_SECRET,
    { expiresIn: '48h' }
  );
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    session_id,
    client_id,
    nombre_marca,
    rubro,
    email_cliente,
    template_elegido,
    secciones,
    full_brief,
    html_preview,
    all_previews,
  } = req.body || {};

  if (!session_id || !nombre_marca || !template_elegido) {
    return res.status(400).json({ error: 'session_id, nombre_marca y template_elegido son requeridos' });
  }

  try {
    // ── 1. Guardar previews en Redis ─────────────────────────────────────────
    if (all_previews?.length) {
      await savePreviews(session_id, all_previews);
    }

    // ── 2. Guardar diseño elegido en design_sets ─────────────────────────────
    if (html_preview && rubro && template_elegido) {
      await supabase.from('design_sets').insert({
        session_id,
        client_id:           client_id || null,
        rubro,
        template_name:       template_elegido,
        html_preview,
        visible_en_carousel: true,
      });
    }

    // ── 3. Actualizar estado del cliente ─────────────────────────────────────
    await supabase
      .from('clients')
      .update({ estado: 'pago_pendiente', template_elegido, full_brief: full_brief || null })
      .eq('session_id', session_id);

    // ── 4. Generar tokens JWT para approve/reject ────────────────────────────
    const tokenPayload = {
      session_id,
      client_id:   client_id || null,
      nombre_marca,
      rubro:       rubro || '',
      template:    template_elegido,
    };

    const approveToken = generateApprovalToken(tokenPayload, 'approve');
    const rejectToken  = generateApprovalToken(tokenPayload, 'reject');
    const approveUrl   = `${BASE_URL}/api/approve?token=${approveToken}`;
    const rejectUrl    = `${BASE_URL}/api/reject?token=${rejectToken}`;
    const previewUrl   = `${BASE_URL}/landing_page/preview.html?session_id=${session_id}`;

    // ── 5. Email a Martín (notificación operativa) ──────────────────────────
    const briefLines = [];
    if (full_brief?.hero)              briefLines.push(`<b>Marca:</b> ${full_brief.hero.nombre_marca || nombre_marca}`);
    if (full_brief?.hero?.slogan)      briefLines.push(`<b>Slogan:</b> ${full_brief.hero.slogan}`);
    if (rubro)                         briefLines.push(`<b>Rubro:</b> ${rubro}`);
    if (full_brief?.servicios?.servicios?.length) {
      const svcs = full_brief.servicios.servicios.map(s => `• ${s.nombre}`).join('<br>');
      briefLines.push(`<b>Servicios:</b><br>${svcs}`);
    }
    if (full_brief?.contacto?.contacto_wsp) briefLines.push(`<b>WhatsApp:</b> ${full_brief.contacto.contacto_wsp}`);
    if (email_cliente)                 briefLines.push(`<b>Email:</b> ${email_cliente}`);

    const { error: emailError } = await resend.emails.send({
      from:    process.env.EMAIL_FROM || 'Landing Bot <noreply@martinduarte.com>',
      to:      'martynduarte@gmail.com',
      subject: `Nuevo cliente — ${nombre_marca} [${rubro || 'sin rubro'}]`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2>Nuevo cliente — Landing Page</h2>
          <hr style="border:1px solid #eee">
          ${briefLines.map(l => `<p style="margin:6px 0">${l}</p>`).join('')}
          <p><b>Template:</b> ${template_elegido}</p>
          <p><b>Estado:</b> <span style="color:#e67e22">⏳ PENDIENTE DE CONFIRMACIÓN</span></p>
          <hr style="border:1px solid #eee;margin:20px 0">
          <p><a href="${previewUrl}" style="background:#1a1a1a;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px">👁 Ver preview (48h)</a></p>
          <br>
          <p>
            <a href="${approveUrl}" style="background:#27ae60;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;margin-right:10px">✅ Aprobar</a>
            <a href="${rejectUrl}"  style="background:#e74c3c;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px">❌ Rechazar</a>
          </p>
          <p style="color:#999;font-size:12px">Links expiran en 48h y solo pueden usarse una vez.</p>
        </div>`,
    });

    if (emailError) console.error('[notify] Error email Martín:', emailError.message);

    // ── 6. Email de confirmación al cliente ──────────────────────────────────
    if (email_cliente) {
      const nombreCliente = full_brief?.hero?.nombre_marca || nombre_marca;
      const { error: clientEmailError } = await resend.emails.send({
        from:    process.env.EMAIL_FROM || 'Landing Bot <noreply@martinduarte.com>',
        to:      email_cliente,
        subject: `Tu solicitud de landing page fue recibida — ${nombre_marca}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#1a1a1a">¡Tu solicitud fue recibida!</h2>
            <p>Hola, te confirmamos que recibimos tu pedido de landing page para <strong>${nombreCliente}</strong>.</p>
            <p>Un diseñador se va a contactar con vos en las próximas 24-48 horas para revisar el diseño seleccionado y coordinar los ajustes finales.</p>
            <hr style="border:1px solid #eee;margin:20px 0">
            <p><b>Template elegido:</b> ${template_elegido}</p>
            ${rubro ? `<p><b>Rubro:</b> ${rubro}</p>` : ''}
            <hr style="border:1px solid #eee;margin:20px 0">
            <p style="color:#666;font-size:14px">Si tenés alguna duda escribinos a <a href="mailto:hola@martinduarte.com">hola@martinduarte.com</a></p>
          </div>`,
      });

      if (clientEmailError) console.error('[notify] Error email cliente:', clientEmailError.message);
    }

    return res.status(200).json({ ok: true, preview_url: previewUrl });

  } catch (err) {
    console.error('[notify]', err.message);
    return res.status(500).json({ error: 'Error al notificar' });
  }
}
