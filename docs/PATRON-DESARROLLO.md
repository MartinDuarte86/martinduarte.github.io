# Patrón de desarrollo — Creator-LandingPage

Este documento define **el** patrón a respetar en todo el código del proyecto. Si
aparece más de una forma de hacer lo mismo, se unifica hacia lo descrito acá. El
objetivo es que cualquier archivo sea identificable por su ubicación y que nada
quede sin un objetivo claro.

> Estado: definido en la Fase 0 de la reorganización. Las deduplicaciones que aún
> no están aplicadas (UUID, escape HTML, manejo de errores, keys de storage) se
> ejecutan en la Fase 2; este documento es el destino al que deben converger.

## 1. Principios

1. **Una responsabilidad por archivo.** Si un archivo hace dos cosas no
   relacionadas, se parte.
2. **Nada sin objetivo identificable.** Código muerto o "por las dudas" no se
   versiona. Si no se usa, se borra (git guarda la historia).
3. **El servidor no confía en el cliente.** Identidad y autorización se resuelven
   y validan en el backend (ver [ARQUITECTURA.md](ARQUITECTURA.md) y el ADR de
   sesión).
4. **Redis es scratch con TTL; Supabase es el registro durable.** No tratar Redis
   como sistema de registro.

## 2. Cabecera de comentario obligatoria

Todo archivo y toda función pública lleva, en español, tres datos:

```js
// Objetivo: qué resuelve.
// Dependencias: de qué depende (módulos, env vars, tablas, llaves Redis).
// Resultado esperado: qué devuelve / qué efecto produce.
```

No se documenta lo obvio; se documenta el *por qué* y los *gotchas*.

## 3. Frontend (`landing_page/`)

- **ES modules**, named exports. Sin framework ni build step.
- Utilidades compartidas centralizadas (destino de la Fase 2):
  - `constants.js` — llaves de `localStorage`, nombres de fases, enums.
  - `utils.js` — helpers puros (escape HTML, formato). **Una** sola función por
    propósito (no `escapeHtml` + `safe()` duplicados).
  - `api-client.js` — **único** punto de llamada HTTP al backend vía un
    `safeFetch` con manejo uniforme de error/estado (rate limit 429, budget 402,
    error de red) y `credentials: 'include'` para que viaje la cookie de sesión.
  - `session.js` — identidad de sesión del lado cliente (sin generar UUIDs:
    la identidad la emite el server vía cookie httpOnly — ver ADR de sesión).
- Manejo de errores **uniforme**: nada de tres patrones distintos
  (`console.warn`+null vs `throw`+catch vs `console.error`). Se decide por capa:
  el `api-client` normaliza y la UI decide si muestra mensaje o degrada.
- La máquina de estados del wizard vive en `chat.js` (enum `PHASE`). El orden de
  secciones se mantiene sincronizado con `api/claude.js` y `api/_lib/redis.js`
  (ver el gotcha en CLAUDE.md).

## 4. Backend (`api/`)

- Cada `api/*.js` exporta un único `handler(req, res)` (función serverless de
  Vercel). Sin router compartido.
- La lógica compartida vive en `api/_lib/` (`redis.js`, `supabase.js`, `cors.js`,
  y a futuro `session.js`). **No** se duplica una tabla/constante en dos lados
  (ej: `RATE_LIMITS` vive solo en `redis.js`).
- Guards transversales como helpers componibles al inicio del handler:
  `applyCors(req, res)`, y a futuro `requireSession(req, res)`.
- **Envelope de error consistente**: `{ error: 'codigo', message: 'texto' }` y el
  status HTTP correcto (400 input, 401 sin sesión, 402 budget, 405 método, 409
  conflicto, 429 rate limit, 5xx interno).
- Límite Vercel Hobby: **máximo 12 funciones**. Para no superarlo, multiplexar por
  `action` dentro de un handler existente (patrón de `save-client.js` y
  `notify.js`) en vez de crear un archivo nuevo.

## 5. Tests

- Unit (Jest) en `__tests__/`: handlers de API con Redis/Supabase mockeados.
- Integration en `__tests__/integration/`: pegan contra servicios reales (`.env`).
- Seguridad en `__tests__/security/`: inyección, forja de JWT, bypass de rate
  limit, y (a futuro) ownership/IDOR de sesión.
- E2E (Playwright) en `e2e/`: flujos completos contra `mock-server-test.js`
  (estado **in-memory**, sin tocar archivos del repo; corre `workers: 1`).
- **Definition of Done de cada cambio**: `npm test` + `npx playwright test` verdes,
  y la documentación afectada actualizada (CLAUDE.md, `docs/`, y la KB funcional).

## 6. Convención de commits

Español, estilo del log existente: resumen corto en imperativo, cuerpo que explica
el *por qué* (síntoma/bug) antes del *qué*, y cierre con qué se verificó. Sin
co-autoría ni menciones de IA.
