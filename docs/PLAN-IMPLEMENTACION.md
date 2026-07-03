# Plan de implementación — Rediseño de martinduarte.com

> Documento ejecutable por **Claude Code**. Consolida y traduce a tareas concretas todo
> lo definido en:
> [AUDITORIA-SEO-GEO.md](AUDITORIA-SEO-GEO.md) · [PROPUESTA-PAGINAS-SERVICIO.md](PROPUESTA-PAGINAS-SERVICIO.md) · [FAQ-SERVICIOS.md](FAQ-SERVICIOS.md)
> y el mock de referencia [`mocks/servicio-inteligencia-artificial.html`](../mocks/servicio-inteligencia-artificial.html).
>
> **Objetivo:** reordenar la navegación, separar la oferta en 5 pilares con página
> propia, mejorar SEO/GEO/rendimiento/accesibilidad y sumar analítica — **sin alterar la
> estética** (fuentes, paleta y tarjetas actuales se conservan).
> Fecha: 2026-07-02.

---

## 0. Cómo usar este plan

- Ejecutar **por fases (A→G) y por tareas (T#) en orden**; cada tarea declara archivos,
  pasos, criterio de aceptación (DoD) y mensaje de commit sugerido.
- **Un commit por tarea**, mensaje en español (imperativo + por qué + qué se verificó),
  y `git push` inmediato (regla de `CLAUDE.md`).
- Antes de commitear cualquier tarea que toque JS/`api/`: correr `npm test` (debe quedar
  verde). Las tareas de este plan tocan el **sitio de marketing** (`index.html`, nuevas
  páginas estáticas, `assets/`), **no** `api/` ni `landing_page/`, así que la suite no
  debería verse afectada; correrla igual como red de seguridad.
- No romper estas **restricciones de marca** (`.codex/rules.md`):
  - AdSense `ca-pub-1594572872514423` permanece en el `<head>` de todas las páginas.
  - `Master en Inteligencia Artificial (UdeSA)` va **primero** en cualquier listado de credenciales.
  - Todo CTA "Agendar reunión" abre el **calificador de 5 pasos** y al completarlo redirige a
    `https://calendly.com/martynduarte/sample-30min`.
  - Paleta `#0F172A` / `#2563EB` / `#F8FAFC`; titulares `Space Grotesk`, cuerpo `Plus Jakarta Sans`.

---

## 1. Decisiones técnicas (resolver antes de codear)

1. **Sin framework, con partials por JS.** El sitio es HTML/CSS/JS vanilla servido por
   Vercel. Para no duplicar `nav`/`footer`/WhatsApp/modal en 6 páginas, se centraliza en
   **`assets/js/site.js`** (inyecta nav + footer + botón WhatsApp) y **`assets/js/booking.js`**
   (modal calificador + `openBooking`). Una sola fuente de verdad.
2. **URLs de pilar = carpetas estáticas** (mismo patrón que `clientes/<slug>/index.html`):
   `servicios/<slug>/index.html` → se sirve en `/servicios/<slug>/`.
3. **Tailwind: pasar de CDN a compilado** (Fase D). Config con `content` que escanea los
   HTML; salida commiteada en `assets/css/tailwind.css`. Se elimina `cdn.tailwindcss.com`.
4. **Número de WhatsApp:** parámetro real requerido (el mock usa placeholder
   `5490000000000`). Definirlo en `site.js` como constante `WHATSAPP_NUMBER`.
5. **IDs de analítica:** GA4 `G-XXXXXXXXXX` y Clarity `CLARITY_PROJECT_ID` ya están en
   `index.html` con guarda; reemplazar por los reales y replicar en cada página nueva
   (mejor: cargarlos desde `site.js` para no repetir).

> Si Martín prefiere **no** introducir el paso de build de Tailwind ahora, la Fase D se
> puede posponer; todo lo demás es independiente.

---

## 2. Estructura de archivos objetivo

```
/
├── index.html                              (home refactorizada — Fase B)
├── servicios/
│   ├── arquitectura-de-datos/index.html    (Fase C)
│   ├── inteligencia-artificial/index.html  (Fase C — usar el mock como base)
│   ├── automatizaciones/index.html         (Fase C)
│   ├── tienda-nube/index.html              (Fase C)
│   └── desarrollo-web/index.html           (Fase C)
├── assets/
│   ├── css/
│   │   ├── input.css                        (directivas Tailwind + @layer custom — Fase D)
│   │   └── tailwind.css                      (compilado, commiteado — Fase D)
│   ├── js/
│   │   ├── site.js                           (nav + footer + WhatsApp + analítica — Fase A)
│   │   └── booking.js                        (modal calificador 5 pasos — Fase A)
│   └── img/
│       └── og-image.png                      (1200×630 — Fase E)
├── sitemap.xml                              (6 URLs — Fase E)
└── (tailwind.config.js, package.json scripts — Fase D)
```

---

## 3. Contenido fuente (de dónde sale cada texto)

- **Copys, alcance y público de cada pilar/servicio:** `PROPUESTA-PAGINAS-SERVICIO.md`
  (§0.1 matriz de público, §2–§7).
- **FAQ (80 preguntas, 16 servicios):** `FAQ-SERVICIOS.md`.
- **Menú, orden de home (embudo), sitemap, decisiones de navegación:** `AUDITORIA-SEO-GEO.md`
  §4A + §10 de la propuesta (ajustes de diseño).
- **Maquetación/HTML de referencia:** el mock de IA (nav, breadcrumb, título de pilar,
  tarjetas de servicio con FAQ interna, casos por pilar, WhatsApp, un solo cierre).

---

## FASE A — Fundaciones compartidas

### T1 · Crear `assets/js/site.js` (nav + footer + WhatsApp + analítica)
**Archivos:** `assets/js/site.js` (nuevo).
**Pasos:**
1. Definir constantes al inicio: `WHATSAPP_NUMBER`, `GA4_ID`, `CLARITY_ID`, y un array
   `PILARES` con `{nombre, slug, icono}` de los 5 pilares.
2. Exportar funciones que **inyectan** en cada página: `renderNav(activeSlug)`,
   `renderFooter()`, `renderWhatsApp()`. La nav incluye el logo con `←`/enlace a `/`, el
   dropdown de 5 pilares (marca activo el `activeSlug`), "Sobre mí", "Contacto" y el CTA
   "Agendar reunión" (llama `openBooking()`).
3. Mover acá los snippets de **GA4** y **Clarity** (con guarda de placeholder) para que
   se carguen una sola vez desde `site.js` en vez de repetir en cada `<head>`.
4. Cada página incluye contenedores `<div id="site-nav"></div>` … y al final
   `<script src="/assets/js/site.js" defer></script>` que puebla esos contenedores.

**Snippet de referencia (WhatsApp flotante):**
```html
<a href="https://wa.me/WHATSAPP_NUMBER?text=Hola%20Mart%C3%ADn"
   target="_blank" rel="noopener noreferrer" aria-label="Escribir por WhatsApp"
   style="position:fixed;right:22px;top:50%;transform:translateY(-50%);z-index:60;
          width:56px;height:56px;border-radius:50%;background:#25D366;display:flex;
          align-items:center;justify-content:center;box-shadow:0 12px 30px -6px rgba(37,211,102,.6)">
   <!-- SVG del logo WhatsApp (tomar del mock) -->
</a>
```
**DoD:** en una página de prueba, la nav, el footer y el WhatsApp aparecen inyectados y
el WhatsApp acompaña el scroll (`position:fixed`). `aria-label` presente.
**Commit:** `Agregar site.js con nav, footer y WhatsApp compartidos`

### T2 · Extraer el modal calificador a `assets/js/booking.js`
**Archivos:** `assets/js/booking.js` (nuevo); origen: `index.html` líneas del
`#bookingModal` (~979) y el bloque `<script>` con `qualifierConfig`, `openBooking()`,
`submitBooking()`, `calendlyBookingUrl` (~1104–1230).
**Pasos:**
1. Mover el markup del modal a una función `renderBookingModal()` que se inyecta en
   `<div id="site-booking"></div>`.
2. Mover la lógica JS (`qualifierConfig`, navegación de pasos, `openBooking`,
   `submitBooking`, redirección a Calendly) a `booking.js`.
3. Conservar **intacto** el flujo de 5 pasos y la redirección a
   `https://calendly.com/martynduarte/sample-30min` (restricción de marca).
4. En `index.html`, reemplazar el modal/JS inline por el contenedor + `<script src="/assets/js/booking.js" defer>`.
**DoD:** el botón "Agendar reunión" abre el modal, completa los 5 pasos y redirige a
Calendly, igual que hoy, en la home y en cualquier página que incluya `booking.js`.
**Commit:** `Extraer modal calificador de 5 pasos a booking.js reutilizable`

### T3 · Helpers de datos estructurados por página
**Archivos:** `assets/js/site.js` (agregar) o `assets/js/schema.js`.
**Pasos:** función `injectSchema({tipo, nombre, descripcion, breadcrumb[], faqs[]})` que
genera e inserta un `<script type="application/ld+json">` con `Service` +
`BreadcrumbList` + `FAQPage` (ver Fase E para el detalle del contenido).
**DoD:** cada página de pilar puede declarar su schema con una sola llamada.
**Commit:** `Agregar helper de JSON-LD (Service, BreadcrumbList, FAQPage) por página`

---

## FASE B — Refactor de la home (`index.html`)

> Se conserva la estética; cambian **orden, menú, y qué se muestra**. Referencia de orden:
> AUDITORIA §4A.3 (embudo).

### T4 · Nuevo menú (5 pilares, sin "Casos", logo vuelve a home)
**Archivos:** `index.html` nav (~línea 374) → reemplazar por `<div id="site-nav">` +
`site.js`.
**Cambios:** menú = **Servicios ▾ (5 pilares) · Sobre mí · Contacto · [Agendar reunión]**.
Quitar "Casos de Uso" del menú y los estados "Próximamente" (Desarrollo y Automatizaciones
pasan a activos). Logo con `←` enlazando a `/`.
**DoD:** el dropdown lista los 5 pilares enlazando a `/servicios/<slug>/`; no hay "Casos"
ni "Próximamente".
**Commit:** `Reemplazar menú por 5 pilares y quitar Casos/Próximamente del nav`

### T5 · Reordenar la home al embudo
**Archivos:** `index.html` (`<main>` ~438).
**Orden objetivo:** 1) Hero · 2) Barra de confianza (3–4 métricas/rubros) · 3) **Servicios:
5 tarjetas-resumen** (una por pilar, con "Ver más" → su página) · 4) Casos destacados
(2–3 que enlazan al pilar) · 5) Sobre mí (bio + credenciales, **Master IA UdeSA primero**)
· 6) FAQ breve · 7) Contacto (sección propia, fuera del footer) · 8) Footer.
**Cambios concretos:**
- Reemplazar el bloque `#servicios` actual (11 ítems, ~582–817) por **5 tarjetas-resumen**.
- Mover el contenido de `#ecommerce` (TiendaNube) fuera del scroll: en la home solo queda
  la tarjeta "Tienda Nube"; el detalle va a su página (Fase C).
- Convertir `#academia` (~919) en "Sobre mí" y reubicarlo en el paso 5.
- Sacar el contacto del `<footer id="contacto">` (~962): crear `<section id="contacto">`
  y dejar el `<footer>` como navegación secundaria/legal.
- El fix del hero (markdown roto) ya está hecho; verificar que no reaparezca.
**DoD:** la home sigue el orden del embudo; TiendaNube ya no ocupa el scroll principal; el
contacto es sección propia; el footer es secundario.
**Commit:** `Reordenar home al embudo y consolidar servicios en 5 tarjetas`

### T6 · Mover los 4 casos actuales al pilar Arquitectura de Datos
**Archivos:** `index.html` `#codex` (~485) → cortar; destino: la página de Arquitectura
(Fase C, T9).
**Cambios:** los 4 casos (Oil & Gas, serverless AWS, lakehouse logístico, medallion
financiero) se trasladan a `/servicios/arquitectura-de-datos/`. En la home quedan a lo
sumo 2–3 destacados que **enlazan** al pilar correspondiente.
**DoD:** los casos completos ya no viven en la home; están dentro del pilar de datos.
**Commit:** `Mover casos de uso a la página del pilar Arquitectura de Datos`

---

## FASE C — Plantilla de pilar + las 5 páginas

### T7 · Plantilla base de página de pilar
**Archivos:** `servicios/_plantilla.html` (referencia) basada en el **mock de IA**.
**Estructura (orden):**
1. `<head>` con meta + AdSense + `og:*` + canonical propio + `<script>` schema (T3).
2. Contenedores compartidos: `#site-nav`, `#site-booking`, WhatsApp (via `site.js`).
3. **Breadcrumb** `Inicio › Servicios › {Pilar}` + enlace "Volver al inicio".
4. **Hero del pilar** (título promesa + subcopy + 1 anclaje "Ver los servicios ↓").
5. **Título del pilar** (nombre grande, p. ej. "Inteligencia Artificial") **encabezando
   el bloque de servicios** (PROPUESTA §10.7).
6. **Tarjetas de servicio**: cada servicio en su tarjeta, con la **FAQ desplegable dentro
   de la tarjeta** (patrón `<details>` anidado del mock, ocupa el ancho del cuadro).
7. **Casos propios del pilar** (solo los de ese pilar).
8. **Un único cierre de contacto** (bloque oscuro con el/los CTA de decisión).
**Patrón FAQ-en-tarjeta (del mock):**
```html
<details>  <!-- toggle de la FAQ del servicio, ocupa la tarjeta -->
  <summary>Preguntas frecuentes</summary>
  <div>
    <details><summary>¿Pregunta 1?</summary><p>Respuesta…</p></details>
    <!-- … 5 en total (tomar de FAQ-SERVICIOS.md) -->
  </div>
</details>
```
**DoD:** la plantilla renderiza con nav/footer/WhatsApp/modal inyectados y sin estilos
propios fuera del sistema de marca.
**Commit:** `Crear plantilla base de página de pilar`

### T8 · Página **Inteligencia Artificial** (`servicios/inteligencia-artificial/index.html`)
**Base:** copiar el mock, limpiar comentarios de "mock" y cablear a `site.js`/`booking.js`.
**Contenido:** 2 servicios — **Mentoría** (pymes/emprendedores/profesionales) y
**Formación + acompañamiento** (público general) — cada uno con su FAQ de 5 (FAQ §2).
Casos propios de IA. Título "Inteligencia Artificial" arriba de los servicios.
**DoD:** página navegable; FAQ interna funciona; schema `Service`+`FAQPage`+`BreadcrumbList`
válido (probar en validator.schema.org).
**Commit:** `Publicar página del pilar Inteligencia Artificial`

### T9 · Página **Arquitectura de Datos**
**Servicios (tarjetas) + su FAQ (FAQ §1):** Diagnóstico y estrategia (incl. **AI Readiness**),
Implementación y modernización, Gobierno y calidad, Reporting y decisión, **Fractional
Data/AI Leadership**. **Incluir los 4 casos** movidos en T6. Público: empresas + pymes.
**Commit:** `Publicar página del pilar Arquitectura de Datos con sus casos`

### T10 · Página **Automatizaciones**
**Servicios + FAQ (FAQ §3):** **AI Readiness** (puerta de entrada), Agentes de IA,
Automatización de procesos e integraciones. Público: empresas, pymes, emprendedores y
profesionales. Caso demostrable: el propio generador de landing pages.
**Commit:** `Publicar página del pilar Automatizaciones`

### T11 · Página **Tienda Nube**
**Servicios + FAQ (FAQ §4):** planes Básico / Intermedio / Premium **con precios
visibles** (única excepción a "sin precios") + módulos opcionales. Migrar acá el contenido
de `#ecommerce`. Público: pymes, emprendedores, público general.
**Commit:** `Publicar página del pilar Tienda Nube con precios visibles`

### T12 · Página **Desarrollo Web**
**Servicios + FAQ (FAQ §5):** Landing pages (destacar el generador con IA del repo),
Plataformas a medida, Integraciones. Público: pymes, emprendedores, profesionales, público
general.
**Commit:** `Publicar página del pilar Desarrollo Web`

### T13 · Enlazar tarjetas de la home a las 5 páginas
**Archivos:** `index.html`. Cada tarjeta-resumen (T5) enlaza a `/servicios/<slug>/`.
**DoD:** navegación home→pilar→home funcionando (logo y "Volver al inicio").
**Commit:** `Enlazar tarjetas de la home con las páginas de pilar`

---

## FASE D — Rendimiento (Core Web Vitals)

### T14 · Compilar Tailwind (quitar el CDN de producción)
**Archivos:** `tailwind.config.js`, `assets/css/input.css`, `assets/css/tailwind.css`,
`package.json` (script), todas las páginas HTML.
**Pasos:**
1. `npm i -D tailwindcss` y `npx tailwindcss init`.
2. `tailwind.config.js` → `content: ['./index.html','./servicios/**/*.html','./assets/js/*.js']`
   (incluir `js` porque `site.js` genera markup con clases).
3. `input.css`: `@tailwind base; @tailwind components; @tailwind utilities;` + el `:root`
   con las variables de marca y las clases custom (`bento-card`, `sub-card`, etc.).
4. Script: `"build:css": "tailwindcss -i assets/css/input.css -o assets/css/tailwind.css --minify"`.
5. En cada HTML: quitar `<script src="https://cdn.tailwindcss.com">` y el `@import` de
   fuentes; agregar `<link rel="stylesheet" href="/assets/css/tailwind.css">` y las fuentes
   con `<link rel="preconnect">` + `<link rel="stylesheet" ...&display=swap>`.
6. Commitear `tailwind.css` compilado (no hay build en Vercel por defecto para estáticos).
**DoD:** ninguna página carga `cdn.tailwindcss.com`; el look es idéntico; PageSpeed mejora
LCP/CLS. Revisar visualmente cada página.
**Commit:** `Reemplazar Tailwind CDN por CSS compilado y minificado`

### T15 · Diferir scripts no críticos y optimizar fuentes
**Archivos:** todas las páginas.
**Cambios:** `chart.js` con `defer` (o cargar solo donde se usa); fuentes vía `preconnect`
(ya no `@import`); imágenes con `loading="lazy"` salvo el hero (`eager`).
**Commit:** `Diferir chart.js y optimizar carga de fuentes e imágenes`

---

## FASE E — SEO / GEO

### T16 · Schema por página (Service + FAQPage + BreadcrumbList)
**Archivos:** cada `servicios/<slug>/index.html` (usar helper T3).
**Contenido:** `Service` (name, description, provider→Person, areaServed, audience según
matriz §0.1), `FAQPage` con las 5×N preguntas visibles de esa página, `BreadcrumbList`.
**DoD:** válido en validator.schema.org; las preguntas del schema coinciden con las visibles.
**Commit:** `Agregar JSON-LD Service, FAQPage y BreadcrumbList a cada pilar`

### T17 · Sitemap, canonical y og-image
**Archivos:** `sitemap.xml`, `assets/img/og-image.png`, `<head>` de cada página.
**Cambios:** `sitemap.xml` con las 6 URLs (home + 5 pilares) y `lastmod`; `canonical`
propio por página; generar `og-image.png` 1200×630 y referenciarlo en `og:image` (hoy la
home apunta a `martin-profile.jpg` — reemplazar por la imagen dedicada).
**DoD:** sitemap válido; cada página tiene canonical y OG correctos.
**Commit:** `Actualizar sitemap, canonical y og-image dedicada`

### T18 · Alta en Google Search Console (manual, checklist)
Verificar dominio, enviar `sitemap.xml`, revisar cobertura. (Acción de Martín; dejar
instrucciones en el commit/README.)

---

## FASE F — Analítica y mapas de calor

### T19 · GA4 + Clarity con IDs reales
**Archivos:** `assets/js/site.js`. Reemplazar `G-XXXXXXXXXX` y `CLARITY_PROJECT_ID` por los
reales; cargar desde `site.js` para todas las páginas.
**Commit:** `Activar GA4 y Microsoft Clarity con IDs reales`

### T20 · Eventos personalizados
**Archivos:** `site.js`, `booking.js`, páginas.
**Eventos:** `click_agendar` (todos los CTA), `open_whatsapp`, `download_brochure`
(con nombre), `click_plan_ecommerce`, `submit_calificador` (al completar los 5 pasos).
**Snippet:**
```js
document.addEventListener('click', (e) => {
  const cta = e.target.closest('[data-ev]');
  if (cta && window.gtag) gtag('event', cta.dataset.ev, { label: cta.dataset.evLabel || '' });
});
```
Marcar los CTA con `data-ev="click_agendar"` etc.
**DoD:** los eventos aparecen en GA4 DebugView y en los mapas de Clarity.
**Commit:** `Instrumentar eventos GA4 en CTAs, WhatsApp y calificador`

---

## FASE G — Accesibilidad (WCAG 2.1 AA)

### T21 · Semántica y ARIA
**Cambios:** `<header>` envolviendo la nav; `aria-hidden="true"` en emojis/íconos
decorativos; `aria-label` en botones sin texto y en el WhatsApp; modal con `role="dialog"`,
`aria-modal="true"`, **focus trap**, cierre con `Esc` y retorno de foco al disparador;
enlace "Saltar al contenido".
**Commit:** `Mejorar accesibilidad: landmarks, ARIA y foco del modal`

### T22 · Contraste y tipografía mínima
**Cambios:** subir textos `text-[10px]` a ≥12px; oscurecer grises secundarios que no
cumplan 4.5:1. Revisar con un checker de contraste.
**Commit:** `Corregir contraste y tamaño mínimo de tipografía`

---

## 4. Checklist de aceptación global (QA final)

- [ ] Menú de 5 pilares; sin "Casos" ni "Próximamente"; logo vuelve a la home.
- [ ] Home en orden de embudo; TiendaNube fuera del scroll principal; contacto como sección.
- [ ] Las 5 páginas de pilar existen en `/servicios/<slug>/` y son navegables ida y vuelta.
- [ ] Cada servicio muestra su **FAQ dentro de la tarjeta** (desplegable); 5 preguntas c/u.
- [ ] Casos **solo dentro de cada pilar**; los 4 actuales en Arquitectura de Datos.
- [ ] Sin la palabra "subservicio" en la interfaz; servicios mostrados solo por su nombre.
- [ ] Título del pilar arriba de los servicios; breadcrumb + "Volver al inicio".
- [ ] WhatsApp flotante en todas las páginas; CTAs de contacto reducidos (nav + WhatsApp + 1 cierre).
- [ ] Sin `cdn.tailwindcss.com`; CSS compilado; PageSpeed mejora LCP/CLS.
- [ ] JSON-LD `Service`+`FAQPage`+`BreadcrumbList` válido en cada pilar; `Person`+`ProfessionalService`+`WebSite` en home.
- [ ] Sitemap con 6 URLs; canonical y og-image por página; AdSense en todos los `<head>`.
- [ ] GA4 + Clarity activos; eventos disparando; Master IA UdeSA figura primero.
- [ ] Accesibilidad: landmarks, ARIA, foco del modal, contraste y tipografía ≥12px.
- [ ] `npm test` verde; `npx playwright test` verde si se tocó el flujo del wizard (no debería).

---

## 5. Orden sugerido y dependencias

```
A (T1,T2,T3)  →  B (T4,T5,T6)  →  C (T7…T13)  →  E (T16,T17)  →  F (T19,T20)
                                     │
                          D (T14,T15) puede ir en paralelo tras A
                          G (T21,T22) al final, sobre todo lo anterior
```
Fundaciones primero (A), porque B y C dependen de los partials/modal/schema compartidos.

## 6. Riesgos y rollback

- **Regresión del calificador de 5 pasos** al extraerlo (T2): verificar el flujo completo
  y la redirección a Calendly antes de commitear. Rollback = revertir el commit de T2.
- **Tailwind compilado con clases faltantes** (T14): si algo pierde estilo, es por el
  `content` glob; agregar la ruta y recompilar. Mantener el CDN en una rama hasta validar.
- **Duplicación de nav/footer** si alguna página no usa `site.js`: todas deben incluir los
  contenedores + el script.
- **Cookie/identidad del wizard:** este plan no toca `api/` ni `landing_page/`; no alterar
  `_lib/session.js` ni el flujo de sesión.
