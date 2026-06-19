/**
 * E2E — Flujo 5: Pago realizado (approve)
 *
 * Cubre dos ángulos:
 * A) Frontend: usuario completa el flujo, selecciona diseño y elige un método
 *    de pago → aparece el slide de "pedido recibido"
 * B) Backend: Martin llama /api/approve con un JWT válido → página de éxito
 */

import { test, expect } from '@playwright/test';
import { runFullFlowToDesigns, selectFirstDesign } from './helpers.js';

test.describe('Flujo 5 — Pago realizado', () => {
  // ── A) Flujo del cliente ────────────────────────────────────────────────────

  test('A) elegir un método de pago lleva al slide de pedido recibido', async ({ page }) => {
    await runFullFlowToDesigns(page);
    await selectFirstDesign(page);

    await page.click('.cpw-method-btn[data-method="credito"]');
    await page.waitForSelector('.order-received-slide', { timeout: 15_000 });

    await expect(page.locator('.order-received-slide')).toBeVisible();
    await expect(page.locator('.ors-title')).toContainText('¡Pedido recibido!');
  });

  test('A) el slide de pedido recibido muestra el nombre de la marca', async ({ page }) => {
    await runFullFlowToDesigns(page);
    await selectFirstDesign(page);
    await page.click('.cpw-method-btn[data-method="debito"]');
    await page.waitForSelector('.order-received-slide');

    const text = await page.locator('.ors-text strong').first().textContent();
    expect(text.trim()).not.toBe('tu marca');
    expect(text.trim().length).toBeGreaterThan(2);
  });

  // ── B) Flujo de Martin (approve API) ────────────────────────────────────────

  test('B) /api/approve con token → página de aprobación', async ({ page }) => {
    const res = await page.request.get('/api/approve?token=mock-test-token');
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain('aprobado');
  });

  test('B) /api/approve sin token → 400', async ({ page }) => {
    const res = await page.request.get('/api/approve');
    expect(res.status()).toBe(400);
  });

  test('B) página de aprobación es HTML válido', async ({ page }) => {
    await page.goto('/api/approve?token=cualquier-token-mock');
    // El mock devuelve HTML de éxito sin verificar JWT
    await expect(page.locator('h1')).toContainText('aprobado');
  });
});
