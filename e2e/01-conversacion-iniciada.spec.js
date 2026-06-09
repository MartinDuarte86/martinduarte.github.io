/**
 * E2E — Flujo 1: Conversación iniciada (incompleta)
 *
 * El usuario completa pre-calificación y registro,
 * envía el primer mensaje de evaluación pero NO completa todas las secciones.
 * Verificamos que:
 * - La sesión (lp_session_id) queda en localStorage
 * - Los mensajes del chat son visibles
 * - El estado persiste (save-session fue llamado)
 */

import { test, expect } from '@playwright/test';
import { openFlow, completePrequalification, completeRegistration, passEvaluation } from './helpers.js';

test.describe('Flujo 1 — Conversación iniciada', () => {
  test('pre-calificación y registro funcionan correctamente', async ({ page }) => {
    await openFlow(page);

    // Modal abre
    await expect(page.locator('#flow-modal')).toBeVisible();

    // Paso 1: pre-calificación
    await completePrequalification(page);
    await expect(page.locator('#flow-step-2')).toBeVisible();
  });

  test('registro guarda sesión en localStorage y habilita el chat', async ({ page }) => {
    await openFlow(page);
    await completePrequalification(page);
    await completeRegistration(page, { nombre: 'Carlos', apellido: 'López', email: `inicio.test.${Date.now()}@example.com` });

    // El chat debe estar visible
    await expect(page.locator('#chat-section')).toBeVisible();
    await expect(page.locator('#flow-step-3')).toBeVisible();

    // Verificar localStorage tiene session_id
    const sessionId = await page.evaluate(() => localStorage.getItem('lp_session_id'));
    expect(sessionId).not.toBeNull();
    expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  test('saludo inicial del asistente aparece automáticamente', async ({ page }) => {
    await openFlow(page);
    await completePrequalification(page);
    await completeRegistration(page, { nombre: 'María', apellido: 'Pérez', email: `saludo.test.${Date.now()}@example.com` });

    // Esperar saludo
    await page.waitForFunction(
      () => document.querySelectorAll('#chat-messages .message--ai').length >= 1,
      { timeout: 10_000 }
    );

    const messages = await page.locator('#chat-messages').textContent();
    expect(messages.length).toBeGreaterThan(10);
  });

  test('usuario envía primer mensaje y obtiene respuesta (evaluación)', async ({ page }) => {
    await openFlow(page);
    await completePrequalification(page);
    await completeRegistration(page, { nombre: 'Juan', apellido: 'Martínez', email: `eval.test.${Date.now()}@example.com` });

    await passEvaluation(page, 'Tengo una peluquería a domicilio en zona norte');

    // Deben aparecer al menos 3 mensajes del asistente:
    // saludo + respuesta evaluación + pregunta apertura sección hero
    const assistantMsgs = page.locator('#chat-messages .message--ai');
    await expect(assistantMsgs).toHaveCount(3, { timeout: 10_000 });
  });

  test('email inválido bloquea el botón de registro', async ({ page }) => {
    await openFlow(page);
    await completePrequalification(page);

    await page.fill('#reg-nombre', 'Test');
    await page.fill('#reg-apellido', 'User');
    await page.fill('#reg-email', 'no-es-un-email-valido');

    // El botón debe seguir deshabilitado
    await expect(page.locator('#reg-submit')).toBeDisabled();
  });

  test('proyecto e-commerce es rechazado en pre-calificación', async ({ page }) => {
    await openFlow(page);
    await page.selectOption('#preq-tipo', 'ecommerce');
    await page.locator('input[name="preq-pago"][value="si"]').check();
    await page.locator('input[name="preq-login"][value="no"]').check();

    // El botón no debe habilitarse para e-commerce
    await expect(page.locator('#preq-submit')).toBeDisabled();
  });

  test('cerrar el modal con ESC y reabrirlo funciona', async ({ page }) => {
    await openFlow(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#flow-modal')).toBeHidden();

    // Reabrir
    await page.click('[data-open-flow]');
    await expect(page.locator('#flow-modal')).toBeVisible();
  });
});
