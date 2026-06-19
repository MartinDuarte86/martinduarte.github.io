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

    const LIMIT = 5;
    // Pool amplio para poder elegir al azar entre varios candidatos sin sesgar por fecha.
    const POOL = 50;

    if (rubro) {
      const { data: sameRubro } = await supabase
        .from('design_sets')
        .select('id, rubro, template_name, html_preview, created_at')
        .eq('visible_en_carousel', true)
        .eq('rubro', rubro)
        .order('created_at', { ascending: false })
        .limit(LIMIT);

      if (sameRubro && sameRubro.length >= LIMIT) {
        return res.status(200).json({ designs: formatDesigns(sameRubro) });
      }

      const existingIds = (sameRubro || []).map(d => d.id);
      const needed       = LIMIT - (sameRubro?.length || 0);
      const { data: othersPool } = await supabase
        .from('design_sets')
        .select('id, rubro, template_name, html_preview, created_at')
        .eq('visible_en_carousel', true)
        .not('id', 'in', `(${existingIds.join(',') || '00000000-0000-0000-0000-000000000000'})`)
        .limit(POOL);

      const others = shuffle(othersPool || []).slice(0, needed);
      return res.status(200).json({ designs: formatDesigns([...(sameRubro || []), ...others]) });
    }

    const { data: pool, error } = await supabase
      .from('design_sets')
      .select('id, rubro, template_name, html_preview, created_at')
      .eq('visible_en_carousel', true)
      .limit(POOL);
    if (error) throw error;

    const randomFive = shuffle(pool || []).slice(0, LIMIT);
    return res.status(200).json({ designs: formatDesigns(randomFive) });

  } catch (err) {
    console.error('[get-dsn-html]', err.message);
    return res.status(500).json({ error: 'Error al recuperar diseños' });
  }
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
