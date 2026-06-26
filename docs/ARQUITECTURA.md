# Arquitectura técnica — Creator-LandingPage

Sitio personal de Martín Duarte (`martinduarte.com`) + un servicio productizado de
generación de landing pages: el cliente describe su negocio en una webapp
conversacional, un wizard con LLM recolecta un brief, genera 3 previews HTML, el
cliente elige y paga, y —tras la aprobación de Martín vía un link emailado— el
diseño se despliega a `clientes/<slug>/`.

Sin build step / bundler / framework. Frontend HTML/CSS/JS vanilla servido tal
cual; backend = funciones serverless independientes de Vercel bajo `api/`.

## Componentes

```
Navegador (landing_page/)  ──>  api/*.js (Vercel serverless)  ──┬─>  Anthropic (LLM)
   wizard conversacional        proxy único: api/claude.js      ├─>  Upstash Redis (efímero)
   + generación de previews                                     └─>  Supabase Postgres (durable)
                                                                       │
   aprobación de Martín  <──  api/notify.js (email, Resend)            │
   link JWT  ──>  api/approve.js  ──>  GitHub Actions deploy-landing.yml ──> clientes/<slug>/
```

## Frontend (`landing_page/`)

- `chat.js` — máquina de estados del wizard (enum `PHASE`:
  `GREETING → EVALUATING → HERO → SOBRE_MI → SERVICIOS → TESTIMONIOS → CONTACTO →
  DISENO → DSN_REVIEW → GENERATING → SELECTING → PAYMENT → NOTIFYING → DONE`).
  Cada sección carga su prompt de `prompts/prompt_<section>.txt` + el base
  `core_wizard.txt`, y escribe el JSON extraído en `state.fullBrief[section]`.
- `generator.js` — llama a `/api/claude` con `intent=generation|redesign`, consume
  el stream SSE y renderiza el HTML contra `templates/*.css`.
- `validator.js` — registro/validación del lado cliente y propagación del id real
  de cliente de Supabase (ver gotcha de `client_id`).
- `carousel.js` — carrusel de "diseños anteriores" (alimentado por
  `/api/get-dsn-html`).
- `modal.js` — shell del modal de flujo + layout mobile/teclado (ver el skill
  `.claude/skills/landing-chat-mobile`).
- `notifier.js` — POST del resumen de fin de sesión a `/api/notify`.

> Sincronía obligatoria: el orden de secciones se enumera por separado en
> `chat.js` (`SECTION_ORDER`), `api/claude.js` (`VALID_SECTIONS`) y
> `api/_lib/redis.js` (`BRIEF_FIELDS_BY_SECTION`). Cambiar uno solo desincroniza
> en silencio.

## Backend (`api/`)

- `claude.js` — **proxy único** del LLM, ruteado por `intent`
  (`chat`/`extraction` → Haiku, `generation`/`redesign` → Sonnet). Rate limiting,
  budget guard en USD por sesión, prompt caching y streaming SSE.
- `save-client.js` / `save-session.js` / `get-session.js` — CRUD de clientes y
  sesiones (Supabase/Redis).
- `save-dsn.js` / `get-dsn-html.js` — design sets ("diseños anteriores").
- `approve.js` / `reject.js` — consumen los links JWT emailados (firma
  `APPROVAL_SECRET`, expiración 48h, uso único vía `SET NX` atómico). Approve
  dispara `deploy-landing.yml`.
- `notify.js` — multiplexado por `action` (email de aprobación + `session_summary`
  + barrido diario por cron).
- `_lib/redis.js` — Upstash (REST). Fuente única de: brief/mensajes/previews
  (TTL 48h), detección de abandono (2h), `RATE_LIMITS`, uso único de tokens,
  costo en USD por sesión, compresión de brief por sección.
- `_lib/supabase.js` — cliente service-role (RLS desactivado, acceso solo server).

## Split de almacenamiento

Redis = estado efímero en vuelo (brief, mensajes, costo, rate limits, abandono).
Supabase = registro durable (clientes, design sets terminados). Detalle del
modelo en [MODELO-DATOS.md](MODELO-DATOS.md).

## Deploy

- Código de producción (este repo) → Vercel en cada push.
- Landing pages de clientes → `approve.js` dispara `deploy-landing.yml`
  (`workflow_dispatch`), que commitea el HTML aprobado a `clientes/<slug>/index.html`
  en `main`. Es decir, son archivos estáticos versionados en este mismo repo.

## Mock / desarrollo local

- `node mock-server.js` → http://localhost:3000/landing_page/ (LLM mockeado, sin
  consumir API keys; estado **in-memory**, no toca archivos del repo).
- `LLM_PROVIDER=openrouter` redirige `/api/claude` a un modelo gratuito de
  OpenRouter para probar conversación real sin tocar Anthropic.
- E2E levanta `mock-server-test.js` (fuerza `LLM_PROVIDER=mock`).

## Identidad de sesión (Fase 1)

La identidad de una sesión es **server-side** vía una **cookie httpOnly firmada**
(`api/_lib/session.js`, firmada con `SESSION_SECRET`):

- `save-client.js action=create` emite la cookie atando el `session_id` a ese
  navegador, y `action=reset` la expira ("empezar de nuevo").
- `get-session.js`, `save-session.js` y `save-dsn.js` (POST) derivan el
  `session_id` **de la cookie** vía `requireSession(req,res)` e ignoran cualquier
  `session_id` del body/query. `claude.js` lee el sid de la cookie para el contexto
  histórico y el budget (opcional: null antes del registro).
- Esto cierra el **IDOR** que permitía leer/escribir la sesión de otra persona
  conociendo o forjando su id (causa de las "conversaciones mezcladas").
- El front (`validator.js`) ya **no reanuda en silencio** una sesión por
  `localStorage` (en un dispositivo compartido metía a alguien en la sesión de
  otro): pregunta de forma explícita y, si dicen que no, limpia cookie + storage.
  Tampoco adopta una sesión por coincidencia de email.

**Residual conocido:** `notify.js` aún usa el `session_id` del body (severidad baja
— dispara emails internos a Martín, no exfiltra datos; el cron no tiene cookie).

## Gotcha de `client_id` (resuelto en Fase 1)

El browser generaba un UUID local para `client_id` y un desajuste con el `id` real
de Supabase rompía la FK de `design_sets` en silencio. Desde la Fase 1,
`save-dsn.js` resuelve `client_id` server-side por lookup en `clients` usando el
`session_id` de la cookie — el front ya no manda `client_id`. No reintroducirlo.
