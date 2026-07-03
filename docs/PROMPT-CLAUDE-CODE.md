# Prompt para Claude Code — Rediseño de martinduarte.com

> Copiá **todo el bloque de abajo** (entre las líneas `======`) y pegalo en Claude Code
> abierto en la raíz del repo. Antes de pegar, reemplazá los 3 placeholders marcados con
> `<<< >>>` (WhatsApp, GA4, Clarity). Si no los tenés, dejalos como están: el plan
> incluye guardas para que no rompan nada hasta cargarlos.

---

```text
======================================================================
CONTEXTO
Trabajás en el repo de martinduarte.com (sitio HTML/CSS/JS vanilla servido por Vercel,
sin framework ni build step; backend serverless en api/). Vas a implementar un rediseño
YA DISEÑADO y documentado. NO inventes alcance: la fuente de verdad es la carpeta docs/.

Leé primero, en este orden, y tratalos como especificación:
1. docs/PLAN-IMPLEMENTACION.md   ← el plan ejecutable (fases A→G, tareas T1…T22). Es tu guion.
2. docs/PROPUESTA-PAGINAS-SERVICIO.md   ← copys, alcance y público de cada pilar/servicio (§0.1 matriz).
3. docs/FAQ-SERVICIOS.md   ← las 80 FAQ (16 servicios × 5) que van dentro de cada tarjeta.
4. docs/AUDITORIA-SEO-GEO.md   ← menú, orden de home (embudo §4A), SEO/GEO, accesibilidad.
5. mocks/servicio-inteligencia-artificial.html   ← maquetación de referencia (HTML/estilo real ya aprobado).
También leé CLAUDE.md y .codex/rules.md para las restricciones del repo.

OBJETIVO
Transformar el sitio según el plan, SIN alterar la estética (fuentes Space Grotesk /
Plus Jakarta Sans, paleta #0F172A / #2563EB / #F8FAFC, tarjetas actuales). Es reordenar,
separar en 5 pilares con página propia, y mejorar SEO/GEO/rendimiento/accesibilidad.

DECISIONES YA TOMADAS (no las re-preguntes, respetalas)
- 5 pilares, cada uno con página propia en servicios/<slug>/index.html:
  Arquitectura de Datos, Inteligencia Artificial, Automatizaciones, Tienda Nube, Desarrollo Web.
- Menú: Servicios ▾ (5 pilares) · Sobre mí · Contacto · [Agendar reunión]. SIN "Casos",
  SIN "Próximamente". El logo lleva ← y vuelve a la home.
- Terminología: arriba son "pilares", adentro son "servicios". NUNCA uses la palabra
  "subservicio". En la interfaz los servicios se muestran SOLO con su nombre (ej. "Mentoría").
- El nombre del pilar va como TÍTULO grande arriba del bloque de servicios (no al costado del hero).
- La FAQ de cada servicio va DENTRO de su tarjeta, como lista desplegable (<details> anidados,
  patrón del mock), ocupando el ancho de la tarjeta. 5 preguntas por servicio (de FAQ-SERVICIOS.md).
- Los casos de uso viven DENTRO de cada pilar (no en el menú). Los 4 casos actuales de la
  home (Oil & Gas, serverless AWS, lakehouse logístico, medallion financiero) se MUEVEN al
  pilar Arquitectura de Datos. Cada pilar muestra solo sus casos.
- Contacto reducido: dos vías persistentes de baja fricción (CTA "Agendar reunión" en la nav
  + botón flotante de WhatsApp que acompaña el scroll) + UN solo cierre de contacto por página.
  No repitas "Agendar" en cada tarjeta.
- Precios: TODO cierra con "Consultar / Agendar" SIN montos, EXCEPTO Tienda Nube, que
  CONSERVA sus precios visibles (Básico USD 180–250, Intermedio 350–480, Premium 600–900).
- Inteligencia Artificial tiene 2 servicios: "Mentoría" (pymes/emprendedores/profesionales)
  y "Formación + acompañamiento" (público general, sin conocimiento previo). Público de cada
  pilar según la matriz §0.1 de la propuesta.

RESTRICCIONES DE MARCA (NO ROMPER)
- El script de AdSense ca-pub-1594572872514423 permanece en el <head> de TODAS las páginas.
- "Master en Inteligencia Artificial (UdeSA)" va PRIMERO en cualquier listado de credenciales.
- Todo CTA "Agendar reunión" abre el calificador de 5 pasos y al completarlo redirige a
  https://calendly.com/martynduarte/sample-30min. No alteres ese flujo.
- No toques api/ ni landing_page/ ni _lib/session.js: este trabajo es solo del sitio de
  marketing (index.html, nuevas páginas en servicios/, y assets/).

PARÁMETROS A CARGAR (reemplazá; si no los tenés, dejá el placeholder con su guarda)
- WhatsApp: <<<WHATSAPP_NUMBER, ej: 5491122334455>>>
- GA4 Measurement ID: <<<G-XXXXXXXXXX>>>
- Microsoft Clarity Project ID: <<<CLARITY_PROJECT_ID>>>

CÓMO TRABAJAR
- Seguí docs/PLAN-IMPLEMENTACION.md fase por fase (A→G) y tarea por tarea (T1…T22), en el
  orden y con las dependencias que indica (§5 del plan). Empezá por las Fundaciones (T1–T3).
- Un commit por tarea, mensaje en español: una línea resumen en imperativo, luego el POR QUÉ
  (síntoma/objetivo) antes del QUÉ, y una línea final con qué verificaste. git push tras cada commit.
- Antes de cada commit corré `npm test` (debe quedar verde). Si tocaras el flujo del wizard,
  corré también `npx playwright test` (no debería ser necesario).
- Centralizá nav, footer, botón WhatsApp y analítica en assets/js/site.js, y el modal
  calificador de 5 pasos en assets/js/booking.js (una sola fuente de verdad; cada página los
  incluye). Detalle en T1–T3 del plan.
- Para cada página de pilar: agregá JSON-LD Service + FAQPage + BreadcrumbList (las preguntas
  del schema deben coincidir con las FAQ visibles). La home ya tiene Person + ProfessionalService
  + WebSite (no lo dupliques, verificá que siga válido).
- Rendimiento (Fase D): reemplazá cdn.tailwindcss.com por Tailwind compilado y commiteado
  (assets/css/tailwind.css), con content glob que incluya index.html, servicios/**/*.html y
  assets/js/*.js. Validá visualmente que el look no cambie. Si preferís, dejá esta fase para
  el final; el resto no depende de ella.
- Accesibilidad (Fase G): <header> en la nav, aria-hidden en decorativos, aria-label en
  botones/íconos, modal con role="dialog"/aria-modal/focus-trap/Esc/retorno de foco,
  skip-link, tipografía ≥12px y contraste AA.

VALIDACIÓN FINAL
Antes de dar por terminado, verificá el "Checklist de aceptación global (QA final)" de la
§4 del plan, punto por punto. Validá el JSON-LD de cada página en https://validator.schema.org
y revisá cada página en el navegador (navegación home↔pilar, FAQ desplegable, WhatsApp,
calificador→Calendly). Reportá cualquier ítem del checklist que no puedas cumplir y por qué.

ENTREGABLES
El sitio transformado según el plan, commiteado y pusheado tarea por tarea, con el checklist
QA cumplido. Si algo del plan es ambiguo en el momento de codear, preferí lo que dice el mock
y la propuesta; si sigue siendo ambiguo, preguntá antes de avanzar en esa tarea puntual.
======================================================================
```

---

## Notas de uso

- **Ejecución por partes:** si preferís no correr todo de una, pediле a Claude Code "hacé
  solo la Fase A" (o "las tareas T1 a T3") y revisá antes de seguir. El prompt ya lo soporta.
- **Placeholders:** si dejás `G-XXXXXXXXXX` / `CLARITY_PROJECT_ID` / el WhatsApp de ejemplo,
  el sitio no rompe (hay guardas), pero la analítica y el WhatsApp no funcionan hasta cargarlos.
- **Orden recomendado de revisión tuya:** después de la Fase C (las 5 páginas) mirá el
  resultado en el navegador; ahí ya se ve el 80% del rediseño.
