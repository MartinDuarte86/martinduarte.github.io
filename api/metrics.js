// Métricas técnicas + de negocio para el dashboard admin.
// GET con Authorization: Bearer {ADMIN_TOKEN}  (o ?token= para el dashboard estático)
// Agrega: funnel (hoy + 7 días), rubros más pedidos, costo API acumulado,
// sesiones activas y diseños guardados (Supabase).

import redis from './_lib/redis.js';
import supabase from './_lib/supabase.js';
import { applyCors } from './_lib/cors.js';

const FUNNEL_STEPS = [
  'modal_open', 'registro', 'wizard_inicio', 'seccion_3',
  'wizard_fin', 'preview_visto', 'pago_click', 'pago_confirmado',
];

function lastNDays(n) {
  const days = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.now() - i * 86400000);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

async function scanSum(pattern, { count = false } = {}) {
  // Suma (o cuenta) los valores de todas las keys que matchean el patrón.
  let cursor = 0, total = 0, keys = 0;
  do {
    const [next, batch] = await redis.scan(cursor, { match: pattern, count: 100 });
    cursor = Number(next);
    keys += batch.length;
    if (!count && batch.length > 0) {
      const values = await redis.mget(...batch);
      for (const v of values) total += parseFloat(v) || 0;
    }
  } while (cursor !== 0 && keys < 2000); // tope de seguridad para el free tier
  return count ? keys : total;
}

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // ── Auth ────────────────────────────────────────────────────────────────────
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
             || req.query.token;
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const days = lastNDays(7);

    // ── Funnel: hoy + acumulado 7 días por paso ───────────────────────────────
    const funnelKeys = [];
    for (const step of FUNNEL_STEPS) for (const day of days) funnelKeys.push(`funnel:${step}:${day}`);
    const funnelValues = await redis.mget(...funnelKeys);

    const funnel = {};
    FUNNEL_STEPS.forEach((step, si) => {
      const porDia = {};
      let total7d = 0;
      days.forEach((day, di) => {
        const v = parseInt(funnelValues[si * days.length + di], 10) || 0;
        porDia[day] = v;
        total7d += v;
      });
      funnel[step] = { hoy: porDia[days[0]], total_7d: total7d, por_dia: porDia };
    });

    // ── Rubros más solicitados (Redis biz:rubro:*) ────────────────────────────
    let rubros = [];
    let cursor = 0;
    do {
      const [next, batch] = await redis.scan(cursor, { match: 'biz:rubro:*', count: 100 });
      cursor = Number(next);
      if (batch.length > 0) {
        const values = await redis.mget(...batch);
        batch.forEach((k, i) => rubros.push({
          rubro: k.replace('biz:rubro:', ''),
          pedidos: parseInt(values[i], 10) || 0,
        }));
      }
    } while (cursor !== 0 && rubros.length < 500);
    rubros.sort((a, b) => b.pedidos - a.pedidos);
    rubros = rubros.slice(0, 10);

    // ── Costos API y sesiones (Redis) ─────────────────────────────────────────
    const [costoTotalUsd, sesionesActivas] = await Promise.all([
      scanSum('session:*:cost'),
      scanSum('session:*:meta', { count: true }),
    ]);

    // ── Diseños y templates (Supabase) ────────────────────────────────────────
    const { data: dsnData } = await supabase
      .from('design_sets')
      .select('rubro, template_name, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    const templatesTop = {};
    for (const d of (dsnData || [])) {
      templatesTop[d.template_name] = (templatesTop[d.template_name] || 0) + 1;
    }

    // ── KPIs derivados ────────────────────────────────────────────────────────
    const f = (s) => funnel[s]?.total_7d || 0;
    const pct = (a, b) => b > 0 ? Math.round((a / b) * 100) : null;
    const kpis = {
      conversion_registro_a_wizard:  pct(f('wizard_inicio'), f('registro')),
      completitud_wizard:            pct(f('wizard_fin'), f('wizard_inicio')),
      wizard_a_preview:              pct(f('preview_visto'), f('wizard_fin')),
      preview_a_pago_click:          pct(f('pago_click'), f('preview_visto')),
      cierre_ventas:                 pct(f('pago_confirmado'), f('pago_click')),
      costo_api_usd_total:           Math.round(costoTotalUsd * 10000) / 10000,
      costo_por_venta_usd:           f('pago_confirmado') > 0
                                       ? Math.round((costoTotalUsd / f('pago_confirmado')) * 100) / 100
                                       : null,
    };

    return res.status(200).json({
      generado: new Date().toISOString(),
      funnel,
      kpis,
      rubros_top: rubros,
      templates_top: Object.entries(templatesTop)
        .map(([template, ventas]) => ({ template, ventas }))
        .sort((a, b) => b.ventas - a.ventas),
      sesiones_activas: sesionesActivas,
      disenos_guardados: (dsnData || []).length,
    });
  } catch (err) {
    console.error('[metrics]', err.message);
    return res.status(500).json({ error: 'Error generando métricas' });
  }
}
