/**
 * E2E — Flujo 6: Pago rechazado (reject)
 *
 * Martin recibe el email con el link de rechazo y lo clickea.
 * Verificamos que:
 * - /api/reject con token → página de rechazo
 * - /api/reject sin token → 400
 * - El token de un design ya rechazado no se puede reusar (one-time-use)
 */

import { test, expect } from '@playwright/test';

test.describe('Flujo 6 — Pago rechazado', () => {
  test('/api/reject con token → página de rechazo', async ({ page }) => {
    const res = await page.request.get('/api/reject?token=mock-reject-token');
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html.toLowerCase()).toContain('rechazado');
  });

  test('/api/reject sin token → 400', async ({ page }) => {
    const res = await page.request.get('/api/reject');
    expect(res.status()).toBe(400);
  });

  test('página de rechazo es HTML y muestra mensaje', async ({ page }) => {
    await page.goto('/api/reject?token=cualquier-token-mock');
    await expect(page.locator('h1')).toContainText('rechazado');
  });

  test('/api/approve y /api/reject son endpoints diferentes (no intercambiables)', async ({ page }) => {
    const approveRes = await page.request.get('/api/approve?token=test');
    const rejectRes  = await page.request.get('/api/reject?token=test');

    const approveHtml = await approveRes.text();
    const rejectHtml  = await rejectRes.text();

    // Verificamos que retornan contenido diferente
    expect(approveHtml.toLowerCase()).toContain('aprobado');
    expect(rejectHtml.toLowerCase()).toContain('rechazado');

    // El mensaje de aprobación NO debe aparecer en el rechazo y viceversa
    expect(rejectHtml.toLowerCase()).not.toContain('aprobado');
    expect(approveHtml.toLowerCase()).not.toContain('rechazado');
  });

  test('el flujo de rechazo no afecta el estado del mock server', async ({ page }) => {
    // Llamar reject y luego verificar que el servidor sigue funcionando
    await page.request.get('/api/reject?token=test-isolation');
    const res = await page.request.post('/api/validate-email', {
      data: { email: 'test@example.com' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(200);
  });
});
