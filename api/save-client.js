// api/save-client.js
// Guarda y actualiza clientes en Supabase PostgreSQL.
// Reemplaza la versión anterior que escribía clientes.json en GitHub (race condition).

import supabase from './_lib/supabase.js';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return res.status(204).set(headers).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).set(headers).json({ error: 'Method not allowed' });
  }

  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  const { action, session_id, email, data } = req.body || {};

  if (!session_id) {
    return res.status(400).json({ error: 'session_id requerido' });
  }

  try {
    // ── Crear nuevo cliente ────────────────────────────────────────────────
    if (action === 'create') {
      // Verificar email duplicado
      if (email) {
        const { data: existing } = await supabase
          .from('clients')
          .select('id, session_id, estado, nombre_marca')
          .eq('email', email)
          .maybeSingle();

        if (existing) {
          return res.status(409).json({
            error: 'email_exists',
            session_id: existing.session_id,
            id: existing.session_id,
            estado: existing.estado,
            nombre: existing.nombre_marca,
          });
        }
      }

      const { data: client, error } = await supabase
        .from('clients')
        .insert({
          session_id,
          email:        data?.email || email,
          nombre_marca: data?.nombre_marca,
          rubro:        data?.rubro,
          estado:       'iniciado',
          full_brief:   data?.full_brief || null,
          mp_external_reference: session_id, // el session_id ES la referencia de pago
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json({ ok: true, client_id: client.id });
    }

    // ── Actualizar estado o brief ──────────────────────────────────────────
    if (action === 'update') {
      const updates = {};
      if (data?.estado)       updates.estado       = data.estado;
      if (data?.full_brief)   updates.full_brief   = data.full_brief;
      if (data?.template_elegido) updates.template_elegido = data.template_elegido;
      if (data?.nombre_marca) updates.nombre_marca = data.nombre_marca;
      if (data?.rubro)        updates.rubro        = data.rubro;
      if (data?.gist_id)      updates.gist_id      = data.gist_id;

      const { error } = await supabase
        .from('clients')
        .update(updates)
        .eq('session_id', session_id);

      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    // ── Guardar feedback de diseño ─────────────────────────────────────────
    if (action === 'feedback') {
      const { error } = await supabase
        .from('clients')
        .update({
          template_elegido: data?.template_elegido,
          estado: 'diseños_generados',
        })
        .eq('session_id', session_id);

      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: `Acción desconocida: ${action}` });

  } catch (err) {
    console.error('[save-client]', err);
    return res.status(500).json({ error: 'Error al guardar cliente', detail: err.message });
  }
}
