# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es este repo

El sitio personal de Martín Duarte (`martinduarte.com`) más un **servicio de generación de landing pages** productizado y mayormente automatizado: un cliente describe su negocio en una webapp conversacional, un wizard con LLM recolecta un brief, genera 3 previews HTML, el cliente elige uno y paga, y — tras la aprobación de Martín vía un link emailado — el diseño elegido se despliega automáticamente a `clientes/<slug>/`.

No hay build step / bundler / framework. Todo el frontend es HTML/CSS/JS vanilla servido tal cual; el backend es un conjunto de funciones serverless independientes de Vercel bajo `api/`.

## Comandos

```bash
npm test                  # Tests unitarios Jest (__tests__/**), forceExit
npm run test:watch        # Jest en modo watch
npm run test:integration  # Solo __tests__/integration/** (pega contra Redis/Supabase reales — necesita .env)
npm run test:e2e          # Playwright e2e contra un mock server local (e2e/**)
npm run test:e2e:ui       # Playwright en modo UI
npm run test:all          # unit + integration + e2e, en secuencia
```

Correr un solo archivo de test Jest: `npx jest __tests__/api/claude.test.js`
Correr un solo spec de Playwright: `npx playwright test e2e/03-diseno-nuevo.spec.js`

Servidor de desarrollo manual local (no consume ninguna API key, el LLM está totalmente mockeado):
```bash
node mock-server.js   # → http://localhost:3000/landing_page/
```
Definir `LLM_PROVIDER=openrouter` en `.env` (con `OPENROUTER_API_KEY`) hace que el mock server redirija las llamadas a `/api/claude` a un modelo gratuito real de OpenRouter en vez de respuestas mockeadas — útil para probar comportamiento conversacional real sin tocar el stack de Anthropic que usa producción. Usar siempre modelos gratuitos (sufijo `:free`).

Playwright e2e (`playwright.config.js`) levanta `mock-server-test.js` (fuerza `LLM_PROVIDER=mock` sin importar el `.env`) y corre **secuencialmente** (`workers: 1`) porque el mock server comparte estado en memoria entre tests. Headless solo con `PWHEADLESS=1`; por defecto corre con ventana visible.

Scripts extra fuera de los runners de Jest/Playwright (no están en los scripts de npm):
- `node e2e/security-checks.mjs [--prod]` — chequeos de seguridad en vivo (aislamiento de sesión, resiliencia a ráfagas, inyección por payload); `--prod` agrega una prueba real contra el rate limit de producción.
- `node e2e/smoke-prod.mjs` / `node e2e/smoke-generation-prod.mjs` — smoke tests contra el deploy real de Vercel. Disparan una llamada de generación real a Anthropic (~US$0.35) — correr con moderación, no en cada cambio.

## Arquitectura

### Frontend (`landing_page/`)
Wizard conversacional estático, sin framework:
- `chat.js` (~1400 líneas) — la máquina de estados del wizard. El enum `PHASE` maneja todo (`GREETING → EVALUATING → HERO → SOBRE_MI → SERVICIOS → TESTIMONIOS → CONTACTO → DISENO → DSN_REVIEW → GENERATING → SELECTING → PAYMENT → NOTIFYING → DONE`). Cada fase de sección carga su propio prompt desde `landing_page/prompts/prompt_<section>.txt`, comparte un prompt base `core_wizard.txt`, y escribe el JSON extraído en `state.fullBrief[section]`.
- `generator.js` — llama a `/api/claude` con `intent=generation|redesign`, consume el stream SSE, renderiza el HTML resultante contra `landing_page/templates/*.css`.
- `validator.js` — validación de formulario/datos del lado cliente; también es el lugar que propaga el **UUID real de cliente de Supabase** (no uno generado en el browser) a `getClientData().id` — ver el gotcha de "client_id" más abajo.
- `carousel.js` — carrusel de "diseños anteriores" (DSN) mostrado antes de preguntar el estilo visual, alimentado por filas de `design_sets` vía `/api/get-dsn-html`.
- `modal.js` — shell del modal de flujo, layout full-screen mobile y manejo de teclado. **Leer `.claude/skills/landing-chat-mobile/SKILL.md` antes de tocar comportamiento de viewport/teclado/scroll mobile en este archivo — actualizarlo en el mismo cambio si el mecanismo cambia.**
- `notifier.js` — cliente liviano que hace POST del resumen de fin de sesión a `/api/notify`.

El orden de secciones y los prompts deben mantenerse sincronizados entre `chat.js` (`SECTION_ORDER`), `api/claude.js` (`VALID_SECTIONS`) y `api/_lib/redis.js` (`BRIEF_FIELDS_BY_SECTION`) — estos tres enumeran independientemente las mismas seis secciones (`hero, sobre_mi, servicios, testimonios, contacto, diseno`) y se desincronizan en silencio si se actualiza solo uno.

### Backend (`api/`) — funciones serverless independientes de Vercel
No hay router compartido; cada archivo en `api/*.js` es su propio endpoint, e importa lógica compartida desde `api/_lib/`.

- `claude.js` — proxy único para todas las llamadas al LLM, ruteado por `intent` (`chat`/`extraction` → Haiku, `generation`/`redesign` → Sonnet). Maneja rate limiting, un guardrail de presupuesto en USD por sesión (env vars `COST_LIMIT_ARS` / `ARS_USD_RATE`), construcción de bloques de sistema aprovechando prompt caching, y streaming SSE para generación/rediseño. Es el archivo a leer primero para entender los guardrails de costo/seguridad.
- `save-client.js` / `save-session.js` / `get-session.js` — CRUD de clientes y sesiones contra Supabase/Redis.
- `save-dsn.js` / `get-dsn-html.js` — persistencia y recuperación de design sets ("diseños anteriores").
- `approve.js` / `reject.js` — consumen los links JWT emailados a Martín. JWT firmado con `APPROVAL_SECRET`, expira en 48h, **uso único garantizado vía `SET NX` atómico en Redis** (`markTokenUsedIfNew` — TOCTOU-safe, no reemplazar por un check de leer-y-luego-escribir). Al aprobar, dispara el workflow de GitHub Actions `deploy-landing.yml` con el HTML elegido (en base64) para commitearlo en `clientes/<slug>/index.html`.
- `notify.js` — multiplexado por `action` (mismo patrón que `save-client.js`) para no superar el límite de 12 funciones del plan Hobby de Vercel. Maneja tanto el email de solicitud de aprobación a Martín como `action=session_summary` (un resumen de abandono/finalización generado con Haiku), disparado en la compra, al detectar un pedido explícito de "hablar con una persona", vía `sendBeacon` al cerrar la pestaña, y por un barrido diario con cron (`vercel.json` → `GET /api/notify` + `CRON_SECRET`) sobre `sessions:open` para sesiones que nunca avisaron.
- `_lib/redis.js` — Upstash Redis (`@upstash/redis`, basado en REST, sin conexión persistente). **Única fuente de verdad** para: brief/mensajes/previews de sesión (TTL 48h), detección de sesión abandonada (2h de inactividad), tablas de rate limit (`RATE_LIMITS` — no duplicar esta tabla en otro lado), uso único de tokens, tracking de costo en USD por sesión, y compresión del brief por sección para inyección de contexto al LLM.
- `_lib/supabase.js` — cliente de Supabase con service-role (bypasea RLS; RLS está desactivado en `clients`/`design_sets` según `supabase/001_initial_schema.sql` porque el acceso es solo desde el servidor).

### Modelo de datos (`supabase/*.sql`)
- `clients` — una fila por sesión/cliente; máquina de estados en `estado` (`iniciado → evaluando → onboarding → diseños_generados → pago_pendiente → pagado → aprobado/rechazado`); `full_brief` JSONB guarda todo el brief recolectado (estructura plana, no anidada — `notify.js` y `chat.js` deben coincidir en esta forma).
- `design_sets` — todos los diseños generados (no solo el comprado), vinculados a `clients.id` vía FK (`client_id`). Un booleano `vendido` (agregado en `002_design_sets_vendido.sql`) marca el comprado en vez de duplicar filas. El HTML vive en Redis mientras la sesión está activa (48h) y se persiste a `design_sets.html_preview` después, para el carrusel de "diseños anteriores".

**Gotcha conocido (ya arreglado una vez, vigilar regresión):** el browser genera un UUID local para `client_id` vía `validator.js`, pero Supabase asigna su propio `id` al insertar en `save-client.js`. Cualquier escritura de FK hacia `design_sets.client_id` debe usar el id **asignado por el servidor** (devuelto por `save-client.js` al crear o ante conflicto), no el local del browser — un desajuste hace fallar el insert por FK en silencio y rompe el carrusel de "diseños anteriores".

### Razón del split de almacenamiento
Redis (Upstash) = estado de sesión efímero, en vuelo (brief, mensajes, costo, rate limits, abandono). Supabase (Postgres) = registro durable (clientes, design sets terminados). Tratar Redis como scratch space con TTL, no como sistema de registro.

### Flujo de deploy
El código de producción (este repo, `martinduarte.com`) se despliega vía Vercel en cada push. Las **landing pages de clientes** generadas se despliegan por separado: `approve.js` dispara `deploy-landing.yml` (`workflow_dispatch`), que escribe el HTML aprobado en `clientes/<slug>/index.html` y lo commitea directo a `main` — es decir, las landing pages de clientes son archivos estáticos versionados en este mismo repo, no un hosting separado.

### Tests
- `__tests__/api/*`, `__tests__/coverage/*` — tests unitarios contra los handlers de la API (Redis/Supabase mockeados).
- `__tests__/integration/*` — pegan contra Redis/Supabase reales, necesitan `.env` completo.
- `__tests__/resilience/*` — casos límite del guardrail de presupuesto y de límites de payload.
- `__tests__/security/*` — intentos de inyección, falsificación de JWT, bypass de rate limit.
- `e2e/0*-*.spec.js` — flujos completos del wizard (camino feliz, rediseño, pago exitoso/rechazado) contra `mock-server-test.js`.
- `e2e/10-casos-de-uso-auditoria.spec.js` — cobertura más amplia de casos de uso tipo auditoría.

`jest.setup.js` agrega un polyfill global de `WebSocket` (vía `ws`) porque `@supabase/realtime-js` espera un `WebSocket` nativo, no disponible en Node < 22.

## Restricciones de marca (de `.codex/rules.md`)

- Paleta: primary `#0F172A`, brand `#2563EB`, bg `#F8FAFC`. Tipografía: titulares en `Space Grotesk`, cuerpo en `Plus Jakarta Sans`.
- `Master en Inteligencia Artificial (UdeSA)` siempre debe figurar primero en cualquier listado académico/de credenciales.
- Brochures de servicio: mínimo 3 páginas, deben incluir una página de perfil/autoridad más páginas de detalle derivadas del servicio, y el PDF impreso (`@media print`) debe coincidir con la tipografía/sistema de color de la landing. Todo brochure de servicio necesita tanto una fuente HTML como un PDF derivado de ese HTML.
- `ca-pub-1594572872514423` (AdSense) debe permanecer en el `<head>`.
- Cualquier CTA de `Agendar reunión` debe abrir el formulario calificador de 5 pasos; al completarlo, redirigir automáticamente a `https://calendly.com/martynduarte/sample-30min`.

## Documentación y base de conocimiento

Tres lugares, sin solapamiento:

- **`docs/`** (en el repo, versionado) — documentación **técnica**: arquitectura
  ([docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)), modelo de datos
  ([docs/MODELO-DATOS.md](docs/MODELO-DATOS.md)), el patrón único de desarrollo
  ([docs/PATRON-DESARROLLO.md](docs/PATRON-DESARROLLO.md)) y el backlog. `README.md`
  raíz es el punto de entrada.
- **`CLAUDE.md`** (este archivo) — guía operativa del agente: comandos, arquitectura
  en grande, gotchas y restricciones de marca.
- **Base de conocimiento central (Drive)** — documentación **funcional / de
  negocio** (servicio, flujo, wizard, estados/políticas, métricas):
  `G:\Mi unidad\Nueva carpeta\Mint to martin\0001-Marca personal\Herramientas\Creator-LandingPage`
  (subcarpetas `funcional/`, `tecnica/`, `operacion/`).

**Regla de mantenimiento:** toda doc funcional relevante se actualiza en la KB de
Drive; lo técnico de detalle en `docs/`; ambos quedan indexados acá. Al cierre de
cada fase de trabajo se actualizan los tres (es parte del Definition of Done).

> Nota de reorganización (Fase 0): se eliminó código/data muerto
> (`chat-session-patch.js`, y la data legacy `landing_page/data/clientes.json`,
> `landing_page/dsn/`, `landing_page/previews/index.json`, ya reemplazada por las
> tablas `clients`/`design_sets` de Supabase). El mock de tests usa estado
> in-memory, sin tocar archivos del repo.

## Flujo de Git (obligatorio)

**Cada implementación o cambio de código se commitea y se pushea a GitHub.** Apenas
una unidad de trabajo queda terminada y verificada (suite verde), se hace `commit`
y `push` — no se acumulan cambios sin versionar en el working tree.

- Verificar antes de commitear: `npm test` (y `npx playwright test` si el cambio
  toca el flujo) deben pasar.
- Un commit por unidad lógica de cambio, con el mensaje siguiendo la convención de
  abajo.
- Pushear inmediatamente después del commit.

## Mensajes de commit

Escribir mensajes de commit en español, siguiendo el estilo del log existente: una línea resumen corta en imperativo, luego un cuerpo que explica el *por qué* (el bug/síntoma que motivó el cambio) antes del *qué*, y una línea de cierre indicando qué se verificó (ej: cantidad de tests corridos).
