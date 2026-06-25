// Objetivo: setup global de la suite E2E de Playwright.
// Dependencias: lo referencia playwright.config.js (campo globalSetup).
// Resultado esperado: arranque limpio del estado compartido entre specs.
//
// Antes este archivo reseteaba landing_page/dsn/index.json porque el carrusel
// "diseños anteriores" se alimentaba de ese archivo en disco. Hoy ese mecanismo
// es 100% in-memory en el mock (_dsnStore en mock-server.js, vacío por defecto y
// poblado vía POST /api/_test/seed-dsn), así que no hay nada que resetear en disco.
export default function globalSetup() {
  // Sin estado en disco que limpiar. El mock arranca con _dsnStore vacío y cada
  // spec siembra/limpia vía /api/_test/seed-dsn y /api/_test/reset.
}
