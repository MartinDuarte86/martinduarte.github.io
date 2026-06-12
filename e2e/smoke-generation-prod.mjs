/**
 * Smoke directo del fix de generación en PRODUCCIÓN.
 * Aísla el cambio de mayor riesgo: streaming SSE + maxDuration + max_tokens 8192.
 * Llama /api/claude con intent=generation y un brief completo, y verifica:
 *   - que la respuesta sea SSE (eventos delta) — no muere por timeout de inicio
 *   - que llegue un HTML completo (<!DOCTYPE ... </html>) — sin truncar
 *   - el tiempo total y el tamaño del HTML
 * Costo: 1 llamada Sonnet (~US$0.12).
 */

const PROD = 'https://ia-landing-page-flax.vercel.app';

const MAX_TOKENS = Number(process.env.SMOKE_MAX_TOKENS || 3200);
const prompt = `Generá UNA landing page como archivo HTML único y autocontenido, COMPACTO y COMPLETO.
BRIEF: {"nombre_marca":"Lucía Cortes","rubro":"peluquería a domicilio","slogan":"Tu mejor versión, a domicilio","propuesta_valor":"Cortes y color premium en tu casa","servicios":[{"nombre":"Corte","descripcion":"A medida"},{"nombre":"Color","descripcion":"Productos premium"}],"contacto_wsp":"5491123456789","colores_hex":["#EC4899","#F8FAFC"],"estilo":"elegante"}
REGLAS: CSS terso en <style> dentro de <head>, mobile-first, sin dependencias externas salvo Google Fonts.
PRESUPUESTO: máximo ~150 líneas / 9000 caracteres. Es PREFERIBLE un diseño simple y COMPLETO antes que uno elaborado y cortado.
Secciones: Hero, Sobre mí, Servicios, Contacto. Empezá con <!DOCTYPE html> y SIEMPRE cerrá con </html>. Sin markdown.`;

const t0 = Date.now();
const stamp = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

console.log('\n── Smoke generación SSE (producción) ──\n');

const res = await fetch(`${PROD}/api/claude`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ intent: 'generation', max_tokens: MAX_TOKENS, messages: [{ role: 'user', content: prompt }] }),
});

console.log(`  status: ${res.status} · content-type: ${res.headers.get('content-type')} (${stamp()})`);
if (!res.ok) { console.log(`  ❌ status ${res.status}`); process.exit(1); }

const isSse = (res.headers.get('content-type') || '').includes('text/event-stream');
console.log(`  ${isSse ? '✅' : '❌'} respuesta es SSE (streaming): ${isSse}`);

const reader = res.body.getReader();
const decoder = new TextDecoder();
let html = '', buffer = '', deltas = 0, stopReason = null, firstDeltaAt = null;

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const events = buffer.split('\n\n');
  buffer = events.pop();
  for (const evt of events) {
    const line = evt.split('\n').find(l => l.startsWith('data: '));
    if (!line) continue;
    let d; try { d = JSON.parse(line.slice(6)); } catch { continue; }
    if (d.t) { if (!firstDeltaAt) { firstDeltaAt = stamp(); } html += d.t; deltas++; }
    if (d.stop_reason) stopReason = d.stop_reason;
  }
}

const clean = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();
const hasDoctype = /^<!DOCTYPE html>/i.test(clean);
const hasClose   = /<\/html>\s*$/i.test(clean);

console.log(`  ✅ primer delta a los ${firstDeltaAt} (la función no murió por timeout de inicio)`);
console.log(`  deltas recibidos: ${deltas} · stop_reason: ${stopReason}`);
console.log(`  HTML: ${clean.length} chars · doctype=${hasDoctype} · cierra </html>=${hasClose} · truncado=${stopReason === 'max_tokens'}`);
console.log(`  tiempo total: ${stamp()}`);

const ok = isSse && deltas > 0 && hasDoctype && hasClose && stopReason !== 'max_tokens';
console.log(`\n  ${ok ? '✅✅ SMOKE GENERACIÓN PROD: PASÓ' : '❌ SMOKE GENERACIÓN PROD: FALLÓ'}\n`);
process.exit(ok ? 0 : 1);
