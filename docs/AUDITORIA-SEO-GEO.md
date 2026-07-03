# Auditoría SEO + GEO y Plan de Acción — martinduarte.com

> Auditoría técnica realizada sobre `index.html` (single-page, 1.162 líneas) y los
> archivos de soporte (`robots.txt`, `sitemap.xml`, `site.webmanifest`).
> Fecha: 2026-07-02. Roles asumidos: SEO técnico + GEO (Generative Engine
> Optimization) + revisión de usabilidad, accesibilidad e interoperabilidad.
>
> **Premisa del pedido:** mejorar posicionamiento, citabilidad por IA, usabilidad y
> accesibilidad **sin alterar la estética**, y reorganizar los servicios para que
> cada uno se lea como una página orgánica y no como una acumulación de ítems.

---

## 1. Resumen ejecutivo (TL;DR)

La página tiene una **base visual y de contenido fuerte** (casos de éxito con
métricas concretas, propuesta de valor clara, diseño cuidado), pero está
**técnicamente ciega para buscadores y motores generativos** y arrastra un
**problema de rendimiento grave**. Los tres agujeros más caros:

1. **No hay capa SEO en el `<head>`**: falta `meta description`, `canonical`,
   Open Graph, Twitter Cards y **todo el structured data (JSON-LD)**. Google y los
   LLMs no tienen de dónde extraer una descripción ni entidades → la página casi no
   puede ser citada ni compartida correctamente.
2. **Tailwind se sirve desde el CDN de desarrollo (`cdn.tailwindcss.com`)** en
   producción. Es render-blocking, pesa cientos de KB y genera el CSS en el browser
   en tiempo de ejecución. Penaliza Core Web Vitals (LCP/CLS), sobre todo en mobile.
3. **No hay analítica ni mapas de calor.** No hay GA4, ni GTM, ni Clarity/Hotjar:
   hoy es imposible saber dónde hace clic la gente ni medir conversiones.

El resto son mejoras de accesibilidad, arquitectura de información (los servicios
están amontonados) y de contenido (secciones faltantes como FAQ, blog real y bio).

**Prioridad de impacto/esfuerzo:**

| # | Acción | Impacto | Esfuerzo | Riesgo |
|---|--------|---------|----------|--------|
| 1 | Capa SEO en `<head>` (description, canonical, OG, Twitter) | 🔴 Alto | Bajo | Bajo |
| 2 | Structured data JSON-LD (Person, ProfessionalService, WebSite, FAQ) | 🔴 Alto | Bajo | Bajo |
| 3 | GA4 + Microsoft Clarity (heatmap/clicks) | 🔴 Alto | Bajo | Bajo |
| 4 | Reemplazar Tailwind CDN por CSS compilado | 🔴 Alto | Medio | Medio |
| 5 | Reordenar estructura y navegación (menú plano + embudo) | 🟠 Medio-Alto | Bajo-Medio | Bajo |
| 6 | Reorganizar servicios en 4 pilares con página propia | 🟠 Medio-Alto | Medio-Alto | Medio |
| 7 | Sección FAQ visible + bio/E-E-A-T + blog real | 🟠 Medio-Alto | Medio | Bajo |
| 8 | Accesibilidad (aria, contraste, foco del modal, landmarks) | 🟠 Medio | Medio | Bajo |
| 9 | Sitemap real + Search Console | 🟡 Medio | Bajo | Bajo |

Los ítems **1, 2, 3** (más un par de correcciones de contenido) se implementan como
_quick wins_ inmediatos — ver §7 y el changelog al final.

---

## 2. Auditoría SEO técnica

### 2.1 Lo que está bien ✅

- `lang="es"`, `charset UTF-8` y `viewport` correctos.
- `<title>` descriptivo y con marca (56 caracteres, dentro del rango ideal):
  _"Martín Duarte | Senior Data Architect & AI Strategist"_.
- Un único `<h1>` — jerarquía de encabezados correcta en ese punto.
- `robots.txt` permite el rastreo y referencia el sitemap.
- La imagen de perfil tiene `alt` descriptivo.
- HTTPS y dominio propio (`CNAME` → martinduarte.com).

### 2.2 Lo que está mal ❌

- **Sin `meta description`.** Google inventa el snippet (peor CTR) y los LLMs no
  tienen resumen canónico de la página.
- **Sin `<link rel="canonical">`.** Riesgo de contenido duplicado (p. ej. versión
  con y sin `www`, o con parámetros).
- **Sin Open Graph ni Twitter Cards.** Al compartir el link en LinkedIn/WhatsApp/X
  no aparece título, descripción ni imagen → se ve como un link "pelado". Existe
  `og-image.svg` en el repo pero **no está referenciado** (y además SVG no es un
  formato que los scrapers sociales rendericen: hace falta un PNG/JPG de 1200×630).
- **Sin `meta name="author"` ni `theme-color`** en el `<head>`.
- **`sitemap.xml` mínimo:** una sola URL, sin `lastmod`. No refleja secciones ni
  futuras páginas de servicio.
- **Texto roto por Markdown sin renderizar** en el hero: se lee literalmente
  `los **Agentes de IA** transforman…` (los asteriscos aparecen como texto). Es un
  bug de contenido visible.
- **Enlace muerto:** "Blog Técnico" apunta a `#`. Un link a `#` en el footer es una
  señal de sitio incompleto (y una oportunidad SEO desperdiciada — ver §5).
- **`target="_blank"` sin `rel="noopener"`** en el link de LinkedIn del footer
  (riesgo de _tabnabbing_ y micro-penalización de performance).

### 2.3 Rendimiento (Core Web Vitals) ⚠️

Google usa Core Web Vitals como señal de ranking. Los frenos actuales:

- **Tailwind Play CDN en producción** (`https://cdn.tailwindcss.com`). La propia
  documentación de Tailwind dice explícitamente que **no es para producción**:
  descarga el motor completo y compila el CSS en el navegador en cada carga →
  bloquea el render, dispara el LCP y provoca _flash of unstyled content_. Es, por
  lejos, el mayor problema de performance. **Solución:** compilar Tailwind a un
  `.css` estático (Tailwind CLI o PostCSS) y servir solo las clases usadas
  (`~10–30 KB` en vez de cientos). Como no hay build step hoy, alcanza con generar
  el CSS una vez y commitearlo, o agregar un paso mínimo de build en Vercel.
- **`chart.js` cargado sin `async`/`defer`** y de forma global aunque solo se use en
  un gráfico bajo el fold → render-blocking innecesario. Cargar con `defer` o
  diferir hasta que la sección sea visible.
- **Google Fonts vía `@import` dentro de `<style>`** — la peor forma de cargarlas
  (bloqueante, sin `preconnect`). Cambiar a `<link rel="preconnect">` +
  `<link rel="stylesheet">` con `display=swap` (ya está el `swap`, falta el
  preconnect y sacarlo del `@import`).
- Sin `preconnect`/`dns-prefetch` para orígenes de terceros (fonts, adsense, GA).

### 2.4 Indexabilidad y arquitectura de URLs ⚠️

Todo el sitio es **una sola URL**. Cada servicio, cada caso y el "blog" viven en
anclas (`#servicios`, `#ecommerce`, `#academia`). Consecuencia SEO directa: la
página **no puede rankear individualmente** para búsquedas específicas como
_"arquitecto de datos freelance"_, _"implementación Tienda Nube"_, _"consultor IA
para empresas"_ o _"FinOps AWS"_, porque no hay una URL dedicada, con su propio
`title`/`description`/H1, para cada intención de búsqueda. Esto se resuelve con la
arquitectura de servicios de §4.

---

## 3. Auditoría GEO (Generative Engine Optimization)

GEO es optimizar para que ChatGPT, Gemini, Perplexity y Copilot **citen y
recomienden** la página en sus respuestas. La métrica es el _reference rate_ / _Share
of Model_: con qué frecuencia te menciona la IA frente a competidores.

### 3.1 Diagnóstico

- **Sin structured data (JSON-LD): 0 bytes.** Es el hallazgo GEO más importante. El
  marcado estructurado mejora la _discoverability_ por LLMs de forma marcada, y la
  claridad de entidad + datos estructurados es lo que más aumenta la aparición de
  marcas chicas en respuestas de IA. Faltan, como mínimo: `Person` (Martín como
  entidad, con credenciales), `ProfessionalService` (el negocio y su catálogo),
  `WebSite`, y `FAQPage` cuando exista la FAQ.
- **Sin sección FAQ.** Las FAQ que replican preguntas reales de usuarios ("¿qué es
  un arquitecto de datos fraccional?", "¿cuánto cuesta migrar a un lakehouse?") son
  de los formatos que los motores generativos más citan, porque son extraíbles
  pregunta-respuesta de forma directa.
- **Señales E-E-A-T débiles para máquinas.** Los casos de éxito son excelentes y
  **densos en evidencia** (−80% tiempo de gestión, 2.5M eventos/mes, US$500–900/mes
  de TCO, 50+ pipelines) — justo lo que las IAs prefieren citar. Pero están
  **anonimizados** ("Sector Energético", "Sector Financiero") y **no marcados como
  datos estructurados**, así que pierden verificabilidad y trazabilidad de entidad.
  Falta además una bio con credenciales legibles por máquina y enlaces de
  corroboración externa (LinkedIn está; sumar perfiles/publicaciones/certificados).
- **Sin contenido en formato "ranking/comparativa".** Los motores generativos
  favorecen contenido enumerado y comparado (tablas "mejor para", pros/contras,
  rangos de precio). El bloque de e-commerce ya tiene 3 planes comparables — buen
  material para tabla comparativa marcada; el de servicios de datos no.
- **Sin fechas ni frescura.** No hay `datePublished`/`dateModified` ni señales de
  actualización, que pesan en la selección de fuentes por IA.

### 3.2 Palancas GEO recomendadas

1. **JSON-LD stacking**: `Person` + `ProfessionalService` + `WebSite` ahora; sumar
   `Service` por pilar y `FAQPage` al construir la FAQ.
2. **FAQ dedicada** por servicio, con preguntas redactadas como las haría un cliente.
3. **Bloques citables**: definiciones cortas y autocontenidas ("Un data lakehouse
   es…"), con dato/fuente al lado. Escritura densa en evidencia, con cifras.
4. **Entidad consistente**: mismo nombre, título y credenciales en el sitio,
   LinkedIn y cualquier listado → refuerza la entidad "Martín Duarte" para los LLMs.
5. **Casos con más contexto verificable** (rubro, tamaño, stack, resultado) aunque el
   cliente siga anonimizado, para que sean extraíbles y creíbles.

---

## 4. Arquitectura de servicios — de "acumulación" a 4 pilares orgánicos

### 4.1 El problema actual

El bloque **"Portafolio de Servicios"** amontona **~11 servicios de datos** en 4
subgrupos (Arquitectura Cloud, Ingeniería, Gobierno, Reporting) **+ 3 planes de
e-commerce + 2 servicios "Próximamente"** (Desarrollo de Software, Automatizaciones),
todo en la misma página, como una lista larga de tarjetas con brochures. Es
exactamente la "acumulación de servicios" que se quiere evitar: el visitante no
entiende _qué contratás_ en 5 segundos, y hay una **incoherencia de oferta**: el hero
vende **IA / Agentes**, pero la IA como servicio contratable figura como
"Próximamente".

### 4.2 Propuesta: 5 pilares, cada uno como página orgánica

> El desarrollo completo de cada página (copys, alcance, FAQ, servicios nuevos) está en
> [PROPUESTA-PAGINAS-SERVICIO.md](PROPUESTA-PAGINAS-SERVICIO.md). Resumen:

Consolidar toda la oferta en **cinco líneas de servicio claras**, cada una con su
**página dedicada e indexable** (no una tarjeta más en un acordeón):

| Pilar | URL propuesta | Qué absorbe hoy | Estado |
|-------|---------------|-----------------|--------|
| **Arquitectura de Datos** | `/servicios/arquitectura-de-datos` | Diagnóstico, Blueprint, Migración, Modernización, FinOps, Gobierno, Data Engineering, Dashboards, KPI/OKR + **Fractional Data/AI Leadership** (nuevo) | ✅ Activo (núcleo) |
| **Inteligencia Artificial** | `/servicios/inteligencia-artificial` | **Mentorías** (pymes, emprendedores, profesionales) + **Formación y acompañamiento** para principiantes / público general | 🔄 Formalizar (lo vende el hero) |
| **Automatizaciones** | `/servicios/automatizaciones` | Agentes de IA y flujos autónomos (hoy "Próximamente") + **Auditoría AI Readiness** como entrada | 🔄 Formalizar como pilar |
| **Tienda Nube (E-Commerce)** | `/servicios/tienda-nube` | Los 3 planes actuales + módulos opcionales | ✅ Activo |
| **Desarrollo Web / Software** | `/servicios/desarrollo-web` | "Desarrollo de Software" (hoy "Próximamente") + el propio servicio de landing pages del repo | 🔄 Formalizar |

**Servicios nuevos** (transversales, se ofrecen dentro de los pilares): Formación /
talleres in-company, Fractional Data/AI Leadership y Auditoría de preparación para IA
(AI Readiness). **Precios:** sin montos; todas las páginas cierran con "Consultar /
Agendar", **excepto Tienda Nube, que conserva sus rangos de precio visibles**. Detalle
en la propuesta enlazada arriba.

**Estructura orgánica recomendada para cada página de servicio** (misma plantilla,
para que se sientan coherentes y no como catálogos):

1. **Hero del servicio** — promesa + para quién es + CTA.
2. **El problema** que resuelve (en lenguaje del cliente, no técnico).
3. **Cómo trabajo / entregables** — 3–5 pasos, no una lista de features sueltas.
4. **Casos / resultados** con métricas (reutilizar los casos por rubro).
5. **FAQ del servicio** (2–5 preguntas → alimenta `FAQPage` schema).
6. **CTA** al calificador de 5 pasos → Calendly.
7. Brochure descargable (ya existen los PDFs).

Beneficios: (a) **SEO** — 4 URLs que rankean por 4 intenciones distintas; (b) **GEO**
— 4 entidades `Service` marcadas + FAQ citables; (c) **UX** — el visitante elige un
camino claro en vez de scrollear 11 tarjetas; (d) **coherencia** — la IA deja de ser
"Próximamente" y pasa a ser un pilar real, alineado con el hero.

> Nota de implementación: se puede mantener la home como está (con secciones
> resumen de cada pilar que enlazan a su página), respetando la estética actual, y
> construir las 4 páginas reutilizando el mismo sistema visual (mismas fuentes,
> paleta `#0F172A`/`#2563EB`/`#F8FAFC`, mismas tarjetas). No requiere rediseño.

---

## 4A. Estructura general del sitio y navegación (arquitectura de información)

> Objetivo: una estructura **ordenada, fácil de navegar, simple de explorar e
> intuitiva**. Hoy el sitio funciona como un único _scroll_ largo, con nombres
> internos en el menú y dos audiencias muy distintas mezcladas en el mismo recorrido.

### 4A.1 Estructura actual (mapa)

```
NAV:  [MARTINDUARTE]   Casos de Uso   Servicios ▾   Academia          [Agendar reunión]
                                        ├─ Data
                                        ├─ E-Commerce
                                        ├─ Desarrollo de Software  (Próximamente)
                                        └─ Automatizaciones        (Próximamente)

HOME (un solo scroll):
  1. Hero — "¿Tu arquitectura está lista para la IA?"        (#top)
  2. Casos de Uso                                            (#codex)
  3. Portafolio de Servicios  → 11 ítems en 4 subgrupos      (#servicios)
       Arquitectura Cloud (6) · Ingeniería (2) · Gobierno (1) · Reporting (2)
  4. Tienda online / TiendaNube → 3 planes + módulos         (#ecommerce)
  5. Academia → credenciales                                 (#academia)
  6. Contacto = FOOTER (CTA "¿Desafiamos el status quo?")    (#contacto)
```

### 4A.2 Problemas de navegación detectados

- **Nombres internos en el menú.** "Casos de Uso" y "Academia" son etiquetas de
  autor, no del visitante. Un menú intuitivo usa lenguaje plano: _Servicios, Casos,
  Sobre mí, Contacto_. "Academia" además no comunica que ahí están tus credenciales.
- **No hay "Sobre mí" ni "Contacto" en el menú.** Para una marca personal B2B, la
  ausencia de un "Sobre mí" accesible desde el nav resta confianza; y el contacto
  solo se alcanza scrolleando hasta el pie.
- **El menú mezcla activo con "Próximamente".** El dropdown muestra 2 servicios
  contratables y 2 que no existen aún → ruido y sensación de oferta incompleta.
- **El orden no sigue un embudo de decisión.** Se dumpean **11 servicios** _antes_ de
  que el visitante sepa quién sos (la bio queda al final). Primero conviene generar
  confianza (quién sos + prueba social), después profundizar en la oferta.
- **Dos audiencias muy distintas en el mismo recorrido lineal.** El comprador
  _enterprise_ de datos/IA y el comprador _pyme_ de una tienda TiendaNube tienen
  necesidades y presupuestos opuestos; hoy scrollean el mismo funnel y el bloque de
  e-commerce queda encajado, sin lógica, entre servicios de datos y credenciales.
- **Contacto = footer.** El cierre de conversión vive en el pie: no hay una sección
  de contacto propia y jerarquizada.
- **Todo en anclas (`#`), sin páginas.** Un único URL obliga a un scroll largo y
  impide navegar "a un tema" directo (se enlaza con la propuesta de 4 páginas de §4).

### 4A.3 Estructura propuesta (ordenada, simple e intuitiva)

**Principios aplicados:** menú de **5 ítems máximo** con lenguaje plano; **un único
CTA primario** persistente ("Agendar reunión"); orden en **embudo** (confianza →
oferta → prueba → cierre); **separar las dos audiencias** por página en vez de
mezclarlas; navegación _sticky_ y footer como menú secundario.

**Menú propuesto (plano y corto):**

```
[← MARTINDUARTE]   Servicios ▾   Sobre mí   Contacto   [Agendar reunión]
                     ├─ Arquitectura de Datos
                     ├─ Inteligencia Artificial
                     ├─ Automatizaciones
                     ├─ Tienda Nube (E-Commerce)
                     └─ Desarrollo Web
```

Los 5 ítems del dropdown son los **5 pilares** de §4 (ya sin "Próximamente": se
formalizan Automatizaciones, IA y Desarrollo Web como páginas activas). **"Casos" ya no
es ítem del menú**: los casos de uso viven dentro de cada pilar y el visitante ve solo
los del pilar que eligió (ver PROPUESTA §10.3). El **logo vuelve a la home**.

**Orden propuesto de la home (embudo):**

| # | Sección | Rol en el recorrido |
|---|---------|---------------------|
| 1 | **Hero** — promesa + CTA + micro-prueba (métrica o "Master IA UdeSA") | Enganche |
| 2 | **Barra de confianza** — 3–4 métricas o rubros atendidos | Credibilidad temprana |
| 3 | **Servicios** — los **5 pilares** como 5 tarjetas-resumen que enlazan a su página | Orientación clara |
| 4 | **Casos de éxito** — 2–3 destacados que enlazan al pilar (el detalle vive dentro de cada pilar) | Prueba |
| 5 | **Sobre mí** — bio + credenciales (Master IA UdeSA **primero**) | Autoridad / E-E-A-T |
| 6 | **FAQ** — 4–6 preguntas frecuentes | Objeciones + GEO |
| 7 | **Contacto / CTA final** — sección propia con el calificador de 5 pasos | Cierre |
| 8 | **Footer** — menú secundario, legal, redes | Navegación de respaldo |

**Mapa del sitio propuesto (jerarquía de 2 niveles):**

```
/  (Home — embudo de arriba)
├── /servicios/arquitectura-de-datos
├── /servicios/inteligencia-artificial
├── /servicios/automatizaciones
├── /servicios/tienda-nube        ← saca el e-commerce del scroll principal
├── /servicios/desarrollo-web    (los casos de uso viven DENTRO de cada pilar)
├── /sobre-mi                     ← "Academia" reconvertida en bio + credenciales
├── /contacto
└── /blog                         ← reemplaza el link muerto "Blog Técnico → #"
```

**Decisiones clave de esta estructura:**

- **TiendaNube deja de estar en el scroll principal** y pasa a su página de servicio;
  en la home queda solo como una de las 4 tarjetas. Así cada audiencia (enterprise vs.
  pyme) tiene su camino sin fricción.
- **"Academia" → "Sobre mí"**, movida al lugar del embudo donde genera autoridad, y
  con narrativa (no solo logos de certificaciones).
- **Contacto sale del footer** y se vuelve sección/página con jerarquía propia.
- **Un solo CTA** repetido ("Agendar reunión") en hero, nav y cierre, para no dispersar.
- **Migas de pan (breadcrumbs)** en las páginas internas (`Inicio › Servicios ›
  Arquitectura de Datos`) → orientación + `BreadcrumbList` schema (bonus GEO/SEO).
- **Accesibilidad de navegación:** link "Saltar al contenido" (skip-link), `<header>`
  envolviendo la nav, foco visible y el mismo árbol en el menú mobile.

> Compatibilidad con la estética: esto es **reordenar y renombrar**, no rediseñar. Se
> conservan fuentes, paleta y tarjetas actuales; cambian el rótulo del menú, el orden
> de bloques y el destino de los enlaces.

---

## 5. Secciones: qué agregar, qué sacar, qué falta

**Agregar (faltantes de alto valor):**

- **FAQ** (home + por servicio) — SEO featured snippets + GEO citabilidad.
- **Sobre mí / Bio** con credenciales legibles (Master en IA UdeSA **primero**, Lic.
  en Big Data UP, stack AWS/IBM), foto y prueba social → E-E-A-T. Hoy la parte
  académica existe pero no hay una bio narrativa que humanice y genere autoridad.
- **Testimonios reales con nombre y/o logo** (con permiso). Los casos son fuertes
  pero anónimos; un testimonio atribuible dispara la confianza y la citabilidad.
- **Blog técnico real** (reemplazar el link `#`). Es la palanca de SEO/GEO más
  potente a mediano plazo: cada artículo es una URL que rankea y una fuente que la
  IA puede citar. Aunque sea 1 post/mes sobre lakehouse, FinOps, gobierno de datos.
- **Sección de contacto propia** (hoy el contacto vive dentro del `<footer>`, que
  además semánticamente no corresponde).
- **Analítica + heatmap** (§6).

**Sacar / corregir:**

- El **link "Blog Técnico → #"** (o construir el blog, opción preferida).
- Los **asteriscos `**` literales** del hero (bug — corregido en quick wins).
- Los **placeholders "Próximamente"** (Desarrollo de Software, Automatizaciones) del
  dropdown: o se formalizan como pilares (§4) o se quitan del nav para no diluir el
  foco y no proyectar una oferta incompleta.

**Tensión a decidir (no bloqueante):**

- **Google AdSense en un sitio de consultoría B2B.** El script de AdSense
  (`ca-pub-1594572872514423`) es una **restricción de marca fija** y se mantiene en
  el `<head>`. Dicho eso, mostrar _ads_ en una página de servicios premium suele
  **restar autoridad percibida y competir con tu propio CTA**. Recomendación: mantener
  el script (por la restricción) pero **no** renderizar bloques de anuncios en las
  páginas de servicio/venta; reservar AdSense, si acaso, para el futuro blog.

---

## 6. Analítica y mapas de calor (pedido explícito)

Hoy **no hay ninguna medición**. Plan concreto:

1. **Google Analytics 4** (gtag.js) — tráfico, fuentes, conversiones. Configurar
   **eventos personalizados** para lo que importa:
   - `click_agendar` en cada botón "Agendar reunión" (hero, nav, footer, CTA final).
   - `download_brochure` en cada PDF (con el nombre del brochure como parámetro).
   - `click_plan_ecommerce` en los "Consultar" de cada plan.
   - `submit_calificador` al completar el formulario de 5 pasos.
2. **Microsoft Clarity** (gratis, ilimitado) — **mapas de calor de clic y scroll +
   grabaciones de sesión**. Es la mejor opción gratuita para "ver dónde hacen clic":
   heatmaps de click/scroll, _rage clicks_, _dead clicks_ y replays. (Alternativa:
   Hotjar, freemium con límite de sesiones.) **Recomendado: Clarity.**
3. **Google Search Console** — no es analítica de clics pero es imprescindible:
   verificar el dominio, enviar el sitemap y monitorear qué queries te muestran.
4. Opcional: **Google Tag Manager** para no tocar el HTML cada vez que se agrega un
   tag; hoy, con GA4 + Clarity directos, alcanza.

> En los _quick wins_ se dejan **GA4 y Clarity ya integrados con un ID placeholder**
> y una guarda para que no disparen hasta que pegues tus IDs reales. Ver el changelog.

---

## 7. Accesibilidad, usabilidad e interoperabilidad

**Accesibilidad (WCAG 2.1 AA):**

- **Iconos/emojis decorativos sin `aria-hidden`** (⚙ ⚡ 🎓 🛡️ 📊 🛒…): los lectores de
  pantalla los leen en voz alta. Marcar como `aria-hidden="true"`.
- **Tipografía micro:** uso extendido de `text-[10px]` en uppercase (badges, labels,
  botones). 10px es muy chico y en mayúsculas empeora la legibilidad; muchos de esos
  textos en `slate-400/500` sobre blanco **rozan o fallan el contraste AA** (4.5:1).
  Subir a mínimo 12px y oscurecer los grises secundarios.
- **Modal de agendamiento sin semántica ARIA:** falta `role="dialog"`,
  `aria-modal="true"`, etiqueta accesible y **atrapado de foco** (focus trap) + cierre
  con `Esc` y retorno de foco al disparador. Hoy `role=0` en todo el documento.
- **Botones sin texto accesible:** varios botones dependen de emoji/símbolo (p. ej.
  el toggle del menú). Sumar `aria-label`.
- **Landmarks:** el contacto vive en `<footer>` (semánticamente incorrecto); no hay
  `<header>`. Envolver la nav en `<header>` y separar contacto en `<section>`.

**Usabilidad:**

- El **dropdown de servicios** mezcla ítems activos con "Próximamente" al 55% de
  opacidad → confunde sobre qué se puede contratar.
- **Jerarquía de decisión**: 11 servicios de datos en una tirada larga generan
  parálisis. Los 4 pilares de §4 lo resuelven.
- Buen patrón: el **calificador de 5 pasos** antes de Calendly (lead scoring). Medir
  su tasa de completado con GA4 (evento del punto 6.1).

**Interoperabilidad:**

- Falta `theme-color` en el `<head>` (sí está en el manifest).
- `og-image` en SVG no interopera con scrapers sociales → generar PNG/JPG 1200×630.
- Sin structured data, la interoperabilidad con el ecosistema de buscadores/IA es
  nula (cubierto en §3).
- Validar el HTML (hay Markdown crudo y probablemente atributos sueltos).

---

## 8. Plan de acción priorizado

### Fase 1 — Quick wins (bajo riesgo, sin tocar estética) — _implementado ahora_

- [x] Capa SEO en `<head>`: `description`, `author`, `canonical`, `theme-color`,
      Open Graph y Twitter Cards.
- [x] Structured data JSON-LD: `Person`, `ProfessionalService` (con catálogo de los
      4 pilares) y `WebSite`.
- [x] GA4 + Microsoft Clarity integrados con ID placeholder y guarda de activación.
- [x] `preconnect` a orígenes de fonts/analytics.
- [x] Fix del bug de Markdown (`**Agentes de IA**`) en el hero.
- [x] `rel="noopener noreferrer"` en enlaces `target="_blank"` del footer.

### Fase 2 — Rendimiento e indexabilidad (1–2 días)

- [ ] Reemplazar Tailwind CDN por CSS compilado y minificado (Tailwind CLI/PostCSS).
- [ ] `defer` en `chart.js`; cargar fonts con `<link preconnect>` en vez de `@import`.
- [ ] Generar `og-image` PNG/JPG 1200×630 y referenciarlo.
- [ ] `sitemap.xml` completo (con las páginas de servicio) + `lastmod`.
- [ ] Alta en Google Search Console + envío de sitemap.

### Fase 3 — Estructura y navegación (1–2 días) — _ver §4A_

- [ ] Renombrar el menú a lenguaje plano: **Servicios ▾ · Casos · Sobre mí ·
      Contacto** + CTA "Agendar reunión". Quitar los "Próximamente" del dropdown.
- [ ] Reordenar la home al embudo propuesto (Hero → confianza → Servicios → Casos →
      Sobre mí → FAQ → Contacto → Footer).
- [ ] Sacar TiendaNube del scroll principal (queda como 1 tarjeta que enlaza a su
      página); separar así las dos audiencias (enterprise vs. pyme).
- [ ] Convertir "Academia" en "Sobre mí" (bio + credenciales) y moverla al embudo.
- [ ] Contacto como sección/página propia (fuera del `<footer>`).
- [ ] Breadcrumbs + `BreadcrumbList` schema en páginas internas; skip-link y
      `<header>` en la nav; mismo árbol en el menú mobile.

### Fase 4 — Arquitectura de servicios (3–5 días)

- [ ] Crear las 4 páginas de servicio (§4) con la plantilla orgánica y su schema
      `Service` + `FAQPage`.
- [ ] Reescribir la home para que cada pilar tenga un bloque-resumen que enlace a su
      página (sin romper la estética actual).
- [ ] Resolver los "Próximamente" (formalizar IA y Desarrollo Web o quitarlos).

### Fase 5 — Contenido y autoridad (continuo)

- [ ] Sección FAQ visible (home + por servicio) → activar `FAQPage` schema.
- [ ] Bio / "Sobre mí" con E-E-A-T (Master IA UdeSA primero).
- [ ] Testimonios atribuibles.
- [ ] Blog técnico real (reemplaza el link `#`), 1 artículo/mes mínimo.

### Fase 6 — Accesibilidad (1–2 días)

- [ ] `aria-hidden` en decorativos; `aria-label` en botones sin texto.
- [ ] Subir tipografía mínima a 12px y corregir contrastes de grises.
- [ ] Modal accesible: `role="dialog"`, `aria-modal`, focus trap, `Esc`, retorno de foco.
- [ ] `<header>` para la nav; contacto fuera del `<footer>`.

---

## 9. Cómo medir el progreso

- **SEO:** posiciones por keyword y clics en Search Console; que las 4 páginas de
  servicio indexen y rankeen por su intención.
- **GEO:** _reference rate_ — probar prompts ("¿quién ofrece arquitectura de datos
  fraccional en Argentina?", "consultor de Tienda Nube") en ChatGPT/Perplexity/Gemini
  cada 4–6 semanas y ver si aparece la marca.
- **Rendimiento:** PageSpeed Insights / CrUX — objetivo LCP < 2.5s, CLS < 0.1.
- **Conversión:** con GA4 + Clarity, tasa de clic en "Agendar", completado del
  calificador de 5 pasos y descargas de brochure; heatmaps para detectar dónde se
  pierde la atención.

---

_Fuentes GEO consultadas para esta auditoría:_
[GenOptima — GEO Best Practices 2026](https://www.gen-optima.com/geo/generative-engine-optimization-best-practices-2026/) ·
[Mersel AI — GEO for B2B 2026](https://www.mersel.ai/generative-engine-optimization) ·
[Progress Sitefinity — SEO & GEO 2026](https://www.progress.com/blogs/seo-and-geo-guide)
