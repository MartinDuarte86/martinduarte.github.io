// @ts-check
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  globalSetup: './playwright.global-setup.js',
  testDir: './e2e',
  timeout: 45_000,
  retries: 1,
  workers: 1,          // secuencial — el mock-server comparte estado en memoria
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],

  use: {
    baseURL: 'http://localhost:3000',
    // Visible por defecto (el usuario quiere ver el flujo); PWHEADLESS=1 acelera la iteración
    headless: process.env.PWHEADLESS === '1',
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
    locale: 'es-AR',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    // mock-server-test.js fuerza LLM_PROVIDER=mock antes de que loadEnv()
    // del server lea el .env (que puede tener LLM_PROVIDER=openrouter)
    command: 'node mock-server-test.js',
    url: 'http://localhost:3000/landing_page/',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
