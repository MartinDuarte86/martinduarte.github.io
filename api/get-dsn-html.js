// api/get-dsn-html.js
// Devuelve el HTML completo de un diseño del DSN (diseños anteriores).
// Usado por el carousel de rediseño para renderizar los diseños previos en iframes
// y para pasarle el HTML al LLM de rediseño cuando el cliente elige uno.
//
// GET /api/get-dsn-html?id=<uuid>        → HTML de un diseño específico
// GET /api/get-dsn-html?rubro=<rubro>    → Últimos 6 diseños del rubro (metadata + HTML)

import supabase from './_lib/supabase.js';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') return res.status(204).set(headers).end();
  if (req.method !== 'GET') return res.status(405).set(headers).json({ error: 'Method not allowed' });
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  const { id, rubro } = req.query;

  try {
    // ── Diseño específico por ID ───────────────────────────────────────────────
    if (id) {
      const { data, error } = await supabase
        .from('design_sets')
        .select('id, rubro, template_name, html_preview, created_at')
        .eq('id', id)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Diseño no encontrado' });
      }

      return res.status(200).json({
        id:            data.id,
        rubro:         data.rubro,
        template_name: data.template_name,
        html:          data.html_preview,
        created_at:    data.created_at,
      });
    }

    // ── Últimos N diseños para el carousel (filtrado por rubro opcional) ────────
    // Máximo 6 diseños — suficientes para el carousel de rediseño
    let query = supabase
      .from('design_sets')
      .select('id, rubro, template_name, html_preview, created_at')
      .eq('visible_en_carousel', true)
      .order('created_at', { ascending: false })
      .limit(6);

    if (rubro) {
      // Prioriza el mismo rubro pero completa con otros si hay menos de 6
      // Estrategia: primero los del mismo rubro, luego el resto
      const { data: sameRubro } = await supabase
        .from('design_sets')
        .select('id, rubro, template_name, html_preview, created_at')
        .eq('visible_en_carousel', true)
        .eq('rubro', rubro)
        .order('created_at', { ascending: false })
        .limit(6);

      if (sameRubro && sameRubro.length >= 3) {
        // Hay suficientes del mismo rubro
        return res.status(200).json({ designs: formatDesigns(sameRubro) });
      }

      // Completar con otros rubros hasta 6
      const existingIds = (sameRubro || []).map(d => d.id);
      const needed = 6 - (sameRubro?.length || 0);

      const { data: others } = await supabase
        .from('design_sets')
        .select('id, rubro, template_name, html_preview, created_at')
        .eq('visible_en_carousel', true)
        .not('id', 'in', `(${existingIds.join(',') || '00000000-0000-0000-0000-000000000000'})`)
        .order('created_at', { ascending: false })
        .limit(needed);

      const combined = [...(sameRubro || []), ...(others || [])];
      return res.status(200).json({ designs: formatDesigns(combined) });
    }

    // Sin filtro de rubro — devuelve los 6 más recientes
    const { data, error } = await query;
    if (error) throw error;

    return res.status(200).json({ designs: formatDesigns(data || []) });

  } catch (err) {
    console.error('[get-dsn-html]', err);
    return res.status(500).json({ error: 'Error al recuperar diseños', detail: err.message });
  }
}

function formatDesigns(designs) {
  return designs.map(d => ({
    id:            d.id,
    rubro:         d.rubro,
    template_name: d.template_name,
    html:          d.html_preview,  // HTML completo para iframe
    created_at:    d.created_at,
  }));
}
