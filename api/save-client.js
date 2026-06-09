// Guarda y actualiza clientes en Supabase PostgreSQL.

import supabase from './_lib/supabase.js';
import { applyCors } from './_lib/cors.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, session_id, email, data } = req.body || {};

  if (!session_id) return res.status(400).json({ error: 'session_id requerido' });

  try {
    // ── Crear nuevo cliente ────────────────────────────────────────────────
    if (action === 'create') {
      if (email) {
        const { data: existing } = await supabase
          .from('clients')
          .select('id, session_id, estado, nombre_marca')
          .eq('email', email)
          .maybeSingle();

        if (existing) {
          return res.status(409).json({
            error:      'email_exists',
            session_id: existing.session_id,
            id:         existing.session_id,
            estado:     existing.estado,
            nombre:     existing.nombre_marca,
          });
        }
      }

      const { data: client, error } = await supabase
        .from('clients')
        .insert({
          session_id,
          email:                 data?.email || email,
          nombre_marca:          data?.nombre_marca,
          rubro:                 data?.rubro,
          estado:                'iniciado',
          full_brief:            data?.full_brief || null,
          mp_external_reference: session_id,
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json({ ok: true, client_id: client.id });
    }

    // ── Actualizar estado o brief ──────────────────────────────────────────
    if (action === 'update') {
      const updates = {};
      if (data?.estado)            updates.estado            = data.estado;
      if (data?.full_brief)        updates.full_brief        = data.full_brief;
      if (data?.template_elegido)  updates.template_elegido  = data.template_elegido;
      if (data?.nombre_marca)      updates.nombre_marca      = data.nombre_marca;
      if (data?.rubro)             updates.rubro             = data.rubro;

      const { error } = await supabase.from('clients').update(updates).eq('session_id', session_id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    // ── Feedback de diseño ─────────────────────────────────────────────────
    if (action === 'feedback') {
      const { error } = await supabase
        .from('clients')
        .update({ template_elegido: data?.template_elegido, estado: 'diseños_generados' })
        .eq('session_id', session_id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: `Acción desconocida: ${action}` });

  } catch (err) {
    console.error('[save-client]', err.message);
    return res.status(500).json({ error: 'Error al guardar cliente' });
  }
}
