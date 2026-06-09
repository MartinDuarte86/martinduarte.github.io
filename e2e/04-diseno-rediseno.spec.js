/**
 * E2E — Flujo 4: Diseño rediseñado (carousel → generar nuevos)
 *
 * El usuario tiene diseños previos en dsn/index.json.
 * Al completar el onboarding, el chat muestra el carrusel de diseños previos.
 * El usuario hace click en "No me gusta ninguno →" para generar 3 nuevos.
 * Verificamos que:
 * - El carrusel de diseños previos aparece en el chat al terminar las secciones
 * - Al rechazar los diseños previos, se generan 3 nuevos
 * - Aparecen 3 nuevas cards de preview
 *
 * Setup: inyectamos diseños previos en dsn/index.json antes del test.
 */

import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { openFlow, completePrequalification, completeRegistration, completeFullChat, waitForDesigns } from './helpers.js';

const PROJECT_ROOT = process.cwd();
const DSN_INDEX    = join(PROJECT_ROOT, 'landing_page', 'dsn', 'index.json');
const DSN_TPL_DIR  = join(PROJECT_ROOT, 'landing_page', 'dsn', 'template');

function seedPreviousDesigns() {
  mkdirSync(DSN_TPL_DIR, { recursive: true });

  const mockHtml = '<html><body><h1>Diseño anterior mock</h1></body></html>';
  for (let i = 1; i <= 3; i++) {
    writeFileSync(join(DSN_TPL_DIR, `dsn-001-template-${i}.html`), mockHtml);
  }

  const entry = [{
    id: 'dsn-001',
    rubro: 'peluquería',
    fecha: '2026-06-01',
    templates: [
      { id: 'moderno-oscuro',          name: 'Moderno Oscuro',          file: 'dsn/template/dsn-001-template-1.html', html: mockHtml },
      { id: 'minimalista-profesional', name: 'Minimalista Profesional', file: 'dsn/template/dsn-001-template-2.html', html: mockHtml },
      { id: 'fresco-accesible',        name: 'Fresco Accesible',        file: 'dsn/template/dsn-001-template-3.html', html: mockHtml },
    ],
  }];

  writeFileSync(DSN_INDEX, JSON.stringify(entry, null, 2));
}

function clearPreviousDesigns() {
  try { writeFileSync(DSN_INDEX, '[]'); } catch {}
}

test.describe('Flujo 4 — Diseño rediseñado desde carrusel', () => {
  test.beforeAll(() => seedPreviousDesigns());
  test.afterAll(() => clearPreviousDesigns());

  test('carrusel de diseños previos aparece en el chat al terminar las secciones', async ({ page }) => {
    await openFlow(page);
    await completePrequalification(page);
    await completeRegistration(page, { nombre: 'Elena', apellido: 'Suárez', email: `redesign1.${Date.now()}@example.com` });
    await completeFullChat(page);

    // El carrusel de diseños previos aparece como widget en el chat
    await page.waitForSelector('.chat-carousel-widget', { timeout: 15_000 });
    await expect(page.locator('.chat-carousel-widget')).toBeVisible();

    // El botón de rechazo debe estar presente
    await expect(page.locator('.ccw-reject-btn')).toBeVisible();
  });

  test('click en "No me gusta ninguno" genera 3 nuevos diseños', async ({ page }) => {
    await openFlow(page);
    await completePrequalification(page);
    await completeRegistration(page, { nombre: 'Rita', apellido: 'Gómez', email: `redesign2.${Date.now()}@example.com` });
    await completeFullChat(page);

    // Esperar el carrusel de diseños previos
    await page.waitForSelector('.chat-carousel-widget', { timeout: 15_000 });

    // Rechazar diseños anteriores → dispara generación de nuevos
    await page.click('.ccw-reject-btn');

    // Deben aparecer 3 nuevos diseños en el widget de selección
    await waitForDesigns(page); // checks .chat-carousel-widget--new has 3 .ccw-card
  });
});
