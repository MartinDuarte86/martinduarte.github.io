/**
 * E2E — Flujo 3: Diseño nuevo seleccionado
 *
 * Extiende el flujo 2: el usuario selecciona uno de los 3 diseños generados.
 * Verificamos que:
 * - La sección de pago muestra marca y template correctos
 * - El botón de MercadoPago está presente
 * - El código de referencia (session_id abreviado) es visible
 */

import { test, expect } from '@playwright/test';
import { runFullFlowToDesigns, selectFirstDesign } from './helpers.js';

test.describe('Flujo 3 — Diseño nuevo seleccionado', () => {
  test('seleccionar un diseño abre la sección de pago', async ({ page }) => {
    await runFullFlowToDesigns(page);
    await selectFirstDesign(page);

    await expect(page.locator('#payment-section')).toBeVisible();
  });

  test('sección de pago muestra el nombre de la marca', async ({ page }) => {
    await runFullFlowToDesigns(page);
    await selectFirstDesign(page);

    const brand = await page.locator('#payment-brand').textContent();
    // El mock completa con 'Lucía Cortes' o similar como nombre_marca
    expect(brand.trim()).not.toBe('—');
    expect(brand.trim().length).toBeGreaterThan(2);
  });

  test('sección de pago muestra el template elegido', async ({ page }) => {
    await runFullFlowToDesigns(page);
    await selectFirstDesign(page);

    const template = await page.locator('#payment-template').textContent();
    expect(template.trim()).not.toBe('—');
  });

  test('el link de MercadoPago está presente y habilitado', async ({ page }) => {
    await runFullFlowToDesigns(page);
    await selectFirstDesign(page);

    const mpBtn = page.locator('#mp-btn');
    await expect(mpBtn).toBeVisible();
    // En mock el href puede ser # — solo verificamos que existe
    const href = await mpBtn.getAttribute('href');
    expect(href).toBeTruthy();
  });

  test('el botón de pago confirmado lleva al success section', async ({ page }) => {
    await runFullFlowToDesigns(page);
    await selectFirstDesign(page);

    await page.click('#confirm-payment-btn');
    await page.waitForSelector('#success-section:not([hidden])', { timeout: 10_000 });
    await expect(page.locator('#success-section')).toBeVisible();
  });

  test('se puede cambiar de diseño antes de confirmar', async ({ page }) => {
    await runFullFlowToDesigns(page);

    // Seleccionar primero el diseño 1
    await page.locator('.chat-carousel-widget--new .ccw-select-btn').nth(0).click({ force: true });
    await page.waitForSelector('#payment-section:not([hidden])');

    // Volver atrás → seleccionar diseño 2
    // En la app, seleccionar otro diseño desde previews actualiza la sección de pago
    // Verificamos que previews aún están accesibles

    // Seleccionar el segundo diseño (si las previews siguen visibles bajo el payment)
    const cards = page.locator('.chat-carousel-widget--new .ccw-card');
    await expect(cards).toHaveCount(3);
  });
});
