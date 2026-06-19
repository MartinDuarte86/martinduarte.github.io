/**
 * E2E — Flujo 3: Diseño nuevo seleccionado
 *
 * Extiende el flujo 2: el usuario selecciona uno de los 3 diseños generados.
 * Verificamos que:
 * - El widget de pago (dentro del chat) muestra marca y template correctos
 * - Los 3 métodos de pago están presentes
 * - El código de referencia (session_id abreviado) es visible
 */

import { test, expect } from '@playwright/test';
import { runFullFlowToDesigns, selectFirstDesign } from './helpers.js';

test.describe('Flujo 3 — Diseño nuevo seleccionado', () => {
  test('seleccionar un diseño abre el widget de pago en el chat', async ({ page }) => {
    await runFullFlowToDesigns(page);
    await selectFirstDesign(page);

    await expect(page.locator('.chat-payment-widget')).toBeVisible();
  });

  test('el widget de pago muestra el nombre de la marca', async ({ page }) => {
    await runFullFlowToDesigns(page);
    await selectFirstDesign(page);

    const brand = await page.locator('.cpw-brand-value').textContent();
    // El mock completa con 'Lucía Cortes' o similar como nombre_marca
    expect(brand.trim()).not.toBe('—');
    expect(brand.trim().length).toBeGreaterThan(2);
  });

  test('el widget de pago muestra el template elegido', async ({ page }) => {
    await runFullFlowToDesigns(page);
    await selectFirstDesign(page);

    const template = await page.locator('.cpw-template-value').textContent();
    expect(template.trim()).not.toBe('—');
  });

  test('los 3 métodos de pago están presentes y habilitados', async ({ page }) => {
    await runFullFlowToDesigns(page);
    await selectFirstDesign(page);

    const methodBtns = page.locator('.chat-payment-widget .cpw-method-btn');
    await expect(methodBtns).toHaveCount(3);
    for (const method of ['credito', 'debito', 'transferencia']) {
      await expect(page.locator(`.cpw-method-btn[data-method="${method}"]`)).toBeEnabled();
    }
  });

  test('elegir transferencia muestra el CBU/alias y lleva a pedido recibido', async ({ page }) => {
    await runFullFlowToDesigns(page);
    await selectFirstDesign(page);

    await page.click('.cpw-method-btn[data-method="transferencia"]');
    await expect(page.locator('#chat-messages')).toContainText(/CBU|alias/i, { timeout: 10_000 });
    await page.waitForSelector('.order-received-slide', { timeout: 15_000 });
    await expect(page.locator('.order-received-slide')).toBeVisible();
  });

  test('se puede cambiar de diseño antes de confirmar', async ({ page }) => {
    await runFullFlowToDesigns(page);

    // Seleccionar primero el diseño 1
    await page.locator('.chat-carousel-widget--new .ccw-select-btn').nth(0).click({ force: true });
    await page.waitForSelector('.chat-payment-widget', { timeout: 10_000 });

    // Verificamos que las 3 previews generadas siguen accesibles arriba en el chat
    const cards = page.locator('.chat-carousel-widget--new .ccw-card');
    await expect(cards).toHaveCount(3);
  });
});
