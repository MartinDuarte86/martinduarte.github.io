// Devuelve el HTML de diseños del DSN para el carousel de rediseño.

import supabase from './_lib/supabase.js';
import { applyCors } from './_lib/cors.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id, rubro, session_id } = req.query;

  try {
    if (id) {
      const { data, error } = await supabase
        .from('design_sets')
        .select('id, rubro, template_name, html_preview, created_at')
        .eq('id', id)
        .single();

      if (error || !data) return res.status(404).json({ error: 'Diseño no encontrado' });

      return res.status(200).json({
        id:            data.id,
        rubro:         data.rubro,
        template_name: data.template_name,
        html:          data.html_preview,
        created_at:    data.created_at,
      });
    }

    let query = supabase
      .from('design_sets')
      .select('id, rubro, template_name, html_preview, created_at')
      .eq('visible_en_carousel', true)
      .order('created_at', { ascending: false })
      .limit(6);

    if (rubro) {
      const { data: sameRubro } = await supabase
        .from('design_sets')
        .select('id, rubro, template_name, html_preview, created_at')
        .eq('visible_en_carousel', true)
        .eq('rubro', rubro)
        .order('created_at', { ascending: false })
        .limit(6);

      if (sameRubro && sameRubro.length >= 3) {
        return res.status(200).json({ designs: formatDesigns(sameRubro) });
      }

      const existingIds = (sameRubro || []).map(d => d.id);
      const needed      = 6 - (sameRubro?.length || 0);
      const { data: others } = await supabase
        .from('design_sets')
        .select('id, rubro, template_name, html_preview, created_at')
        .eq('visible_en_carousel', true)
        .not('id', 'in', `(${existingIds.join(',') || '00000000-0000-0000-0000-000000000000'})`)
        .order('created_at', { ascending: false })
        .limit(needed);

      return res.status(200).json({ designs: formatDesigns([...(sameRubro || []), ...(others || [])]) });
    }

    const { data, error } = await query;
    if (error) throw error;
    return res.status(200).json({ designs: formatDesigns(data || []) });

  } catch (err) {
    console.error('[get-dsn-html]', err.message);
    return res.status(500).json({ error: 'Error al recuperar diseños' });
  }
}

function formatDesigns(designs) {
  return designs.map(d => ({
    id:            d.id,
    rubro:         d.rubro,
    template_name: d.template_name,
    html:          d.html_preview,
    created_at:    d.created_at,
  }));
}
