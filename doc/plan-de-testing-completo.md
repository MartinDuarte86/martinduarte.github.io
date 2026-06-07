# Plan de Testing Integral — MarcaPersonal Web

## 📋 Alcance

Este plan cubre **toda la aplicación**: sitio principal (`index.html`), aplicación landing page service (`/landing_page/`), APIs serverless (`/api/`), brochures descargables y archivos estáticos.

---

## 1. Estado Actual de Cobertura

| Área | Estado | Archivos |
|------|--------|----------|
| Landing Page Service (E2E) | ✅ CUBIERTO | `tests/e2e_test_suite.py`, `doc/testing-plan-e2e.md` |
| Landing Page Service (diagnóstico) | ✅ CUBIERTO | `tests/diagnostic.py` |
| Sitio principal (`index.html`) | ❌ NO CUBIERTO | — |
| APIs Vercel serverless | ❌ NO CUBIERTO | `api/*.js` |
| Módulos JS unitarios | ❌ NO CUBIERTO | `landing_page/*.js` |
| Accesibilidad (a11y) | ❌ NO CUBIERTO | — |
| Rendimiento / Lighthouse | ❌ NO CUBIERTO | — |
| Responsividad / Mobile | ❌ NO CUBIERTO | — |
| Brochures PDF | ❌ NO CUBIERTO | `brochures/*.pdf` |
| Integración continua (CI) | ❌ NO CUBIERTO | — |

---

## 2. Pirámide de Testing Propuesta

```
        ┌─────────┐
        │   E2E   │  ← Tests de flujo completo (ya existen)
        │   (5%)  │
       ┌┴─────────┴┐
       │ Integración│  ← APIs + módulos JS combinados
       │   (15%)   │
      ┌┴───────────┴┐
      │  Unitarios  │  ← Módulos JS individuales
      │   (40%)    │
     ┌┴─────────────┴┐
     │   Static/UI   │  ← HTML, CSS, accesibilidad, responsive
     │    (40%)     │
     └───────────────┘
```

---

## 3. Test Plan Detallado

### 3.1 Sitio Principal (`index.html`)

#### 3.1.1 Tests Visuales y de HTML

| ID | Escenario | Resultado esperado | Herramienta |
|----|-----------|--------------------|-------------|
| S-01 | Carga de la página sin errores JS | 0 errores en consola | Playwright + Chrome DevTools |
| S-02 | Etiquetas `<meta>` y SEO | Open Graph, description, canonical presentes | `html-validate` |
| S-03 | Google AdSense script presente | Script de adsbygoogle cargado sin errores | Inspección manual |
| S-04 | Tailwind CSS cargado correctamente | Clases de Tailwind aplicadas (ej: `text-6xl`) | Playwright |
| S-05 | Chart.js carga y se inicializa | Canvas con gráficos Radar y Doughnut visibles | Playwright |
| S-06 | Google Fonts se aplican | `font-family: 'Space Grotesk'` presente en headings | Playwright computed style |
| S-07 | Imagen de perfil carga | `<img src="assets/martin-profile.jpg">` con dimensions > 0 | Playwright |

#### 3.1.2 Tests de Navegación

| ID | Escenario | Resultado esperado |
|----|-----------|--------------------|
| S-08 | Menú de navegación visible | Navbar fixed con logo, links y botón "Agendar reunión" |
| S-09 | Links de navegación internos | `#codex`, `#servicios`, `#academia` scroll suave |
| S-10 | Dropdown de Servicios | Al hacer hover se muestra menú con Data, E-Commerce, etc. |
| S-11 | Links a brochures descargables | Cada botón "Descargar Brochure 📥" apunta a PDF existente |
| S-12 | Footer con año actual | "© 2026 Martín Duarte" visible |
| S-13 | Link a LinkedIn funcional | `href="https://linkedin.com/in/martinduarte"` target=_blank |

#### 3.1.3 Tests del Modal de Agendamiento (Booking)

| ID | Escenario | Resultado esperado |
|----|-----------|--------------------|
| S-14 | Modal se abre al clickear botón | Overlay + formulario de 5 pasos visible |
| S-15 | Paso 1: validación de campos vacíos | Errores en campos requeridos |
| S-16 | Paso 1: datos válidos avanzan al paso 2 | Indicador de paso actualizado |
| S-17 | Paso 2: selección de servicio | Radio buttons funcionales |
| S-18 | Paso 3-5: preguntas dinámicas según servicio | Preguntas cambian según `qualifierConfig` |
| S-19 | Paso 5: submit redirige a Calendly | `window.location.href = calendlyBookingUrl` tras 1.2s |
| S-20 | Cerrar modal con X | Modal se oculta, body scroll restaurado |
| S-21 | Cerrar modal con clic en overlay | Modal se oculta |
| S-22 | Cerrar modal con tecla ESC | Modal se oculta |

#### 3.1.4 Tests de Casos de Uso (Codex)

| ID | Escenario | Resultado esperado |
|----|-----------|--------------------|
| S-23 | 4 bento cards visibles | Governance, AWS Glue, Lakehouse Lambda, Medallion visibles |
| S-24 | Radar Chart renderiza | Canvas con tamaño > 0, datos visibles |
| S-25 | Doughnut Chart renderiza | Canvas con tamaño > 0, 3 segmentos (Bronze, Silver, Gold) |

#### 3.1.5 Tests de Responsividad (Mobile)

| ID | Escenario | Viewport | Resultado esperado |
|----|-----------|----------|--------------------|
| S-26 | Layout mobile | 375×812 (iPhone X) | Nav colapsado, grid 1 columna, textos legibles |
| S-27 | Layout tablet | 768×1024 (iPad) | Grid 2 columnas, menú horizontal |
| S-28 | Layout desktop | 1440×900 | Grid completo, bento cards 12-columnas |

---

### 3.2 Tests de APIs Serverless (`/api/`)

#### 3.2.1 `api/claude.js`

| ID | Escenario | Método | Resultado esperado |
|----|-----------|--------|--------------------|
| A-01 | POST válido con messages | POST | 200 + respuesta de Anthropic |
| A-02 | OPTIONS (CORS preflight) | OPTIONS | 200 con headers CORS |
| A-03 | Origin no autorizado | POST | 403 "Origen no autorizado" |
| A-04 | Sin API key configurada | POST | 500 "Servicio no disponible" |
| A-05 | Messages vacío | POST | 400 "messages es requerido" |
| A-06 | Messages > 20 | POST | 400 "Conversación demasiado larga" |
| A-07 | Contenido > 60K chars | POST | 400 "Contenido demasiado extenso" |
| A-08 | Rate limit chat (10/hora) x 11 requests | POST | 429 en la 11va solicitud |
| A-09 | Rate limit generación (2/día) x 3 requests con intent=generation | POST | 429 en la 3ra solicitud |

#### 3.2.2 Otras APIs

| ID | Escenario | API | Resultado esperado |
|----|-----------|-----|--------------------|
| A-10 | POST validar email válido | `/api/validate-email` | `{ deliverable: true, disposable: false }` |
| A-11 | POST validar email descartable | `/api/validate-email` | `{ deliverable: false, disposable: true }` |
| A-12 | POST crear cliente | `/api/save-client` | `{ success: true }` |
| A-13 | POST cliente duplicado en_chat | `/api/save-client` | `{ error: 'email_exists', estado: 'en_chat' }` |
| A-14 | POST cliente duplicado pagado | `/api/save-client` | Error informativo, no avanza |
| A-15 | POST guardar DSN | `/api/save-dsn` | `{ success: true, id: 'dsn-00N' }` |
| A-16 | POST notificar brief | `/api/notify` | `{ success: true }` |
| A-17 | POST subir archivo | `/api/upload-file` | `{ uploaded: [...] }` |
| A-18 | POST aprobar diseño | `/api/approve` | 200 |
| A-19 | POST rechazar diseño | `/api/reject` | 200 |

---

### 3.3 Tests Unitarios de Módulos JS (`/landing_page/`)

#### 3.3.1 `generator.js`

| ID | Escenario | Resultado esperado |
|----|-----------|--------------------|
| U-01 | `detectRubroCategory('tech startup')` → `'tech'` | Regex match correcto |
| U-02 | `detectRubroCategory('restaurante italiano')` → `'gastronomia'` | Regex match correcto |
| U-03 | `detectRubroCategory('fotografía de bodas')` → `'fotografia'` | Regex match correcto |
| U-04 | `detectRubroCategory('categoría desconocida')` → `'personal'` | Default fallback |
| U-05 | `selectTemplates('tech')` → `['moderno-oscuro', 'minimalista', 'fresco-accesible']` | 3 templates correctos |
| U-06 | `selectTemplates('unknown')` → templates de 'personal' | Fallback consistente |
| U-07 | `TEMPLATE_SPECS['moderno-oscuro']` tiene spec, name, description | Estructura completa |
| U-08 | Todos los RUBRO_TEMPLATES tienen 3 entradas cada uno | Consistencia de datos |

#### 3.3.2 `validator.js`

| ID | Escenario | Resultado esperado |
|----|-----------|--------------------|
| U-09 | Email válido: `test@example.com` | `validateEmail()` → `true` |
| U-10 | Email sin @: `test` | `validateEmail()` → `false` |
| U-11 | Email sin dominio: `test@` | `validateEmail()` → `false` |
| U-12 | Nombre < 2 caracteres: `"A"` | Error de validación |
| U-13 | Apellido < 2 caracteres: `"G"` | Error de validación |

#### 3.3.3 `chat.js`

| ID | Escenario | Resultado esperado |
|----|-----------|--------------------|
| U-14 | `state.phase` changes: GREETING → EVALUATING | Transición correcta |
| U-15 | EVALUATING → ONBOARDING (si apto) | Transición correcta |
| U-16 | EVALUATING → REJECTED (si inviable) | Transición correcta |
| U-17 | ONBOARDING → BRAND_DEFINITION | Brief completo detectado |
| U-18 | Input deshabilitado durante GENERATING | `chat-input` disabled |
| U-19 | Shift+Enter = salto de línea (no envía) | `\n` en textarea |
| U-20 | Enter = enviar mensaje | `sendMessage()` llamado |

#### 3.3.4 `carousel.js`

| ID | Escenario | Resultado esperado |
|----|-----------|--------------------|
| U-21 | `loadDsnIndex()` con `index.json` poblado | Arrays de sets con templates |
| U-22 | `loadDsnIndex()` con `index.json` vacío | `[]` |
| U-23 | Formateo de fecha `"2026-06-06"` | `"06 jun"` (locale es-AR) |

#### 3.3.5 `modal.js`

| ID | Escenario | Resultado esperado |
|----|-----------|--------------------|
| U-24 | Modal de preview se abre con HTML | Iframe con contenido renderizado |
| U-25 | Zoom con rueda del mouse (0.5x–3x) | Escala cambia |
| U-26 | Doble clic resetea zoom a 100% | `_modalScale = 1` |
| U-27 | Clic "Elegir este diseño" | Modal cierra, callback onSelect ejecutado |

---

### 3.4 Tests de Integración (Módulos JS + DOM)

| ID | Escenario | Resultado esperado |
|----|-----------|--------------------|
| I-01 | Flujo completo: Step1 → Step2 → Chat → Generación → Pago | Sin errores en consola |
| I-02 | Upload de archivos en BRAND_DEFINITION | Chip "pendiente" → "subido" |
| I-03 | Límite de 5 archivos | 6to archivo rechazado con mensaje |
| I-04 | Límite de 10 MB total | Archivo grande rechazado |
| I-05 | Carrusel con diseños previos | Widget visible + iframes renderizan |
| I-06 | Rechazo de carrusel → nueva generación | Fase pasa a BRAND_DEFINITION |
| I-07 | Recarga con sesión activa (< 48h) | Modal abre en paso 3 directo |
| I-08 | Sesión expirada (> 48h) | Modal abre en paso 1 |
| I-09 | API save-client falla (timeout) | Flujo continúa (fail-open) |
| I-10 | API claude 429 rate limit | Mensaje visible + input re-habilitado |
| I-11 | API claude error 500 | Mensaje de error + input re-habilitado |

---

### 3.5 Tests de Accesibilidad (a11y)

| ID | Escenario | Estándar | Resultado esperado |
|----|-----------|----------|--------------------|
| X-01 | Navegación por teclado (Tab) | WCAG 2.1 2.1.1 | Todos los elementos interactivos son focusables |
| X-02 | Skip to content link | WCAG 2.1 2.4.1 | Primer link navegable |
| X-03 | Contraste de color mínimo | WCAG 2.1 1.4.3 | Ratio ≥ 4.5:1 en textos |
| X-04 | Atributos alt en imágenes | WCAG 2.1 1.1.1 | Todas las imágenes tienen alt descriptivo |
| X-05 | ARIA labels en formularios | WCAG 2.1 4.1.2 | Inputs con label asociado |
| X-06 | Roles semánticos HTML5 | WCAG 2.1 1.3.1 | `<nav>`, `<main>`, `<section>`, `<footer>` correctos |
| X-07 | Lighthouse a11y score | Lighthouse | Score ≥ 90 |
| X-08 | Títulos de página descriptivos | WCAG 2.1 2.4.2 | `<title>` único y descriptivo |

---

### 3.6 Tests de Rendimiento

| ID | Escenario | Herramienta | Resultado esperado |
|----|-----------|-------------|--------------------|
| P-01 | Lighthouse Performance score | Lighthouse | Score ≥ 80 |
| P-02 | Largest Contentful Paint (LCP) | Lighthouse | < 2.5s |
| P-03 | First Input Delay (FID) | Lighthouse | < 100ms |
| P-04 | Cumulative Layout Shift (CLS) | Lighthouse | < 0.1 |
| P-05 | Tamaño de página (gzip) | DevTools Network | < 500KB |
| P-06 | Imágenes optimizadas | Lighthouse | Images properly sized |
| P-07 | Carga de Google Fonts | DevTools Network | Font-display: swap |

---

### 3.7 Tests de Brochures PDF

| ID | Escenario | Resultado esperado |
|----|-----------|--------------------|
| B-01 | `brochures/fractional-data-architect.pdf` existe | Archivo accesible vía HTTP 200 |
| B-02 | Todos los PDFs referenciados en `index.html` existen | Sin links rotos (HTTP 200) |
| B-03 | PDFs no tienen errores de parseo | pdfminer/python los abre sin error |
| B-04 | Versiones HTML de brochures existen por cada PDF | `brochures/*.html` → `brochures/*.pdf` mapeo 1:1 |

---

### 3.8 Tests de Configuración y SEO

| ID | Escenario | Resultado esperado |
|----|-----------|--------------------|
| C-01 | `sitemap.xml` válido | XML parseable, URLs correctas |
| C-02 | `robots.txt` accesible | Status 200, contenido válido |
| C-03 | `site.webmanifest` válido | JSON parseable con name, icons, start_url |
| C-04 | `CNAME` presente | Contiene `martinduarte.com` |
| C-05 | `favicon.svg` carga | Status 200, SVG valido |
| C-06 | `og-image.svg` (Open Graph) | Status 200, dimensiones 1200×630 |

---

## 4. Herramientas y Stack de Testing

| Herramienta | Versión | Uso |
|-------------|---------|-----|
| **Playwright** | latest | E2E + integración + UI tests |
| **Node.js** | 18+ | Entorno de ejecución |
| **Jest** / **Vitest** | latest | Tests unitarios JS |
| **Lighthouse CI** | latest | Performance + a11y + SEO |
| **html-validate** | latest | Validación de HTML |
| **axe-core** | latest | Accesibilidad programática |
| **pa11y** | latest | Auditoría a11y CLI |
| **pdfminer.six** (Python) | latest | Validación de PDFs |
| **GitHub Actions** | — | CI/CD pipeline |

---

## 5. Pipeline de CI Propuesto (GitHub Actions)

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx vitest run          # Tests unitarios JS

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - uses: actions/setup-python@v5
      - run: pip install playwright pytest
      - run: npx playwright install chromium
      - run: |
          node mock-server.js &
          MOCK_PID=$!
          sleep 2
          python tests/e2e_test_suite.py
          kill $MOCK_PID

  api-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx vitest run --config vitest.api.config.js

  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx lhci autorun

  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx pa11y-ci --sitemap https://martinduarte.com/sitemap.xml

  check-broken-links:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx linkinator https://martinduarte.com --recurse
```

---

## 6. Priorización

| Prioridad | Área | Justificación |
|-----------|------|---------------|
| 🔴 **Alta** | Sitio principal — navegación, modal booking, responsive | Experiencia del usuario final |
| 🔴 **Alta** | APIs serverless — rate limiting, CORS, validaciones | Seguridad y estabilidad |
| 🟡 **Media** | Módulos JS unitarios — generator.js, validator.js, chat.js | Regresión en lógica de negocio |
| 🟡 **Media** | Integración — flujo completo landing page service | Core del servicio |
| 🟢 **Baja** | Accesibilidad | Mejora continua |
| 🟢 **Baja** | Rendimiento / Lighthouse | Optimización |
| 🟢 **Baja** | Brochures PDF / SEO | Mantenimiento |

---

## 7. Plan de Ejecución (Sprints)

### Sprint 1 — Fundación (semana 1)
- [ ] Configurar Jest/Vitest para tests unitarios
- [ ] Escribir tests unitarios para `generator.js` (U-01 a U-08)
- [ ] Escribir tests unitarios para `validator.js` (U-09 a U-13)

### Sprint 2 — APIs (semana 2)
- [ ] Escribir tests de integración para `api/claude.js` (A-01 a A-09)
- [ ] Escribir tests de integración para resto de APIs (A-10 a A-19)
- [ ] Configurar mock de Anthropic API para tests

### Sprint 3 — Sitio principal (semana 3)
- [ ] Escribir tests visuales/HTML (S-01 a S-07)
- [ ] Escribir tests de navegación (S-08 a S-13)
- [ ] Escribir tests de modal booking (S-14 a S-22)
- [ ] Escribir tests de responsive (S-26 a S-28)

### Sprint 4 — Integración y CI (semana 4)
- [ ] Escribir tests de integración módulos + DOM (I-01 a I-11)
- [ ] Configurar GitHub Actions pipeline
- [ ] Agregar Lighthouse CI
- [ ] Agregar pa11y / axe-core
- [ ] Agregar verificación de links rotos

### Sprint 5 — Rendimiento y accesibilidad (semana 5)
- [ ] Auditoría Lighthouse completa
- [ ] Optimización de rendimiento según resultados
- [ ] Auditoría de accesibilidad con axe-core
- [ ] Corrección de issues de accesibilidad

---

## 8. Métricas de Éxito

| Métrica | Target actual | Target deseado |
|---------|---------------|----------------|
| Cobertura de tests unitarios | 0% | ≥ 60% |
| Cobertura de APIs | 0% | ≥ 90% |
| Lighthouse Performance | ? | ≥ 85 |
| Lighthouse Accessibility | ? | ≥ 90 |
| Lighthouse Best Practices | ? | ≥ 90 |
| Lighthouse SEO | ? | ≥ 95 |
| Links rotos | 0 | 0 |
| Errores de consola en E2E | 0 | 0 |

---

## 9. Estructura de Archivos Propuesta

```
tests/
├── e2e_test_suite.py              # Existente: tests E2E Playwright
├── diagnostic.py                   # Existente: script de diagnóstico
├── screenshots/                    # Existente: screenshots de tests
├── unit/                           # NUEVO: tests unitarios JS
│   ├── generator.test.js
│   ├── validator.test.js
│   ├── chat.test.js
│   ├── carousel.test.js
│   └── modal.test.js
├── api/                            # NUEVO: tests de APIs
│   ├── claude.test.js
│   ├── validate-email.test.js
│   ├── save-client.test.js
│   └── save-dsn.test.js
├── integration/                    # NUEVO: tests de integración
│   ├── landing-page-flow.test.js
│   ├── carousel-flow.test.js
│   └── session-restore.test.js
└── a11y/                           # NUEVO: auditoría de accesibilidad
    ├── index.test.js
    └── landing-page.test.js
```

---

## 10. Resumen de Tests por Área

| Área | Tests Planificados | Prioridad |
|------|-------------------|-----------|
| Sitio principal (index.html) | 28 tests (S-01 a S-28) | 🔴 Alta |
| APIs serverless | 19 tests (A-01 a A-19) | 🔴 Alta |
| Módulos JS unitarios | 27 tests (U-01 a U-27) | 🟡 Media |
| Integración | 11 tests (I-01 a I-11) | 🟡 Media |
| Accesibilidad | 8 tests (X-01 a X-08) | 🟢 Baja |
| Rendimiento | 7 tests (P-01 a P-07) | 🟢 Baja |
| Brochures PDF | 4 tests (B-01 a B-04) | 🟢 Baja |
| Configuración/SEO | 6 tests (C-01 a C-06) | 🟢 Baja |
| **TOTAL** | **110 tests** | |