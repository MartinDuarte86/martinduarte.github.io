# Propuesta de Páginas de Servicio — martinduarte.com

> Complemento de [AUDITORIA-SEO-GEO.md](AUDITORIA-SEO-GEO.md) (§4 y §4A).
> Desarrolla la propuesta de **cada página de servicio** a partir de las decisiones
> tomadas: **5 pilares** con página propia, **IA reposicionada hacia aprendizaje y
> accesibilidad** (mentorías + formación/acompañamiento para principiantes), **sin
> precios** salvo Tienda Nube, y tres servicios nuevos: **Formación in-company,
> Fractional Data/AI Leadership y Auditoría de preparación para IA (AI Readiness)**.
> Fecha: 2026-07-02.

---

## 0. Mapa de servicios (visión general)

Los **5 pilares** del menú, cada uno con su URL y su página orgánica:

| Pilar | URL | Servicio principal | CTA |
|-------|-----|--------------------|-----|
| **Arquitectura de Datos** | `/servicios/arquitectura-de-datos` | Diseñar y ordenar la plataforma de datos | Agendar reunión |
| **Inteligencia Artificial** | `/servicios/inteligencia-artificial` | **Mentorías** + **Formación y acompañamiento** para principiantes | Agendar reunión |
| **Automatizaciones** | `/servicios/automatizaciones` | Agentes de IA y flujos autónomos | Agendar reunión |
| **Tienda Nube** | `/servicios/tienda-nube` | Implementación profesional de e-commerce (**con precios visibles**) | Consultar |
| **Desarrollo Web** | `/servicios/desarrollo-web` | Plataformas y sitios a medida | Consultar |

### 0.1 Público objetivo por servicio (matriz confirmada)

Segmentos: **Empresas · Pymes · Emprendedores · Profesionales · Público general**
(este último = sin conocimiento previo en tecnología ni herramientas).

| Servicio | Empresas | Pymes | Emprendedores | Profesionales | Público general |
|----------|:---:|:---:|:---:|:---:|:---:|
| **Arquitectura de Datos** | ✅ | ✅ | – | – | – |
| **IA — Mentorías** | – | ✅ | ✅ | ✅ | – |
| **IA — Formación + acompañamiento** | – | – | – | ✅¹ | ✅ |
| **Automatizaciones** | ✅ | ✅ | ✅ | ✅ | – |
| **Tienda Nube** | – | ✅ | ✅ | – | ✅ |
| **Desarrollo Web** | – | ✅ | ✅ | ✅ | ✅ |

¹ _Profesionales que arrancan de cero en IA también entran en el servicio introductorio._

**Servicios nuevos (transversales)** y su público:

| Servicio nuevo | Vive en | Público |
|----------------|---------|---------|
| **Formación / talleres in-company** | IA + Arquitectura de Datos | Empresas · Pymes |
| **Fractional Data/AI Leadership** | Arquitectura de Datos (ref. en IA) | Empresas · Pymes |
| **Auditoría de preparación para IA (AI Readiness)** | **Automatizaciones** + **Arquitectura de Datos** (entrada de negocio) | Empresas · Pymes · Emprendedores · Profesionales |

**Dónde viven los 3 servicios nuevos** (transversales, no son un pilar más para no
inflar el menú — §7):

- **Formación / talleres in-company** → destacado en **IA** (formación de equipos) y
  referenciado en **Arquitectura de Datos** (talleres de datos/gobierno).
- **Fractional Data/AI Leadership** (CDO/CAIO por horas) → ancla en **Arquitectura de
  Datos** (evoluciona tu "Arquitecto de Datos por Horas") y se referencia en **IA**.
- **Auditoría de preparación para IA (AI Readiness)** → **puerta de entrada de
  Automatizaciones** (evalúa si el negocio está listo para adoptar IA/agentes).

**Nota de precios:** los servicios cierran con "Consultar / Agendar reunión" **sin
montos**, con **una excepción confirmada: Tienda Nube mantiene sus rangos de precio
visibles** (USD 180–900). Los planes productizados con precio califican mejor al lead
(filtran presupuesto antes de la reunión), así que se conserva tal cual está hoy.

---

## 1. Plantilla común (para que todas se sientan orgánicas, no un catálogo)

Todas las páginas de servicio usan **la misma estructura y el mismo sistema visual**
(fuentes Space Grotesk / Plus Jakarta Sans, paleta `#0F172A` / `#2563EB` / `#F8FAFC`,
tarjetas bento actuales). Cambia el contenido, no la estética.

> **Terminología (importante):** el nivel de arriba son **pilares**; lo que hay adentro
> son **servicios** (no "subservicios"). En la interfaz se muestran **solo con su
> nombre** (p. ej. "Mentoría"), sin la palabra "servicio" delante.

Orden de secciones de una página de pilar:

1. **Breadcrumb + indicador de pilar** — `Inicio › Servicios › {Pilar}`, más un **título
   de pilar actual al costado del hero** (que deje claro dónde está parado el usuario) y
   un enlace **"Volver al inicio"** (el logo también vuelve a la home).
2. **Hero del pilar** — titular con la promesa + subcopy + un único CTA/anclaje.
3. **Servicios del pilar** — cada servicio en su propia tarjeta. **La FAQ de ese servicio
   va dentro de su tarjeta**, como lista desplegable (estilo el menú de servicios) que
   ocupa el ancho del cuadro; al abrirla muestra sus 5 preguntas. Todas las FAQ de la
   página se declaran juntas en un único `FAQPage` schema. Contenido completo en
   [FAQ-SERVICIOS.md](FAQ-SERVICIOS.md).
4. **Casos de uso propios del pilar** — **solo los casos de este pilar** (no un menú
   global de casos). El visitante ve únicamente los casos del pilar que eligió.
5. **Un único momento de contacto** — un cierre con el/los CTA de decisión. Más el
   **botón flotante de WhatsApp** persistente (ver §10). Evitar repetir "Agendar" en
   cada bloque.

**Schema por página:** `Service` (con `provider` → tu `Person`/`ProfessionalService`)
+ `FAQPage` + `BreadcrumbList`.

---

## 2. Arquitectura de Datos  ·  `/servicios/arquitectura-de-datos`

**Público:** empresas y pymes con plataformas de datos que crecieron sin orden.
**Servicio principal:** diseñar, ordenar y modernizar la plataforma de datos.

**Hero (propuesta de copy):**
> **Tu plataforma de datos, con un plan claro.**
> Antes de invertir en más tecnología, ordenamos qué tenés, qué te falta y hacia
> dónde va. De la improvisación a una arquitectura que acompaña al negocio.

**El problema:** sistemas dispersos, costos que no se entienden, decisiones frenadas
por datos poco confiables y proyectos que van cada uno para su lado.

**Qué incluye (agrupado, no como lista de 11 ítems):**

- **Estrategia y diagnóstico** — Diagnóstico de Arquitectura, Blueprint Empresarial,
  Estrategia de Migración, y **Auditoría de preparación para IA (AI Readiness)** — el
  paso previo para saber si los datos están listos para IA/agentes (§7).
- **Implementación e ingeniería** — Modernización de Plataforma, Data Engineering e
  Integración, FinOps / Optimización Cloud.
- **Gobierno y confianza del dato** — Gobierno y Calidad de Datos (linaje, PII,
  compliance).
- **Reporting y decisión** — Dashboards ejecutivos, KPIs / OKRs.
- **Acompañamiento** — **Fractional Data Leadership** (ver §7): la seniority de un
  arquitecto enterprise por horas, sin costo full-time.

**Resultados (casos existentes):** −80% en tiempo de gestión OT (Oil & Gas), −40% de
factura mensual (serverless AWS), 50+ pipelines migrados con compliance BCRA.

**FAQ sugeridas:**
- ¿Qué es una auditoría de arquitectura de datos y qué me llevo?
- ¿Cuándo conviene un data lakehouse vs. un data warehouse?
- ¿Puedo contratar un arquitecto de datos por horas en vez de full-time?
- ¿Cómo reducen la factura cloud sin frenar la operación?

**CTA:** Agendar reunión · Descargar brochure.

---

## 3. Inteligencia Artificial  ·  `/servicios/inteligencia-artificial`

**Enfoque:** pilar reposicionado hacia **aprender y aplicar IA**, no consultoría
enterprise (la IA aplicada al negocio vive en **Automatizaciones** y en **Arquitectura
de Datos**). **Dos caminos claros en la misma página**, con un selector de entrada
"¿Ya trabajás con tecnología o arrancás de cero?".

**Público:**
- **Mentorías** → pymes, emprendedores y profesionales (con algo de base o rumbo).
- **Formación + acompañamiento** → **público general, sin conocimiento previo** en
  tecnología ni herramientas (también profesionales que arrancan de cero en IA).

**Estructura:** el **pilar Inteligencia Artificial** agrupa **dos servicios** en la
misma página: **Mentoría** y **Formación + acompañamiento** (en la interfaz aparecen
solo con su nombre, sin la palabra "servicio").

**Hero (propuesta de copy):**
> **La IA, a tu alcance — sin importar desde dónde arranques.**
> Si ya tenés rumbo, te mentoreo para acelerar. Si arrancás de cero, te enseño y te
> acompaño paso a paso hasta que la uses con confianza.

### 3.1 Mentoría — pymes, emprendedores y profesionales
- **Mentoría 1:1** — plan personalizado según objetivo (transición a datos/IA, subir
  de seniority, aplicar IA en tu pyme o emprendimiento, portfolio).
- **Mentoría grupal / cohortes** — grupos reducidos con foco práctico.
- **Programa guiado** — acompañamiento por N semanas con hitos.

### 3.2 Formación + acompañamiento — público general (sin conocimiento previo)
- **Formación introductoria** — qué es la IA, para qué sirve y cómo usar las
  herramientas del día a día, explicado sin tecnicismos.
- **Acompañamiento** — te sigo mientras la aplicás a tu trabajo, estudio o pequeño
  negocio, hasta que la uses con confianza.
- Formato **formación + acompañamiento** combinados: primero entender, después aplicar.
  _(Sin precio: cada camino cierra en "Agendar" para acordar alcance.)_

**Coherencia con el hero de la home:** este pilar sostiene la promesa de la home sobre
IA y deja de figurar como "Próximamente".

**FAQ sugeridas:**
- ¿Necesito saber de tecnología o programar para empezar?
- ¿Qué diferencia hay entre la mentoría y el camino "empezá de cero"?
- ¿Las mentorías son 1:1 o grupales?
- Tengo una pyme/emprendimiento, ¿me sirve la mentoría para aplicar IA en mi negocio?

**CTA:** Agendar una mentoría · Empezar de cero.

---

## 4. Automatizaciones  ·  `/servicios/automatizaciones`  ·  **NUEVO PILAR**

> Hoy figura como "Próximamente" en el menú. Se formaliza como pilar propio.

**Público:** todos los que tengan procesos repetitivos — **empresas, pymes,
emprendedores y profesionales** (desde un equipo grande hasta alguien que automatiza
su trabajo individual).
**Servicio principal:** **agentes de IA y flujos autónomos** que ejecutan trabajo real.

**Hero (propuesta de copy):**
> **Que el trabajo repetitivo se haga solo.**
> Diseño agentes de IA y automatizaciones que conectan tus sistemas y ejecutan
> procesos de punta a punta, con supervisión y trazabilidad.

**El problema:** tareas manuales que consumen horas, datos que se copian a mano entre
sistemas, y procesos que dependen de que alguien se acuerde de hacerlos.

**Puerta de entrada — Auditoría de preparación para IA (AI Readiness):** antes de
automatizar, un diagnóstico corto de qué tan listo está tu negocio para adoptar
IA/agentes — datos, procesos, casos de uso con ROI real, riesgos y un plan priorizado.
Sirve a empresas, pymes, emprendedores y profesionales (§7).

**Qué incluye:**
- **Agentes de IA** — asistentes que razonan sobre tus datos y ejecutan acciones
  (clasificar, responder, generar, decidir con reglas).
- **Automatización de procesos (workflows)** — flujos autónomos entre apps (ERP, CRM,
  mail, planillas, APIs) con observabilidad y control de errores.
- **Integraciones inteligentes** — conectar sistemas que hoy no se hablan.
- **Guardrails** — límites de costo, revisión humana en pasos críticos, logging.

**Diferencia con el pilar IA:** IA es _aprender_ (mentorías y formación para personas);
Automatizaciones es _hacer_ (construir el agente/flujo que corre en producción para un
negocio). Se enlazan entre sí.

**Ejemplo citable (propio):** el propio servicio de generación de landing pages de
este sitio es una automatización con agentes de IA de punta a punta (brief → 3
diseños → aprobación → deploy). Sirve como caso demostrable.

**FAQ sugeridas:**
- ¿Qué puede (y qué no) hacer un agente de IA en mi empresa?
- ¿Cómo se controla que una automatización no se equivoque?
- ¿Qué procesos conviene automatizar primero?
- ¿Se integra con las herramientas que ya uso?

**CTA:** Agendar reunión · (opcional) "Ver una automatización real" → caso del sitio.

---

## 5. Tienda Nube (E-Commerce)  ·  `/servicios/tienda-nube`

**Público:** pymes, emprendedores y **público general** que quiere empezar a vender
online sin lidiar con lo técnico, aunque no tenga experiencia previa.
**Servicio principal:** implementación profesional de tiendas en TiendaNube.

> Se **saca del scroll principal** de la home (audiencia distinta al enterprise) y pasa
> a su página; en la home queda como una de las 5 tarjetas de servicio.

**Hero (propuesta de copy):**
> **Tu tienda online, lista para vender.**
> Configuración profesional en TiendaNube: productos, pagos, envíos y capacitación.
> Empezás a vender desde el primer día, sin preocuparte por lo técnico.

**Qué incluye — 3 niveles por alcance (con rango de precio visible):**
- **Básico** — USD 180–250 · tienda lista para operar (configuración, template, dominio,
  hasta 150 productos, Pago/Envío Nube, capacitación 1h).
- **Intermedio** — USD 350–480 · tienda completa y conectada (personalización avanzada,
  SEO con IA, hasta 300 productos, Mercado Pago + logística, canales sociales,
  estadísticas).
- **Premium** — USD 600–900 · solución 360° multicanal (ajustes HTML/CSS, productos
  ilimitados, checkout con identidad, todos los medios de pago, marketplaces, panel
  financiero).
- **Módulos opcionales** — Chat Nube, Marketing Nube, POS, integración ERP, desarrollo
  a medida.

✅ _Decisión confirmada:_ **Tienda Nube conserva los precios visibles** (única excepción
a la política de "sin montos"). Mantiene el CTA "Consultar" junto a cada plan.

**FAQ sugeridas:**
- ¿Cuánto tarda en estar lista mi tienda?
- ¿Qué diferencia hay entre los planes Básico, Intermedio y Premium?
- ¿Puedo migrar mi tienda actual o mis productos?
- ¿Me capacitan para gestionarla yo mismo?

**CTA:** Consultar · Módulos opcionales.

---

## 6. Desarrollo Web  ·  `/servicios/desarrollo-web`  ·  **FORMALIZA "Próximamente"**

**Público:** pymes, emprendedores, profesionales y **público general** que necesitan
una plataforma, sitio o su primera landing a medida.
**Servicio principal:** desarrollo de plataformas, sitios y landing pages a medida.

**Hero (propuesta de copy):**
> **Software y sitios a medida, sin vueltas.**
> Desde una landing que convierte hasta plataformas e integraciones a medida, con la
> misma cabeza de arquitecto: pensado para escalar y para el negocio.

**Qué incluye:**
- **Landing pages y sitios** — incluyendo tu **servicio productizado de landing pages
  con IA** (brief conversacional → 3 diseños → deploy). Es un diferencial único: úsalo
  como estrella de este pilar.
- **Plataformas a medida** — aplicaciones web para procesos específicos.
- **Integraciones** — conectar el sitio/plataforma con tus sistemas (se cruza con
  Automatizaciones).

**FAQ sugeridas:**
- ¿En cuánto tiempo tengo una landing page lista?
- ¿Qué es el servicio de landing pages con IA y cómo funciona?
- ¿Puedo pedir una plataforma a medida y no solo un sitio?
- ¿El sitio queda optimizado para SEO y para buscadores de IA?

**CTA:** Consultar · Probar el generador de landing pages.

---

## 7. Servicios nuevos (transversales) — dónde y cómo aparecen

No son un 6º ítem de menú (para no inflar la navegación); se ofrecen **dentro** de los
pilares donde tienen sentido, con su propia tarjeta/sección y su brochure.

**a) Formación / talleres in-company**
- Aparece en: **IA** (formación de equipos) y **Arquitectura de Datos** (talleres de
  datos/gobierno).
- Público: empresas y pymes.
- Qué es: capacitaciones y workshops a medida para equipos (fundamentos de IA, adopción
  de agentes, gobierno de datos, lectura de dashboards).
- _No confundir con el camino "empezá de cero" del pilar IA, que es para individuos del
  público general; este es para equipos de una organización._
- CTA: Agendar reunión.

**b) Fractional Data/AI Leadership (CDO/CAIO por horas)**
- Aparece en: **Arquitectura de Datos** (ancla, evoluciona "Arquitecto por Horas") y se
  referencia en **IA**.
- Público: empresas y pymes.
- Qué es: rol de liderazgo de datos/IA part-time — valida decisiones técnicas, participa
  de reuniones estratégicas, da criterio senior sin costo full-time. Ideal para pymes.
- CTA: Agendar reunión.

**c) Auditoría de preparación para IA (AI Readiness Assessment)**
- Aparece en: **Automatizaciones** (puerta de entrada antes de construir agentes/flujos)
  y **Arquitectura de Datos** (dentro de "Estrategia y diagnóstico" — saber si los datos
  están listos para IA).
- Público: empresas, pymes, emprendedores y profesionales.
- Qué es: diagnóstico de qué tan listo está el negocio para adoptar IA/agentes — datos,
  procesos, casos de uso con ROI, riesgos y un plan priorizado.
- CTA: Agendar reunión · Descargar brochure.

---

## 8. Menú actualizado y navegación

**Cambio pedido:** agregar **Automatizaciones** al menú (hoy está como "Próximamente").
Menú final (5 pilares activos, sin badges "Próximamente"):

```
[← MARTINDUARTE]   Servicios ▾   Sobre mí   Contacto   [Agendar reunión]
                     ├─ Arquitectura de Datos
                     ├─ Inteligencia Artificial
                     ├─ Automatizaciones
                     ├─ Tienda Nube
                     └─ Desarrollo Web
```

- Cada ítem del dropdown enlaza a su página de pilar.
- Se eliminan los estados "Próximamente" (IA, Automatizaciones y Desarrollo pasan a
  activos).
- **"Casos" ya no es un ítem del menú:** los casos viven dentro de cada pilar (§10.3).
- **El logo vuelve a la home** (lleva una flecha ←) y cada página de pilar tiene enlace
  "Volver al inicio".
- En la home, cada pilar tiene una **tarjeta-resumen** (título + 1 línea + link "Ver
  más") — 5 tarjetas ordenadas, no 11 ítems sueltos.

---

## 9. Próximos pasos sugeridos

1. Validar esta propuesta (copys, alcance de cada pilar, decisión de precios).
2. Construir la **plantilla común** de página de servicio (§1) reutilizando la estética
   actual.
3. Poblar las 5 páginas con el contenido de §2–§6 + los 3 servicios nuevos (§7).
4. Actualizar el menú y las tarjetas-resumen de la home (§8).
5. Sumar `Service` + `FAQPage` + `BreadcrumbList` por página (ver AUDITORIA-SEO-GEO §3).

> Cuando confirmes, puedo pasar a construir la plantilla y la primera página (sugiero
> empezar por **Inteligencia Artificial**, que es la que sostiene el hero) respetando
> la estética actual.

---

## 10. Ajustes de diseño — iteración 2026-07-02

Cambios pedidos sobre el mock (`mocks/servicio-inteligencia-artificial.html`), ya
aplicados y reflejados en la plantilla (§1) y el menú (§8):

**10.1 FAQ dentro de cada servicio (no en sección aparte).** La FAQ de cada servicio
vive **dentro de su tarjeta**, como lista desplegable (estilo el menú de servicios) que
ocupa el ancho del cuadro; al abrirla despliega sus 5 preguntas. Ventaja UX: el usuario
resuelve dudas sin salir del servicio que está mirando.

**10.2 Botón flotante de WhatsApp.** Ícono de WhatsApp fijo al costado derecho de la
pantalla que **acompaña el scroll** (`position:fixed`). Es la vía de contacto de baja
fricción; convive con el CTA de "Agendar".

**10.3 Casos de uso dentro de cada pilar.** Los casos dejan de estar en el menú global.
Cada pilar muestra **solo sus propios casos**. Los 4 casos actuales de la home (Oil &
Gas, serverless AWS, lakehouse logístico, medallion financiero) **se mueven al pilar
Arquitectura de Datos**. Cada pilar tendrá sus casos particulares, y el cliente ve
únicamente los del pilar que eligió.

**10.4 Reducción de CTAs de contacto (análisis).** El mock inicial repetía "Agendar"
en nav, hero (×2), cada tarjeta y el cierre → **sensación de invasión**. Criterio
aplicado: **dos vías persistentes de baja fricción** (CTA de "Agendar" en la nav +
WhatsApp flotante) y **un único momento de contacto fuerte** al final (bloque de
decisión con las dos opciones). Se quitaron los botones "Agendar" de cada tarjeta y el
duplicado del hero (el hero queda con un solo anclaje "Ver los dos caminos"). Resultado:
el contacto está siempre disponible pero no persigue al usuario en cada bloque.

**10.5 Sin la palabra "subservicio".** El nivel de arriba son **pilares**; lo de adentro
son **servicios**, y en la interfaz se muestran **solo con su nombre** (p. ej. "Mentoría",
no "Subservicio 1 · Mentoría" ni "Servicio: Mentoría").

**10.6 Volver a la home.** Al entrar a un pilar, el usuario puede volver siempre: el
**logo lleva ← y vuelve al inicio**, hay un enlace "Volver al inicio" junto al breadcrumb
y el pie también enlaza a la home.

**10.7 Título de pilar arriba de los servicios.** El nombre del pilar (p. ej.
"Inteligencia Artificial") se muestra como **título grande encabezando el bloque de
servicios** — es decir, justo arriba de las tarjetas (Mentoría / Formación +
acompañamiento) — para que quede claro en qué pilar está el usuario. Se apoya en el
breadcrumb y en el enlace "Volver al inicio". (Se quitó el indicador lateral del hero
para no duplicar.)
