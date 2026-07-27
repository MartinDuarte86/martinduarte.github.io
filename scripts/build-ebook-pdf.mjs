/*
 * scripts/build-ebook-pdf.mjs — Genera el PDF de cada ebook con Chromium
 * (print-to-PDF) a partir de su propia página de lectura de /ebooks/**.
 *
 * Correr con: npm run build:pdf
 *
 * El PDF resultante se commitea al repo (es lo que sirve el botón "Descargar
 * PDF"). Es un artefacto de build versionado: si se edita el HTML del ebook,
 * hay que volver a correr este script o los dos quedan desincronizados.
 *
 * Notas de implementación:
 *  - `waitUntil: 'networkidle'` + `document.fonts.ready`: las fuentes
 *    (Fraunces/Inter) vienen de Google Fonts, y un PDF renderizado antes de que
 *    se apliquen cae a la serif del sistema. networkidle solo no alcanza.
 *  - `printBackground: true` no es negociable: la portada es texto blanco sobre
 *    --navy (#0A1120); sin esto sale blanco sobre blanco, ilegible.
 *  - Márgenes en 0: el @media print de la página ya define su propio padding.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const EBOOKS = [
  {
    slug: 'inteligencia-artificial',
    pdf:  'por-fin-vas-a-entender-la-ia.pdf',
  },
];

async function buildOne(browser, ebook) {
  const htmlPath = path.join(ROOT, 'ebooks', ebook.slug, 'index.html');
  const pdfPath  = path.join(ROOT, 'ebooks', ebook.slug, ebook.pdf);

  if (!fs.existsSync(htmlPath)) {
    throw new Error(`No existe la página de lectura: ${htmlPath}`);
  }

  const page = await browser.newPage();
  await page.goto('file://' + htmlPath.replace(/\\/g, '/'), {
    waitUntil: 'networkidle',
    timeout: 60000,
  });

  // networkidle no garantiza que las webfonts se hayan aplicado.
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: 'print' });

  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
  });

  await page.close();

  const kb = (fs.statSync(pdfPath).size / 1024).toFixed(0);
  console.log(`✓ ${ebook.slug} → ebooks/${ebook.slug}/${ebook.pdf} (${kb} KB)`);
}

const browser = await chromium.launch();
try {
  for (const ebook of EBOOKS) await buildOne(browser, ebook);
} finally {
  await browser.close();
}
