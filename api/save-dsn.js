// Guarda sets de diseños (DSN) en Supabase PostgreSQL.

import supabase from './_lib/supabase.js';
import { getPreviews, getCachedRubroTemplate, setCachedRubroTemplate } from './_lib/redis.js';
import { applyCors } from './_lib/cors.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, GET, OPTIONS')) return;

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

  if (req.method === 'POST') {
    const { session_id, client_id, rubro, template_name, html } = req.body || {};

    if (!session_id || !rubro || !template_name) {
      return res.status(400).json({ error: 'session_id, rubro y template_name son requeridos' });
    }

    let htmlContent = html;
    if (!htmlContent) {
      const previews = await getPreviews(session_id);
      const match = previews?.find(p => p.templateName === template_name);
      htmlContent = match?.html || null;
    }

    // Cachear en Redis por rubro para reducir generaciones futuras (~60% ahorro)
    if (htmlContent && rubro && template_name) {
      await setCachedRubroTemplate(rubro, template_name, htmlContent).catch(() => {});
    }

    const { data: dsn, error } = await supabase
      .from('design_sets')
      .insert({ session_id, client_id: client_id || null, rubro, template_name, html_preview: htmlContent })
      .select('id')
      .single();

    if (error) {
      console.error('[save-dsn]', error.message);
      return res.status(500).json({ error: 'Error al guardar diseño' });
    }

    return res.status(201).json({ ok: true, dsn_id: dsn.id });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
