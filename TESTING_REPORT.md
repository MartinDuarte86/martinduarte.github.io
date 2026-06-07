# Reporte de Testing — 2026-06-06

## Resumen ejecutivo

- Total bugs encontrados: 4
- Bugs críticos (🔴): 1
- Bugs importantes (🟡): 2
- Bugs menores (🟢): 1
- Estado del deploy: pendiente de push

---

## Variables de entorno

| Variable | Estado | Notas |
|----------|--------|-------|
| `ANTHROPIC_API_KEY` | ✅ Requerida | Usado en `api/claude.js` |
| `GH_TOKEN` | ✅ Requerida | Usado en `api/save-client.js`, `api/save-dsn.js`, `api/notify.js` |
| `GH_OWNER` | ✅ Opcional | Default: `MartinDuarte86` |
| `GH_REPO` | ✅ Opcional | Default: `MarcaPersonal-Web` |
| `ABSTRACT_API_KEY` | ✅ Requerida | Usado en `api/validate-email.js` |
| `RESEND_API_KEY` | ✅ Requerida | Usado en `api/notify.js` para email |
| `EMAIL_FROM` | ✅ Opcional | Default: `Landing Bot <noreply@martinduarte.com>` |
| `BASE_URL` / `VERCEL_URL` | ✅ Opcional | Vercel auto-provee `VERCEL_URL` |
| `TWILIO_*` | ⚠️ No existe en código | El sistema usa Resend/email, no WhatsApp |
| `MARTIN_WHATSAPP` | ⚠️ No existe en código | Idem |
| `DRIVE_*` / `GOOGLE_*` | ⚠️ No existe en código | Google Drive no está implementado |

---

## Funcionalidades validadas (suite automática — 46 tests)

| Funcionalidad | Estado | Notas |
|---------------|--------|-------|
| Página carga sin errores | ✅ PASS | Smoke-1 |
| Modal abre con "Empezar ahora" | ✅ PASS | Smoke-2 |
| Paso 1: proyecto válido avanza | ✅ PASS | Smoke-3 |
| Paso 1: rechazo e-commerce / login | ✅ PASS | P1-1 a P1-5 |
| Paso 1: cierre con botón X | ✅ PASS | P1-6 |
| Paso 1: cierre con ESC | ✅ PASS | P1-7 |
| Paso 1: cierre con clic en overlay | ⚠️ FIXED | P1-8 — `flow-container` interceptaba clicks. Fix: listener en `flow-modal` con `contains()` |
| Paso 2: formulario habilita botón | ✅ PASS | Smoke-5 |
| Paso 2: email inválido bloqueado | ⚠️ FIXED | R6 — `updateSubmitBtn` usaba solo `length > 0`. Fix: `isValidEmailFormat()` |
| Paso 2: cierre con ESC | ✅ PASS | R8 |
| Paso 2: cierre con clic en overlay | ⚠️ FIXED | R9 — mismo fix que P1-8 |
| Paso 3: modal va a fullscreen | ✅ PASS | A5 |
| Chat: saludo personalizado | ✅ PASS | A6 |
| Chat: Claude evalúa el proyecto | ✅ PASS | A8 |
| Chat: brief completo → generación | ✅ PASS | A10-A13 |
| Chat: mensaje vacío no envía | ✅ PASS | C4 |
| Chat: Shift+Enter no envía | ✅ PASS | C6 |
| Botón 📎 oculto antes de BRAND_DEFINITION | ✅ PASS | U7 |
| Sesión activa → modal va al paso 3 | ✅ PASS | Smoke-16, D2 |
| localStorage limpio → modal al paso 1 | ✅ PASS | Smoke-17 |
| Link de Mercado Pago | ⚠️ FIXED | `MP_LINK = 'REEMPLAZAR'`. Fix: `https://mpago.la/1Dufc3b` |
| Notificación email (Resend) | ✅ Código correcto | `api/notify.js` → Resend + GitHub Gist |
| Guardado `clientes.json` | ✅ Código correcto | GitHub REST API |
| Guardado `dsn/` con file paths | ✅ Código correcto | `api/save-dsn.js` → `dsn/template/{setId}-template-N.html` |
| CSS duplicado | ⚠️ FIXED | Bloque `.flow-modal` aparecía 2 veces. Eliminado el duplicado (−171 líneas) |
| Carrusel dsn/ (B2/B3/B5) | ⏭️ SKIP | `dsn/index.json` vacío en el momento del test. Flujo de código verificado manualmente. |

---

## Bugs encontrados y reparados

### 🔴 Bug 1 — MP_LINK hardcodeado con valor placeholder
- **Archivo:** `landing_page/chat.js:7`
- **Problema:** `const MP_LINK = 'https://mpago.la/REEMPLAZAR'` — nadie podía pagar
- **Fix:** `const MP_LINK = 'https://mpago.la/1Dufc3b'`

### 🟡 Bug 2 — Overlay del modal no cerraba (pasos 1 y 2)
- **Archivo:** `landing_page/modal.js`
- **Problema:** El handler de cierre estaba en `#flow-overlay` pero `flow-container` (z-index:1) interceptaba todos los clicks. Playwright fallaba con "subtree intercepts pointer events"
- **Fix:** Cambié el listener al elemento `#flow-modal` (el padre) con check `!container.contains(e.target)`. Patrón estándar "click outside to close"

### 🟡 Bug 3 — Email inválido habilitaba el botón "Empezar el chat"
- **Archivo:** `landing_page/validator.js:79`
- **Problema:** `updateSubmitBtn` verificaba `email.length > 0` (TODO comentado). Un email sin `@` pasaba la validación
- **Fix:** Reemplazado por `isValidEmailFormat(email)` — la función ya existía y se usaba solo para el error inline, no para habilitar el botón

### 🟢 Bug 4 — CSS del flow modal duplicado
- **Archivo:** `landing_page/styles.css`
- **Problema:** El bloque `.flow-modal` y todas sus clases aparecía dos veces (líneas 707-850 y 1058-1227). En CSS el segundo bloque sobreescribía al primero silenciosamente
- **Fix:** Eliminado el segundo bloque duplicado (−171 líneas, de 1227 a 1056)

---

## Pendiente de acción manual por Martín

1. **Configurar variables de entorno en Vercel Dashboard:**
   - `ANTHROPIC_API_KEY`
   - `GH_TOKEN` (con permisos de escritura al repo)
   - `ABSTRACT_API_KEY`
   - `RESEND_API_KEY`

2. **Confirmar dominio en Resend** para que `noreply@martinduarte.com` pueda enviar emails

3. **El sistema NO usa Twilio/WhatsApp ni Google Drive** — si se requieren en el futuro, implementar por separado

---

## URL de producción
https://ia-landing-page-flax.vercel.app/landing_page/  
Estado: **pendiente de deploy** (push no ejecutado aún — ver PASO 5)
