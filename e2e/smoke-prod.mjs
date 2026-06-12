/**
 * Smoke test contra PRODUCCIÓN — valida el deploy con APIs reales.
 * Ejecuta el flujo feliz hasta ver los diseños generados por streaming SSE.
 * Costo: 1 set de generación real (~US$0.35). Se corre una sola vez por deploy.
 *
 * Uso: node e2e/smoke-prod.mjs
 */
import { chromium } from '@playwright/test';

const PROD = 'https://ia-landing-page-flax.vercel.app/landing_page/';
const t0 = Date.now();
const stamp = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', e => console.log(`  [PAGEERROR] ${e.message}`));

try {
  console.log(`\n── Smoke test producción (${stamp()}) ──\n`);
  await page.goto(PROD, { waitUntil: 'networkidle' });
  console.log(`  ✅ Landing carga (${stamp()})`);

  await page.click('[data-open-flow]');
  await page.selectOption('#preq-tipo', 'ok');
  await page.locator('input[name="preq-pago"][value="no"]').check();
  await page.locator('input[name="preq-login"][value="no"]').check();
  await page.click('#preq-submit');
  await page.waitForSelector('#flow-step-2:not([hidden])', { timeout: 10_000 });

  await page.fill('#reg-nombre', 'Smoke');
  await page.fill('#reg-apellido', 'Test');
  await page.fill('#reg-email', `smoke.prod.${Date.now()}@example.com`);
  await page.click('#reg-submit');
  await page.waitForSelector('#flow-step-3:not([hidden])', { timeout: 12_000 });
  console.log(`  ✅ Onboarding + registro (${stamp()})`);

  // Esperar saludo y completar las 6 secciones con IA real
  await page.waitForFunction(
    () => [...document.querySelectorAll('#chat-messages .message--ai .message-bubble')]
      .some(b => b.textContent.includes('minutos')),
    { timeout: 20_000 });

  async function send(text) {
    const prev = await page.locator('#chat-messages .message--ai .message-bubble').count();
    await page.fill('#chat-input', text);
    await page.click('#send-btn');
    await page.waitForFunction(
      (p) => document.querySelectorAll('#chat-messages .message--ai .message-bubble').length > p,
      prev, { timeout: 45_000 });
    await page.waitForSelector('#send-btn:not([disabled])', { timeout: 45_000 }).catch(() => {});
  }

  // Conversación realista — la IA real decide cuándo cierra cada sección
  const msgs = [
    'Tengo una peluquería a domicilio en zona norte, me llamo Lucía',
    'Lucía Cortes, hago cortes y coloración premium a domicilio',
    'Es personal, lo hago sola, más de 6 años de experiencia',
    'Ofrezco corte, coloración y tratamientos capilares',
    'No necesito testimonios por ahora',
    'Mi WhatsApp es 1123456789, zona norte GBA',
    'Colores suaves, blanco y rosa, estilo elegante',
  ];
  for (const m of msgs) {
    await send(m);
    console.log(`  · enviado: "${m.slice(0, 40)}…" (${stamp()})`);
    // Si ya arrancó la generación, cortar el loop
    if (await page.locator('#generating-state:not([hidden])').count()) break;
    if (await page.locator('.chat-carousel-widget--new').count()) break;
  }

  // Esperar la generación por streaming
  console.log(`  ⏳ Esperando generación SSE… (${stamp()})`);
  await page.waitForSelector('.chat-carousel-widget--new .ccw-card', { timeout: 120_000 });
  const count = await page.locator('.chat-carousel-widget--new .ccw-card').count();
  console.log(`\n  ✅✅ DISEÑOS GENERADOS: ${count} diseños reales por SSE (${stamp()})\n`);
  console.log('  SMOKE TEST PROD: PASÓ');
  process.exitCode = 0;
} catch (e) {
  console.log(`\n  ❌ SMOKE TEST PROD FALLÓ (${stamp()}): ${e.message}\n`);
  await page.screenshot({ path: 'tests/screenshots/smoke_prod_fail.png' }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
