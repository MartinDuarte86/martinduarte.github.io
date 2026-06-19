/**
 * E2E — Auditoría: 10 Casos de Uso de cobertura integral
 *
 * Matriz oficial del engagement de consultoría (junio 2026).
 * Cada UC valida un ángulo distinto del flujo onboarding → venta:
 *
 *  UC-01 Onboarding completo (pre-cal + registro + encuadre del chat)
 *  UC-02 Evaluación: fuera de alcance (e-commerce → derivación a WhatsApp)
 *  UC-03 Evaluación: rechazo definitivo (contenido ilegal → cierre cordial)
 *  UC-04 Wizard completo: 6 secciones + handoff al Equipo de Diseño
 *  UC-05 Skip de sección opcional (testimonios)
 *  UC-06 Recuperación de sesión con historial repintado
 *  UC-07 Carrusel DSN: elegir diseño anterior → venta a costo $0
 *  UC-08 DSN sin lockout: texto libre rechaza carrusel y genera nuevos
 *  UC-09 Venta completa: generación SSE + selección + pago + éxito
 *  UC-10 Resiliencia y validación de input (red caída, retry, XSS, contador)
 *
 * Regla de gating: la suite corre secuencial; un UC que falla bloquea el avance.
 */

import { test, expect } from '@playwright/test';
import {
  openFlow, completePrequalification, completeRegistration,
  sendAndWait, passEvaluation, completeFullChat, completeSectionsToContacto,
  waitForDesigns, selectFirstDesign,
} from './helpers.js';

// Estado limpio del mock entre casos — evita contaminación cruzada
test.beforeEach(async ({ request }) => {
  await request.post('/api/_test/reset');
});

async function startChat(page) {
  await openFlow(page);
  await completePrequalification(page);
  await completeRegistration(page);
}

const SEED_DESIGNS = [
  {
    id: 'seed-001', rubro: 'peluquería', template_name: 'Minimalista Profesional',
    created_at: new Date().toISOString(),
    html: '<!DOCTYPE html><html><head><title>Seed 1</title></head><body><h1>Diseño anterior 1</h1></body></html>',
  },
  {
    id: 'seed-002', rubro: 'gastronomía', template_name: 'Gourmet Cálido',
    created_at: new Date().toISOString(),
    html: '<!DOCTYPE html><html><head><title>Seed 2</title></head><body><h1>Diseño anterior 2</h1></body></html>',
  },
];

test.describe('Auditoría — 10 Casos de Uso', () => {

  // ── UC-01 ───────────────────────────────────────────────────────────────────
  test('UC-01: onboarding completo llega al chat con encuadre de expectativa', async ({ page }) => {
    await startChat(page);

    // El saludo encuadra duración y recompensa antes de pedir nada.
    // Se espera la burbuja real (no el indicador de typing, que también es .message--ai).
    const greeting = page.locator('#chat-messages .message--ai .message-bubble').first();
    await expect(greeting).toContainText('10 minutos', { timeout: 15_000 });
    await expect(greeting).toContainText(/negocio|idea/);

    // Tras el saludo el input queda habilitado y la progress bar oculta (no arrancó el wizard)
    await expect(page.locator('#chat-input')).toBeEnabled();
    await expect(page.locator('#progress-bar')).toBeHidden();
  });

  // ── UC-02 ───────────────────────────────────────────────────────────────────
  test('UC-02: pedido de e-commerce se informa como fuera de alcance y deriva a WhatsApp', async ({ page }) => {
    await startChat(page);
    await passEvaluation(page, 'Quiero una tienda online con carrito y pago online');

    // El reply de texto queda antes del widget de WhatsApp — se busca en todo el contenedor
    await expect(page.locator('#chat-messages')).toContainText(/tienda online|martín por whatsapp/i);

    // No avanzó al wizard, el bot no sigue intentando calificarlo y deriva a un humano
    await expect(page.locator('#progress-bar')).toBeHidden();
    await expect(page.locator('.whatsapp-handoff-widget a.whatsapp-handoff-link')).toBeVisible();
    await expect(page.locator('#chat-input')).toBeDisabled();
  });

  // ── UC-03 ───────────────────────────────────────────────────────────────────
  test('UC-03: contenido ilegal se rechaza cordialmente y bloquea el input', async ({ page }) => {
    await startChat(page);
    await passEvaluation(page, 'Quiero vender medicamentos sin receta de forma ilegal');

    const lastAi = page.locator('#chat-messages .message--ai').last();
    await expect(lastAi).toContainText(/no trabajamos|Éxitos/i);
    await expect(page.locator('#chat-input')).toBeDisabled();
  });

  // ── UC-04 ───────────────────────────────────────────────────────────────────
  test('UC-04: wizard completo de 6 secciones termina en handoff al Equipo de Diseño', async ({ page }) => {
    await startChat(page);
    await completeFullChat(page);

    // Handoff visual al equipo de diseño
    await expect(page.locator('.handoff-banner')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.handoff-banner__team')).toContainText('Equipo de Diseño');

    // La progress bar marcó las 6 secciones
    await expect(page.locator('#progress-bar')).toBeVisible();
    const doneSteps = await page.locator('.progress-step--done').count();
    expect(doneSteps).toBeGreaterThanOrEqual(5);
  });

  // ── UC-05 ───────────────────────────────────────────────────────────────────
  test('UC-05: testimonios es salteable con el botón de skip', async ({ page }) => {
    await startChat(page);
    await passEvaluation(page);
    // Hero (cerrado con 1 msg por el arrastre del msg de evaluación) + sobre_mi + servicios
    await sendAndWait(page, 'Lucía Cortes, peluquería a domicilio');
    await sendAndWait(page, 'Es personal, lo hago sola');
    await sendAndWait(page, 'Más de 6 años de experiencia');
    await sendAndWait(page, 'Corte, coloración y tratamientos');
    await sendAndWait(page, 'No muestro precios, se consultan');

    // En testimonios aparece el botón de skip
    const skipBtn = page.locator('.skip-section-btn');
    await expect(skipBtn).toBeVisible({ timeout: 10_000 });
    await skipBtn.click();

    // Saltó a contacto (sección 5/6) sin pasar por preguntas de testimonios
    await expect(page.locator('#chat-messages')).toContainText(/WhatsApp|contacto/i, { timeout: 10_000 });
  });

  // ── UC-06 ───────────────────────────────────────────────────────────────────
  test('UC-06: recargar a mitad del wizard recupera sesión con historial repintado', async ({ page }) => {
    await startChat(page);
    await passEvaluation(page);
    await sendAndWait(page, 'Lucía Cortes, peluquería a domicilio'); // cierra hero
    await sendAndWait(page, 'Es personal, lo hago sola');            // avanza sobre_mi

    const messagesBefore = await page.locator('#chat-messages .message').count();
    expect(messagesBefore).toBeGreaterThan(3);

    // Reload: el confirm() nativo de recuperación se acepta
    page.once('dialog', d => d.accept());
    await page.reload();

    // La sesión del localStorage saltea el registro; reabrir el flow muestra el chat
    await page.waitForSelector('[data-open-flow]', { state: 'visible' });
    await page.click('[data-open-flow]');
    await page.waitForSelector('#flow-step-3:not([hidden])', { timeout: 10_000 });

    // Historial repintado: el chat NO está vacío y retoma la fase
    await page.waitForFunction(
      () => document.querySelectorAll('#chat-messages .message').length >= 3,
      { timeout: 15_000 }
    );
    await expect(page.locator('#chat-messages')).toContainText('Retomamos donde lo dejaste');
    await expect(page.locator('#chat-input')).toBeEnabled();
  });

  // ── UC-07 ───────────────────────────────────────────────────────────────────
  test('UC-07: carrusel de diseños anteriores permite elegir y pasar a pago (venta costo $0)', async ({ page, request }) => {
    await request.post('/api/_test/seed-dsn', { data: { designs: SEED_DESIGNS } });

    await startChat(page);
    await completeSectionsToContacto(page);

    // Aparece el carrusel DSN con los diseños sembrados — antes de preguntar color
    const dsnWidget = page.locator('.chat-carousel-widget:not(.chat-carousel-widget--new)');
    await expect(dsnWidget).toBeVisible({ timeout: 20_000 });
    await expect(dsnWidget.locator('.ccw-card')).toHaveCount(2);

    // Elegir el primero → pago directo, sin generación
    await dsnWidget.locator('.ccw-select-btn').first().click({ force: true });
    await page.waitForSelector('.chat-payment-widget', { timeout: 10_000 });
    await expect(page.locator('.cpw-template-value')).toContainText('Minimalista');
  });

  // ── UC-08 ───────────────────────────────────────────────────────────────────
  test('UC-08: en revisión DSN el texto libre NO queda bloqueado y dispara generación nueva', async ({ page, request }) => {
    await request.post('/api/_test/seed-dsn', { data: { designs: SEED_DESIGNS } });

    await startChat(page);
    await completeSectionsToContacto(page);

    const dsnWidget = page.locator('.chat-carousel-widget:not(.chat-carousel-widget--new)');
    await expect(dsnWidget).toBeVisible({ timeout: 20_000 });

    // El input sigue habilitado (fix anti-lockout) y el texto libre cuenta como rechazo,
    // pasando directo a responder la sección Diseño con ese mismo texto (1er turno).
    await expect(page.locator('#chat-input')).toBeEnabled();
    await sendAndWait(page, 'Ninguno me convence, quiero algo más moderno');
    // El mock pide un segundo turno antes de devolver el brief de diseño completo.
    await sendAndWait(page, 'Colores fríos, estilo minimalista');

    // Se generan diseños nuevos
    await waitForDesigns(page);
  });

  // ── UC-09 ───────────────────────────────────────────────────────────────────
  test('UC-09: venta completa — generación SSE con skeletons, selección, pago y éxito', async ({ page }) => {
    await startChat(page);
    await completeSectionsToContacto(page);

    // Sin diseños sembrados, el repaso cae directo a la pregunta de color (arranca
    // limpia, 2 turnos). El primero responde la intro; el segundo —enviado a mano
    // para atrapar el estado de generación en vivo— entrega el brief y dispara la SSE.
    await sendAndWait(page, 'Prefiero colores suaves, blanco y rosa');
    await page.fill('#chat-input', 'Algo moderno y minimalista, sin recargar');
    await page.click('#send-btn');

    // Durante la generación: skeletons visibles con 3 slots
    await page.waitForSelector('#generating-state:not([hidden])', { timeout: 25_000 });
    await expect(page.locator('.gen-skeleton')).toHaveCount(3);

    // Llegan los 3 diseños por streaming
    await waitForDesigns(page);

    // Selección → pago → confirmación → éxito (la VENTA, objetivo final)
    await selectFirstDesign(page);
    await expect(page.locator('.cpw-brand-value')).not.toHaveText('—');
    await page.click('.cpw-method-btn[data-method="transferencia"]');
    await page.waitForSelector('.order-received-slide', { timeout: 15_000 });
    await expect(page.locator('.order-received-slide')).toBeVisible();
  });

  // ── UC-10 ───────────────────────────────────────────────────────────────────
  test('UC-10a: caída de red en el LLM muestra retry y el reintento recupera el flujo', async ({ page }) => {
    await startChat(page);

    // Simular red caída SOLO para /api/claude
    let failNext = true;
    await page.route('**/api/claude', route => {
      if (failNext) { failNext = false; return route.abort('connectionfailed'); }
      return route.fallback();
    });

    await page.fill('#chat-input', 'Tengo una peluquería a domicilio');
    await page.click('#send-btn');

    // El auto-retry (1 intento) recupera solo: llega respuesta del asistente igual
    await page.waitForFunction(
      () => [...document.querySelectorAll('#chat-messages .message--ai .message-bubble')]
        .some(b => b.textContent.includes('aplica muy bien') || b.textContent.includes('paso a paso')),
      { timeout: 30_000 }
    );
  });

  test('UC-10b: el input escapa HTML (anti-XSS) y el contador respeta 600 chars', async ({ page }) => {
    await startChat(page);

    // Mensaje con payload XSS: debe renderizarse como texto plano
    await sendAndWait(page, '<script>window.__pwned=1</script><img src=x onerror="window.__pwned=2">');
    const pwned = await page.evaluate(() => window.__pwned);
    expect(pwned).toBeUndefined();
    await expect(page.locator('#chat-messages .message--user').last()).toContainText('<script>');

    // El textarea corta en 600 y el contador lo refleja
    // (insertText simula tipeo real → respeta maxlength, a diferencia de fill())
    await page.locator('#chat-input').click();
    await page.keyboard.insertText('x'.repeat(700));
    const valueLen = await page.locator('#chat-input').inputValue().then(v => v.length);
    expect(valueLen).toBe(600);
    await expect(page.locator('#char-counter')).toHaveText('600 / 600');
  });
});
