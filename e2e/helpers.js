/**
 * Helpers compartidos para todos los tests E2E del landing page.
 *
 * Abstrae interacciones repetitivas (pre-calificación, registro, chat)
 * para que cada spec sea declarativo y legible.
 */

import { expect } from '@playwright/test';

// ── Pre-calificación (Paso 1) ─────────────────────────────────────────────────

export async function openFlow(page) {
  await page.goto('/landing_page/');
  await page.waitForSelector('[data-open-flow]', { state: 'visible' });
  await page.click('[data-open-flow]');
  await page.waitForSelector('#flow-modal:not([hidden])', { state: 'attached' });
}

export async function completePrequalification(page) {
  await page.selectOption('#preq-tipo', 'ok');
  await page.locator('input[name="preq-pago"][value="no"]').check();
  await page.locator('input[name="preq-login"][value="no"]').check();
  await page.waitForSelector('#preq-submit:not([disabled])', { timeout: 3000 });
  await page.click('#preq-submit');
  await page.waitForSelector('#flow-step-2:not([hidden])', { timeout: 5000 });
}

// ── Registro (Paso 2) ─────────────────────────────────────────────────────────

export async function completeRegistration(page, overrides = {}) {
  const email = overrides.email || `e2e.test.${Date.now()}@example.com`;
  await page.fill('#reg-nombre',   overrides.nombre   || 'Ana');
  await page.fill('#reg-apellido', overrides.apellido || 'García');
  await page.fill('#reg-email',    email);
  if (overrides.telefono) await page.fill('#reg-telefono', overrides.telefono);
  await page.waitForSelector('#reg-submit:not([disabled])', { timeout: 3000 });
  await page.click('#reg-submit');
  await page.waitForSelector('#flow-step-3:not([hidden])', { timeout: 8000 });
  return email;
}

// ── Chat ──────────────────────────────────────────────────────────────────────

/** Envía un mensaje y espera que llegue la respuesta del asistente. */
export async function sendAndWait(page, text) {
  const prevCount = await page.locator('#chat-messages .message--ai').count();
  await page.fill('#chat-input', text);
  await page.click('#send-btn');
  // Esperar a que aparezca un mensaje nuevo del asistente
  await page.waitForFunction(
    (prev) => {
      const els = document.querySelectorAll('#chat-messages .message--ai');
      return els.length > prev;
    },
    prevCount,
    { timeout: 25_000 }
  );
  // Esperar que el botón se habilite O que aparezca el carrusel de diseños
  // (el botón queda deshabilitado permanentemente cuando arranca la generación)
  await Promise.race([
    page.waitForSelector('#send-btn:not([disabled])', { timeout: 30_000 }),
    page.waitForSelector('.chat-carousel-widget', { timeout: 30_000 }),
  ]).catch(() => {});
}

/** Completa UNA sección del chat (2 mensajes del usuario). */
export async function completeSection(page, msg1 = 'Peluquería a domicilio, me llamo Lucía', msg2 = 'Más de 6 años de experiencia') {
  await sendAndWait(page, msg1);
  await sendAndWait(page, msg2);
}

/** Completa la evaluación inicial (primer mensaje del usuario). */
export async function passEvaluation(page, msg = 'Tengo una peluquería a domicilio') {
  await page.waitForSelector('#chat-messages', { state: 'visible' });
  // Esperar el saludo inicial del asistente
  await page.waitForFunction(
    () => document.querySelectorAll('#chat-messages .message--ai').length >= 1,
    { timeout: 15_000 }
  );
  await sendAndWait(page, msg);
}

/** Completa el flujo completo de chat (evaluación + 6 secciones). */
export async function completeFullChat(page) {
  await passEvaluation(page);
  // El mensaje de evaluación queda en state.messages cuando hero arranca,
  // por lo que el mock lo cuenta como turn=1 y completa Hero con sólo 1
  // mensaje del usuario. El m2 de cada sección se convierte en el m1 de
  // la siguiente. Para la última sección (Diseño), el segundo mensaje
  // llegaría con el input ya deshabilitado (generación iniciada), así que
  // sólo se envía 1 mensaje — suficiente para que el mock devuelva el JSON.
  const pairMsgs = [
    ['Lucía Cortes, peluquería a domicilio', 'Cortes y coloración con productos premium'],
    ['Es personal, lo hago sola',             'Más de 6 años, comencé con amigas'],
    ['Corte, coloración y tratamientos',      'No muestro precios, se consultan por WA'],
    ['Sí quiero testimonios',                 'Sí, son testimonios reales'],
    ['WA: 1123456789, IG: @luciacortes',     'Zona Norte GBA, lunes a sábado 9-18hs'],
  ];
  for (const [m1, m2] of pairMsgs) {
    await completeSection(page, m1, m2);
  }
  // Último mensaje completa la sección Diseño y dispara la generación.
  // sendAndWait espera el carrusel via Promise.race antes de retornar.
  await sendAndWait(page, 'Prefiero colores suaves, blanco y rosa');
}

// ── Generación y selección de diseño ─────────────────────────────────────────

export async function waitForDesigns(page) {
  // New designs appear as .chat-carousel-widget--new (scoped to avoid mixing with
  // the old-designs carousel .chat-carousel-widget which also uses .ccw-card).
  await page.waitForSelector('.chat-carousel-widget--new', { timeout: 30_000 });
  await expect(page.locator('.chat-carousel-widget--new .ccw-card')).toHaveCount(3, { timeout: 15_000 });
}

export async function selectFirstDesign(page) {
  await waitForDesigns(page);
  // Button is in .ccw-card-footer — always visible (mobile-first, no overlay trick).
  await page.locator('.chat-carousel-widget--new .ccw-select-btn').first().click({ force: true });
  await page.waitForSelector('#payment-section:not([hidden])', { timeout: 10_000 });
}

// ── Flujo completo hasta el pago ──────────────────────────────────────────────

export async function runFullFlowToDesigns(page) {
  await openFlow(page);
  await completePrequalification(page);
  await completeRegistration(page);
  await completeFullChat(page);
  await waitForDesigns(page);
}
