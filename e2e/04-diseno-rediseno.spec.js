/**
 * E2E — Flujo 4: Diseño rediseñado (carousel → generar nuevos)
 *
 * El usuario tiene diseños previos (hoy en Supabase / en memoria del mock).
 * Al completar el onboarding, el chat muestra el carrusel de diseños previos.
 * El usuario hace click en "No me gusta ninguno →" para generar 3 nuevos.
 *
 * Los diseños previos se siembran vía /api/_test/seed-dsn — el mismo data path
 * que /api/get-dsn-html consume en producción (ya no se escribe a disco, que
 * era el mecanismo legacy de dsn/index.json).
 */

import { test, expect } from '@playwright/test';
import { openFlow, completePrequalification, completeRegistration, completeSectionsToContacto, sendAndWait, waitForDesigns } from './helpers.js';

const SEED_DESIGNS = [
  { id: 'dsn-001', rubro: 'peluquería', template_name: 'Moderno Oscuro', created_at: '2026-06-01T00:00:00Z',
    html: '<!DOCTYPE html><html><body><h1>Diseño anterior 1</h1></body></html>' },
  { id: 'dsn-002', rubro: 'peluquería', template_name: 'Minimalista Profesional', created_at: '2026-06-01T00:00:00Z',
    html: '<!DOCTYPE html><html><body><h1>Diseño anterior 2</h1></body></html>' },
];

test.describe('Flujo 4 — Diseño rediseñado desde carrusel', () => {
  test.beforeEach(async ({ request }) => {
    await request.post('/api/_test/reset');
    await request.post('/api/_test/seed-dsn', { data: { designs: SEED_DESIGNS } });
  });

  // Limpiar el seed para no contaminar specs posteriores (p.ej. flujo 5) que
  // esperan estado vacío y van directo a generación.
  test.afterEach(async ({ request }) => {
    await request.post('/api/_test/reset');
  });

  test('carrusel de diseños previos aparece en el chat al terminar las secciones', async ({ page }) => {
    await openFlow(page);
    await completePrequalification(page);
    await completeRegistration(page, { nombre: 'Elena', apellido: 'Suárez', email: `redesign1.${Date.now()}@example.com` });
    await completeSectionsToContacto(page);

    // El carrusel de diseños previos (no el de nuevos) aparece como widget en el chat
    const dsnWidget = page.locator('.chat-carousel-widget:not(.chat-carousel-widget--new)');
    await expect(dsnWidget).toBeVisible({ timeout: 20_000 });
    await expect(dsnWidget.locator('.ccw-reject-btn')).toBeVisible();
  });

  test('click en "No me gusta ninguno" genera 3 nuevos diseños', async ({ page }) => {
    await openFlow(page);
    await completePrequalification(page);
    await completeRegistration(page, { nombre: 'Rita', apellido: 'Gómez', email: `redesign2.${Date.now()}@example.com` });
    await completeSectionsToContacto(page);

    const dsnWidget = page.locator('.chat-carousel-widget:not(.chat-carousel-widget--new)');
    await expect(dsnWidget).toBeVisible({ timeout: 20_000 });

    // Rechazar diseños anteriores → pasa a preguntar color (arranca limpio, 2 turnos)
    await dsnWidget.locator('.ccw-reject-btn').click();
    await sendAndWait(page, 'Algo más moderno y colorido');
    await sendAndWait(page, 'Tonos cálidos, tipografía redondeada');

    // Deben aparecer 3 nuevos diseños en el widget de selección
    await waitForDesigns(page);
  });
});
