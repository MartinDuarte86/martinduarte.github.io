/**
 * E2E — Flujo 5: Pago realizado (approve)
 *
 * Cubre dos ángulos:
 * A) Frontend: usuario completa el flujo, selecciona diseño y hace click
 *    en "Ya confirmé el pago" → aparece el success section
 * B) Backend: Martin llama /api/approve con un JWT válido → página de éxito
 */

import { test, expect } from '@playwright/test';
import { runFullFlowToDesigns, selectFirstDesign } from './helpers.js';

test.describe('Flujo 5 — Pago realizado', () => {
  // ── A) Flujo del cliente ────────────────────────────────────────────────────

  test('A) confirmar pago lleva al success section', async ({ page }) => {
    await runFullFlowToDesigns(page);
    await selectFirstDesign(page);

    // Confirmar pago
    await page.click('#confirm-payment-btn');
    await page.waitForSelector('#success-section:not([hidden])', { timeout: 15_000 });

    await expect(page.locator('#success-section')).toBeVisible();
    await expect(page.locator('#success-heading')).toContainText('¡Pedido recibido!');
  });

  test('A) success section muestra el nombre de la marca', async ({ page }) => {
    await runFullFlowToDesigns(page);
    await selectFirstDesign(page);
    await page.click('#confirm-payment-btn');
    await page.waitForSelector('#success-section:not([hidden])');

    const brand = await page.locator('#success-brand').textContent();
    expect(brand.trim()).not.toBe('tu marca');
    expect(brand.trim().length).toBeGreaterThan(2);
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
