// Notifica a Martín cuando un cliente completó el flujo y eligió un diseño.
// También envía un email de confirmación al cliente.
//
// Además multiplexa (mismo patrón que save-client.js con su campo `action`):
//   - POST { action: 'session_summary', session_id, trigger } → resumen interno
//     por LLM de una sesión que pidió derivación o todavía no completó la compra.
//   - GET con Authorization: Bearer CRON_SECRET → barrido diario de sesiones
//     abiertas (Redis `sessions:open`) que quedaron abandonadas, mismo resumen.
// Esto evita sumar un archivo nuevo a api/ — el plan de Vercel (Hobby) ya está
// en el tope de 12 funciones serverless.

import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import Anthropic from '@anthropic-ai/sdk';
import {
  savePreviews, getBrief, getMessages, getSessionMeta,
  getOpenSessions, removeOpenSession, isSessionAbandoned, checkRateLimit,
} from './_lib/redis.js';
import { applyCors } from './_lib/cors.js';
import supabase from './_lib/supabase.js';
import { RESUMEN_INTERNO_PROMPT } from './_lib/summaryPrompt.js';

const resend  = new Resend(process.env.RESEND_API_KEY);
const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const BASE_URL = process.env.BASE_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

function generateApprovalToken(payload, action) {
  return jwt.sign(
    { ...payload, action, iat: Math.floor(Date.now() / 1000) },
    process.env.APPROVAL_SECRET,
    { expiresIn: '48h' }
  );
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Resumen interno (LLM) de una sesión que no llegó a completar la compra ───

async function buildSessionReport(sessionId) {
  const [brief, messages, meta] = await Promise.all([
    getBrief(sessionId),
    getMessages(sessionId, 60),
    getSessionMeta(sessionId),
  ]);

  if (!brief && messages.length === 0) return null; // nada que resumir

  let context = '';
  if (brief)  context += `BRIEF PARCIAL:\n${JSON.stringify(brief)}\n\n`;
  if (meta)   context += `META DE SESIÓN:\n${JSON.stringify(meta)}\n\n`;
  if (messages.length > 0) {
    context += 'MENSAJES:\n';
    for (const m of messages) {
      const role = m.role === 'user' ? 'Cliente' : 'Asistente';
      context += `[${m.section || '-'}] ${role}: ${m.content}\n`;
    }
  }

  const response = await anthropicClient.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system:     RESUMEN_INTERNO_PROMPT,
    messages:   [{ role: 'user', content: context }],
  });

  return response.content?.[0]?.text?.trim() || null;
}

async function sendSessionSummaryEmail(sessionId, trigger, reportText) {
  const refCode = sessionId.slice(0, 8).toUpperCase();
  const triggerLabels = {
    derivacion_explicita:      'Pidió hablar con Martín (botón del header)',
    derivacion_explicita_chat: 'Pidió hablar con Martín (lo escribió en el chat)',
    abandono_tab:              'Cerró/abandonó la conversación sin terminar',
    cron_sweep:                'Sesión abandonada detectada en el barrido diario',
  };

  const { error } = await resend.emails.send({
    from:    process.env.EMAIL_FROM || 'Landing Bot <noreply@martinduarte.com>',
    to:      'martynduarte@gmail.com',
    subject: `[Resumen interno] ${triggerLabels[trigger] || trigger} — sesión ${refCode}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2>Resumen interno — sesión ${refCode}</h2>
        <p style="color:#666"><b>Motivo:</b> ${escapeHtml(triggerLabels[trigger] || trigger)}</p>
        <hr style="border:1px solid #eee">
        <pre style="white-space:pre-wrap;font-family:sans-serif;font-size:14px">${escapeHtml(reportText)}</pre>
      </div>`,
  });

  if (error) console.error('[notify] Error email resumen interno:', error.message);
}

async function handleSessionSummary(req, res) {
  const { session_id, trigger } = req.body || {};
  if (!session_id) return res.status(400).json({ error: 'session_id requerido' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
           || req.socket?.remoteAddress
           || 'unknown';
  const { allowed } = await checkRateLimit(ip, 'session_summary');
  if (!allowed) return res.status(429).json({ error: 'Demasiados resúmenes solicitados.' });

  try {
    const reportText = await buildSessionReport(session_id);
    if (reportText) await sendSessionSummaryEmail(session_id, trigger || 'desconocido', reportText);
    await removeOpenSession(session_id).catch(() => {});
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[notify] Error en resumen de sesión:', err.message);
    return res.status(500).json({ error: 'Error al generar el resumen' });
  }
}

// ── Barrido diario de sesiones abandonadas (Vercel Cron) ─────────────────────

async function handleCronSweep(req, res) {
  const auth = req.headers['authorization'] || '';
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const openSessions = await getOpenSessions().catch(() => []);
  let processed = 0;

  for (const sessionId of openSessions) {
    try {
      const abandoned = await isSessionAbandoned(sessionId);
      if (!abandoned) continue; // todavía activa, dejarla para el próximo barrido

      const reportText = await buildSessionReport(sessionId);
      if (reportText) await sendSessionSummaryEmail(sessionId, 'cron_sweep', reportText);
      await removeOpenSession(sessionId);
      processed++;
    } catch (err) {
      console.error(`[notify] Error procesando sesión ${sessionId} en cron sweep:`, err.message);
    }
  }

  return res.status(200).json({ ok: true, processed, total: openSessions.length });
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method === 'GET') return handleCronSweep(req, res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (req.body?.action === 'session_summary') return handleSessionSummary(req, res);

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
    briefLines.push(`<b>Marca:</b> ${full_brief?.nombre_marca || nombre_marca}`);
    if (full_brief?.slogan)            briefLines.push(`<b>Slogan:</b> ${full_brief.slogan}`);
    if (rubro)                         briefLines.push(`<b>Rubro:</b> ${rubro}`);
    if (full_brief?.servicios?.length) {
      const svcs = full_brief.servicios.map(s => `• ${s.nombre}`).join('<br>');
      briefLines.push(`<b>Servicios:</b><br>${svcs}`);
    }
    if (full_brief?.contacto_wsp)      briefLines.push(`<b>WhatsApp:</b> ${full_brief.contacto_wsp}`);
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

    await removeOpenSession(session_id).catch(() => {});

    return res.status(200).json({ ok: true, preview_url: previewUrl });

  } catch (err) {
    console.error('[notify]', err.message);
    return res.status(500).json({ error: 'Error al notificar' });
  }
}
