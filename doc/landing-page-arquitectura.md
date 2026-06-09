# Landing Page Service — Arquitectura y Documentación Técnica

> **Última actualización:** 2026-06-08
> **Rama principal:** `main`
> **Repo:** `MartinDuarte86/MarcaPersonal-Web`
> **Prod:** `https://martinduarte.com` · Deploy en Vercel

---

## 1. Visión general del servicio

Sistema conversacional que guía a un cliente potencial a través de un chat con IA hasta generar tres diseños de landing page personalizados en HTML. El cliente elige uno, confirma el pago, y se dispara una notificación al operador (Martín) con la previsualización y los botones de aprobar/rechazar deploy.

**Precio actual:** $40.000 ARS por landing page entregada.

---

## 2. Flujo completo de usuario

```
Formulario de registro
        ↓
Evaluación (IA decide si el proyecto aplica)
        ↓
Wizard por secciones (6 secciones):
  1. Hero
  2. Sobre mí / Nosotros
  3. Servicios
  4. Testimonios
  5. Contacto
  6. Estilo visual / Diseño
        ↓
Revisión de diseños anteriores (DSN carousel)  ←─ si existen
        ↓
Generación de 3 diseños personalizados (Claude Sonnet)
        ↓
Selección de diseño por el cliente
        ↓
Confirmación de pago (Mercado Pago link)
        ↓
Notificación al operador (email Resend + Gist preview)
        ↓
Operador aprueba/rechaza deploy
```

---

## 3. Arquitectura de archivos

```
MarcaPersonal Web/
├── landing_page/
│   ├── index.html          → UI principal: formulario + chat + previews
│   ├── styles.css          → Estilos globales del chat
│   ├── chat.js             → Motor del chat, estado, fases, llamadas a LLM
│   ├── generator.js        → Templates, generación de previews HTML, modal zoom
│   ├── validator.js        → Formulario de registro, validación email, saveSession
│   ├── carousel.js         → Widget carrusel: diseños anteriores y nuevos
│   ├── modal.js            → Modal multi-paso (formulario → chat → pago)
│   ├── notifier.js         → Llama a /api/notify desde el front
│   ├── prompts/
│   │   ├── evaluacion.txt          → Fase 1: evalúa si el proyecto aplica
│   │   ├── prompt_hero.txt         → Sección Hero
│   │   ├── prompt_sobre_mi.txt     → Sección Sobre mí / Nosotros
│   │   ├── prompt_servicios.txt    → Sección Servicios
│   │   ├── prompt_testimonios.txt  → Sección Testimonios
│   │   ├── prompt_contacto.txt     → Sección Contacto
│   │   ├── prompt_diseno.txt       → Sección Estilo Visual
│   │   └── generacion.txt          → Prompt de generación del HTML final
│   ├── templates/          → CSS por template (8 estilos)
│   ├── previews/           → HTMLs de ejemplo precargados por template
│   ├── dsn/                → Sets de diseños guardados (index.json + meta.json + templates)
│   └── data/
│       └── clientes.json   → Registro de clientes (versionado en GitHub)
├── api/                    → Serverless functions (Vercel)
│   ├── claude.js           → Proxy Anthropic API + rate limiting
│   ├── save-client.js      → Guarda/actualiza clientes.json via GitHub REST
│   ├── save-dsn.js         → Guarda sets de diseños en dsn/ via GitHub REST
│   ├── upload-file.js      → Sube archivos del cliente a GitHub
│   ├── notify.js           → Crea Gist privado + envía email via Resend
│   ├── approve.js          → Aprueba deploy (token en query param)
│   ├── reject.js           → Rechaza pedido (token en query param)
│   └── validate-email.js   → Valida email via Abstract API
├── mock-server.js          → Servidor local de desarrollo (Node.js, puerto 3000)
└── vercel.json             → Config Vercel (version: 2)
```

---

## 4. Estado del chat (`chat.js`)

Todo el estado de la sesión vive en memoria del navegador — **no hay persistencia entre recargas**. La única persistencia parcial es `saveSession()` (guarda en `sessionStorage` el brief acumulado a medida que avanzan las secciones).

```js
state = {
  phase: 'greeting',      // fase actual del flujo
  messages: [],           // historial de la sección activa (se RESETEA entre secciones)
  prompts: {},            // prompts cargados desde /prompts/*.txt
  fullBrief: {            // datos JSON acumulados sección por sección
    hero, sobre_mi, servicios, testimonios, contacto, diseno
  },
  brief: null,            // brief plano final (construido al cerrar la sección diseno)
  previews: [],           // HTMLs generados por Claude Sonnet
  selectedPreview: null,  // diseño elegido por el cliente
  uploadedFiles: [],      // archivos ya subidos a GitHub
  pendingFiles: [],       // archivos pendientes de subir
}
```

### Fases del flujo (`PHASE`)

| Fase | Descripción |
|------|-------------|
| `greeting` | Estado inicial — mensaje de bienvenida estático |
| `evaluating` | IA evalúa si el proyecto aplica para landing page |
| `hero` | Wizard sección 1: nombre de marca, slogan, propuesta de valor |
| `sobre_mi` | Wizard sección 2: historia, tipo personal/empresa, diferencial |
| `servicios` | Wizard sección 3: lista de servicios con descripción y precios |
| `testimonios` | Wizard sección 4: decide si incluir testimonios y los recolecta |
| `contacto` | Wizard sección 5: WhatsApp, email, redes, zona, horarios |
| `diseno` | Wizard sección 6: colores, estilo visual, referencias, adjuntos |
| `dsn_review` | Revisión de sets de diseños anteriores (carousel) |
| `generating` | Generando 3 diseños con Claude Sonnet (bloqueante) |
| `selecting` | Cliente elige diseño del carrusel generado |
| `payment` | Confirmación de pago via Mercado Pago |
| `notifying` | Enviando notificación al operador |
| `done` | Flujo completado |

---

## 5. Prompts del sistema

### `evaluacion.txt`
- **Rol:** asistente comercial de Martín Duarte
- **Objetivo:** decide si el proyecto aplica para landing page ($40.000 ARS)
- **Criterios de aceptación:** producto/servicio definido, sin e-commerce, sin login, objetivo de contacto
- **Respuesta:** JSON `{ aplica, motivo, respuesta_cliente, siguiente_accion }`
- `siguiente_accion` puede ser: `"onboarding"` | `"seguir_conversando"` | `"rechazar"`

### Prompts por sección (`prompt_*.txt`)
Cada uno recolecta entre 2-3 turnos los datos necesarios para su sección y devuelve JSON con `"seccion": "<nombre>"`. El sistema detecta cuándo el JSON tiene la sección correcta y avanza automáticamente a la siguiente.

| Prompt | Datos que recolecta |
|--------|---------------------|
| `prompt_hero.txt` | `nombre_marca`, `rubro`, `slogan`, `propuesta_valor` |
| `prompt_sobre_mi.txt` | `tipo` (personal/empresa), `historia`, `experiencia_o_equipo`, `diferencial` |
| `prompt_servicios.txt` | `servicios[]` (nombre + descripción), `precio_visible`, `precios[]` |
| `prompt_testimonios.txt` | `incluir` (bool), `testimonios[]` (nombre, cargo, texto), `son_reales` |
| `prompt_contacto.txt` | `contacto_wsp`, `email`, `redes{}`, `zona`, `horarios` |
| `prompt_diseno.txt` | `colores[]`, `colores_hex[]`, `estilo`, `tipografia`, `tono`, `referencias` |

### `generacion.txt`
- **Variables:** `{{full_brief}}`, `{{template_name}}`, `{{template_spec}}`, `{{contacto_wsp}}`
- **Salida:** HTML completo autocontenido (un único archivo, sin dependencias externas)
- **Restricciones:** mobile-first, Google Fonts vía `@import`, sin backend, formulario de contacto via `wa.me/` o `mailto:`

---

## 6. Templates de diseño (8 estilos)

| ID | Nombre | Tipografía | Ideal para |
|----|--------|------------|------------|
| `calido-artesanal` | Cálido Artesanal | Playfair Display + Lato | Artesanal, sustentable |
| `minimalista` | Minimalista Profesional | Space Grotesk + Plus Jakarta | Consultoría, marca personal |
| `moderno-oscuro` | Moderno Oscuro | Space Grotesk + Plus Jakarta | Tech, software, agencias |
| `editorial-limpio` | Editorial Limpio | Cormorant Garamond + Inter | Gastronomía, moda, eventos |
| `natural-sereno` | Natural Sereno | DM Serif Display + DM Sans | Salud, bienestar, coaching |
| `gourmet-calido` | Gourmet Cálido | Italiana + Josefin Sans | Gastronomía, catering |
| `fresco-accesible` | Fresco Accesible | Nunito | Cursos, talleres, academia |
| `portafolio-oscuro` | Portafolio Oscuro | Bebas Neue + Inter | Fotografía, arte, diseño |

El sistema detecta el rubro automáticamente (`detectRubroCategory()`) y selecciona los 3 templates más afines para generar las opciones del cliente.

---

## 7. APIs serverless (`/api/`)

### `POST /api/claude` — Proxy Anthropic
- **Auth:** `ANTHROPIC_API_KEY` (env var Vercel)
- **Modelos permitidos:** `claude-haiku-4-5-20251001` (chat), `claude-sonnet-4-6` (generación)
- **Rate limiting en memoria:**
  - Chat/evaluación: 10 requests/IP/hora
  - Generación: 2/IP/24h
  - Extracción semántica (`intent: "extraction"`): sin límite
- **CORS:** whitelist de dominios en `ALLOWED_ORIGINS`; headers `Vary: Origin`

### `POST /api/save-client` — Registro de clientes
- **Storage:** `landing_page/data/clientes.json` en el repositorio GitHub via REST API
- **Acciones:** `"create"` (nuevo cliente) | `"feedback"` (guarda feedback de diseño)
- **Deduplicación:** detecta email repetido y devuelve `409 email_exists`
- **Auth:** `GH_TOKEN` (env var)

### `POST /api/save-dsn` — Guardado de sets de diseños
- **Storage:** `landing_page/dsn/` en GitHub
  - `dsn/index.json`: índice de hasta 10 sets (rota el más antiguo)
  - `dsn/<id>/meta.json`: rubro, fecha, cliente_id
  - `dsn/template/<id>-template-<n>.html`: HTMLs generados
- **Auth:** `GH_TOKEN`

### `POST /api/upload-file` — Subida de archivos del cliente
- **Límite:** 5 archivos, 3 MB por archivo (margen para el body limit de Vercel de 4.5 MB + base64)
- **Storage:** GitHub REST API

### `POST /api/notify` — Notificación al operador
Flujo en 2 pasos:
1. Crea un **GitHub Gist privado** con el HTML elegido → obtiene `gist_id`
2. Construye URLs firmadas: `approve?token=<base64>` y `reject?token=<base64>`
3. Envía email via **Resend API** a `martynduarte@gmail.com` con:
   - Datos del cliente y brief completo
   - Botón "Aprobar deploy" y "Rechazar"
   - Link a `preview.html?gist_id=<id>` para ver la preview antes de aprobar

### `GET /api/approve` y `GET /api/reject`
- Reciben un `token` en query param (base64 con `{ slug, gist_id, nombre_marca }`)
- Aprueban o rechazan el deploy sin autenticación adicional (token de un solo uso por design)

### `POST /api/validate-email`
- Valida el email del formulario de registro via **Abstract API**
- `ABSTRACT_API_KEY` (env var)

---

## 8. Infraestructura Vercel

### Configuración
```json
// vercel.json
{ "version": 2 }
```
Configuración mínima — Vercel detecta automáticamente:
- Archivos en `api/` como serverless functions (Node.js)
- Resto del repo como sitio estático

### Variables de entorno (Vercel Dashboard)
| Variable | Uso |
|----------|-----|
| `ANTHROPIC_API_KEY` | Llamadas a Claude API desde `/api/claude` |
| `GH_TOKEN` | GitHub REST: leer/escribir `clientes.json`, `dsn/`, Gists |
| `GH_OWNER` | `MartinDuarte86` |
| `GH_REPO` | `MarcaPersonal-Web` |
| `ABSTRACT_API_KEY` | Validación de emails |
| `RESEND_API_KEY` | Envío de emails de notificación |
| `EMAIL_FROM` | `Landing Bot <noreply@martinduarte.com>` |
| `BASE_URL` | URL base para links de approve/reject (auto-provista por Vercel como `VERCEL_URL` si no se define) |

### Dominio y dominios habilitados en CORS
- `https://martinduarte.com`
- `https://www.martinduarte.com`
- `https://ia-landing-page-flax.vercel.app`
- `https://ia-landing-page-martinduarte86s-projects.vercel.app`
- Patrón: `https://ia-landing-page*.vercel.app`
- Local: `http://localhost:3000` y `http://localhost:5500`

### Pago
- **Mercado Pago:** link hardcodeado `https://mpago.la/1Dufc3b` — el cliente hace clic en el chat y luego confirma manualmente.

---

## 9. Servidor local de desarrollo (`mock-server.js`)

Servidor Node.js puro (sin dependencias externas) en el puerto 3000.

### Modos de operación

**Modo mock (por defecto):**
```
node mock-server.js
```
Todas las llamadas a `/api/claude` devuelven respuestas pregrabadas por sección. No consume tokens.

**Modo OpenRouter (real, con modelos gratuitos):**
```
# .env:
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=nvidia/nemotron-nano-9b-v2:free

node mock-server.js
```
Redirige `/api/claude` a OpenRouter con traducción automática de formato Anthropic ↔ OpenAI-compatible. No modifica `api/claude.js` ni el stack de producción.

**Modelos gratuitos configurados en whitelist:**
- `nvidia/nemotron-nano-9b-v2:free` ← default actual
- `nvidia/nemotron-3-nano-30b-a3b:free`
- `nvidia/nemotron-3-super-120b-a12b:free`
- `deepseek/deepseek-chat-v3-0324:free` ← actualmente sin disponibilidad gratuita en OpenRouter
- `deepseek/deepseek-r1:free` ← actualmente sin disponibilidad gratuita en OpenRouter

Otras APIs (validate-email, save-client, save-dsn, notify) siempre quedan mockeadas — no hacen llamadas externas en local.

---

## 10. Últimas modificaciones significativas

### `feat: conexion opcional a OpenRouter` (`3d98e6c`) — 2026-06-08
- `mock-server.js`: carga `.env` sin dependencias, agrega `callOpenRouter()`, toggle `LLM_PROVIDER`
- `callOpenRouter()` traduce Anthropic format → OpenAI-compatible y la respuesta de vuelta
- `.env.example`: documenta `LLM_PROVIDER`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`

### `refactor: onboarding por secciones independientes` (`7f8828d`) — 2026-06-07
**Cambio arquitectónico mayor.** Reemplazó el flujo monolítico (un único prompt `onboarding.txt`, `extractor.js` y `session.js`) por seis prompts independientes por sección.

Motivación:
- El flujo anterior acumulaba todos los datos en una sola conversación larga, lo que agotaba el límite de 10 req/hora de la IP del usuario antes de cerrar.
- Cada sección ahora tiene su propia conversación limpia (máx. 10 mensajes), con JSON estructurado al cierre.

Archivos afectados:
- `chat.js`: reescritura del motor (wizard por secciones, `fullBrief`, `advanceToNextSection`)
- `generator.js`: cambio de variables `{{datos_cliente}}` / `{{secciones}}` → `{{full_brief}}` / `{{contacto_wsp}}`
- `mock-server.js`: mocks por sección (uno por prompt)
- **Archivos renombrados a `.bak`:** `extractor.js`, `session.js`, `prompts/onboarding.txt`

### `feat: extractor híbrido` (`29da5d6`)
- Extracción contextual posicional en `extractor.js` (sin diccionario de vocabulario por rubro)
- Extracción semántica al cierre via Claude Haiku con todo el historial (`intent: "extraction"`)
- `session.js`: sesión atada a nombre+apellido para evitar contaminación entre clientes

### `fix: onboarding cierra sin JSON` (`e1100ff`)
- Detección de cierre de onboarding aunque Claude no incluya JSON adjunto
- `buildBriefFromSession()` como fallback mínimo desde `session.collectedData`
- Prevención de preguntas redundantes en brand definition (`detectarConfirmacionVisual()`)

### `fix: arquitectura de memoria del chat` (`234c27d`)
- `session.js`: estado estructurado en `sessionStorage` con `buildContextBlock()`
- `extractor.js`: extracción por regex sin llamadas a API
- Hard limit de mensajes por sección alineado con `api/claude.js` (20 mensajes)

---

## 11. Limitaciones conocidas y deuda técnica

| Tema | Descripción |
|------|-------------|
| **Rate limiting en memoria** | El mapa IP/contador es por instancia serverless. Vercel puede tener múltiples instancias simultáneas, por lo que el límite real puede multiplicarse. Para escalar correctamente se necesita KV/Redis (Vercel KV o Upstash). |
| **Historial no persistente** | Si el cliente recarga la página, pierde toda la conversación. No hay recuperación de sesión en el wizard actual. |
| **Token de aprobación sin expiración** | Los links de `approve?token=` y `reject?token=` no caducan. |
| **Pago manual** | El cliente solo hace clic en el link de MP — no hay webhook de confirmación automática. El operador aprueba en base a confianza o verificación manual. |
| **Archivos .bak en repo** | `extractor.js.bak`, `session.js.bak`, `onboarding.txt.bak` — referencia del flujo anterior, pueden eliminarse cuando el nuevo flujo esté estable. |
| **DSN carousel sin paginación** | `dsn/index.json` retiene máximo 10 sets; los más antiguos se eliminan automáticamente. |
