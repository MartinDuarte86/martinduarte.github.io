// api/save-dsn.js
// Guarda sets de diseños (DSN — diseños anteriores) en Supabase PostgreSQL.
// Reemplaza la versión anterior que escribía en dsn/ del repo GitHub (race condition).
//
// Los HTMLs de previews viven en Redis (TTL 48h) mientras la sesión está activa.
// Al llamar este endpoint, los diseños pasan a estar disponibles como "diseños anteriores"
// para el carousel de nuevas sesiones.

import supabase from './_lib/supabase.js';
import { getPreviews } from './_lib/redis.js';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') return res.status(204).set(headers).end();
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  // ── GET: recuperar DSN para el carousel ───────────────────────────────────
  if (req.method === 'GET') {
    const { rubro } = req.query;

    let query = supabase
      .from('design_sets')
      .select('id, rubro, template_name, thumbnail_url, created_at')
      .eq('visible_en_carousel', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (rubro) query = query.eq('rubro', rubro);

    const { data, error } = await query;
    if (error) throw error;
    return res.status(200).json({ sets: data });
  }

  // ── POST: guardar un diseño al finalizar la sesión ─────────────────────────
  if (req.method === 'POST') {
    const { session_id, client_id, rubro, template_name, html } = req.body || {};

    if (!session_id || !rubro || !template_name) {
      return res.status(400).json({ error: 'session_id, rubro y template_name son requeridos' });
    }

    // Si no se provee el HTML directamente, intentar recuperar de Redis
    let htmlContent = html;
    if (!htmlContent) {
      const previews = await getPreviews(session_id);
      const match = previews?.find(p => p.templateName === template_name);
      htmlContent = match?.html || null;
    }

    const { data: dsn, error } = await supabase
      .from('design_sets')
      .insert({
        session_id,
        client_id:    client_id || null,
        rubro,
        template_name,
        html_preview: htmlContent,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[save-dsn]', error);
      return res.status(500).json({ error: 'Error al guardar diseño', detail: error.message });
    }

    return res.status(201).json({ ok: true, dsn_id: dsn.id });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
