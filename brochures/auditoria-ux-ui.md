# Auditoría UX/UI — martinduarte.com
**Framework:** B2B Conversion-Focused UX Review  
**Fecha:** Mayo 2026  
**Auditor:** Equipo Estratégico Interno  
**Alcance:** Ecosistema digital (sitio web + documentación comercial)

---

## Resumen Ejecutivo

El sitio presenta una identidad visual sólida y una estética diferenciada para el segmento de consultoría. Sin embargo, existen fricciones específicas en el embudo B2B que reducen la tasa de conversión hacia el CTA de "Agendar reunión". A continuación se detallan 12 puntos de mejora categorizados por impacto.

---

## 1. JERARQUÍA VISUAL

### 1.1 ❌ Hero: Múltiples tensiones de foco
**Problema:** El H1 (`¿Tu arquitectura está lista para la IA?`) compite con el bloque de Master en IA (UdeSA), el badge "Enterprise Solution Architect" y dos CTAs simultáneos. El ojo del usuario no tiene un camino claro.

**Recomendación:**
- Eliminar el badge secundario del Master del hero. Esa información pertenece a la sección Academia.
- Reducir a 1 CTA principal (`Agendar reunión`) y 1 CTA secundario de texto plano (`Ver servicios ↓`).
- El H1 debe mantenerse como el único elemento tipográfico dominante de la pantalla.

**Impacto estimado:** Alto — directamente afecta la primera decisión del tomador de decisión.

---

### 1.2 ❌ Codex: Métricas enterradas
**Problema:** Los números de impacto (−80% tiempo OT, −40% facturación, etc.) aparecen como texto secundario dentro de los cards. Un director que escanea no los detecta.

**Recomendación:**
- Las métricas deben ser el elemento visualmente dominante de cada card, no el descriptor técnico.
- Usar jerarquía: Número grande (32–40px) → Label pequeño → Descripción.

**Impacto estimado:** Alto — los KPIs son el argumento de venta más fuerte para perfiles C-Level.

---

### 1.3 ⚠️ Servicios: Estructura homogénea genera monotonía
**Problema:** Los 5 servicios core tienen exactamente el mismo layout (left-border + texto + botón). Esto genera un efecto de "lista de precios" en lugar de "portafolio estratégico".

**Recomendación:**
- Darle tratamiento visual diferenciado al servicio estrella ("Arquitecto Fractional") para que sea visualmente reconocible como el más estratégico.
- Agregar íconos o números visuales grandes (01, 02...) con más prominencia.

**Impacto estimado:** Medio.

---

## 2. FRICCIÓN EN EL EMBUDO B2B

### 2.1 ❌ CTA: Texto genérico para audiencia específica
**Problema:** "Agendar reunión" es el CTA principal en toda la página. Para un tomador de decisiones en PyME, esto puede sentirse como compromiso prematuro antes de entender bien la oferta.

**Recomendación:**
- Primer CTA en el hero: `"Diagnóstico gratuito de 20 min ➔"` — reduce la fricción percibida.
- CTA secundario: `"Ver servicios"` como ancla a la sección.
- El CTA final (footer) puede mantener `"Agendar reunión"` — el usuario que llega ahí ya está convencido.

**Impacto estimado:** Muy alto.

---

### 2.2 ❌ Formulario de 5 pasos: Fricción no justificada
**Problema:** El formulario de agendamiento tiene 5 pasos con preguntas técnicas (volumen de datos, stack cloud). Un director de PyME que nunca habló con vos no sabe responderlas y abandona.

**Recomendación:**
- Reducir a 3 pasos: (1) Nombre + mail, (2) Servicio de interés, (3) Urgencia / plazo.
- Las preguntas técnicas se resuelven en la primera reunión, no en el formulario.
- Alternativa: reemplazar el formulario por un link directo a Calendly con 2 tipos de reunión (Data / E-Commerce).

**Impacto estimado:** Muy alto — cada paso adicional de un formulario reduce la conversión ~20%.

---

### 2.3 ⚠️ Sección E-Commerce: Sin ancla visual desde el hero
**Problema:** La nueva sección de TiendaNube es invisible para quien llega buscando ese servicio específico. El hero y el nav no la posicionan como servicio relevante para PyMEs.

**Recomendación:**
- Agregar en el hero un badge alternativo o pill adicional que mencione "E-Commerce" para segmentar la audiencia desde el primer segundo.
- El dropdown del nav ya lo resuelve parcialmente, pero se necesita una entrada visual más obvia.

**Impacto estimado:** Alto para el segmento PyME no técnico.

---

### 2.4 ⚠️ Ausencia de social proof
**Problema:** No hay testimonios, logos de clientes (aunque sea anónimos como "Sector Energético", "Sector Logístico") ni indicadores de confianza más allá de los casos del Codex.

**Recomendación:**
- Agregar una banda de logos o íconos de sector (Oil & Gas, Finanzas, Logística, Educación) como social proof visual.
- Si hay reviews o recomendaciones de LinkedIn, extraer 2-3 citas breves y colocarlas entre el Codex y los Servicios.

**Impacto estimado:** Alto — la prueba social es el factor de confianza más efectivo en B2B.

---

## 3. ACCESIBILIDAD Y RENDIMIENTO

### 3.1 ❌ Contraste insuficiente en labels de servicio
**Problema:** Los tags de servicio (`bg-slate-100`, `text-slate-400`) tienen un ratio de contraste de aproximadamente 2.1:1. El estándar WCAG AA exige mínimo 4.5:1 para texto pequeño.

**Recomendación:**
- Cambiar `text-slate-400` → `text-slate-600` en los chips de servicio.
- En dark sections (academia), verificar que el texto `text-slate-400` cumpla contraste sobre `bg-slate-900`.

---

### 3.2 ⚠️ Imagen de hero: Placeholder visible en producción
**Problema:** El área de foto del hero contiene el texto `[RETRATO PROFESIONAL: HUMAN-CENTRIC ARCHITECT]` visible. Esto destruye la credibilidad ante cualquier visitante real.

**Recomendación:**
- Reemplazar con una fotografía profesional real de Martín como primera prioridad.
- Alternativa transitoria: usar una imagen abstracta generada con el skill `entidad/imagen/SKILL.md`.

**Impacto estimado:** Crítico — afecta la primera impresión directamente.

---

### 3.3 ⚠️ Sin meta-descripción optimizada
**Problema:** El `<title>` es `Martín Duarte | Senior Data Architect & AI Strategist`. Es correcto, pero la meta-descripción no está definida, lo que hace que Google genere una automáticamente (generalmente de baja calidad).

**Recomendación:**
```html
<meta name="description" content="Consultor Senior en Arquitectura de Datos y E-Commerce para PyMEs. 10+ años en empresas Enterprise. Implementación TiendaNube, estrategia de datos y modernización cloud.">
```

---

### 3.4 ⚠️ Botón "Descargar Brochure" sin feedback de carga
**Problema:** Los botones de descarga de brochures apuntan a PDFs que pueden tardar en cargar. No hay indicador de progreso ni confirmación.

**Recomendación:**
- Agregar `aria-label` descriptivo a cada botón.
- Considerar abrir los PDFs en nueva pestaña (`target="_blank"`) en lugar de forzar la descarga directa.

---

## 4. MOBILE EXPERIENCE

### 4.1 ⚠️ Bento Grid no adaptado a mobile
**Problema:** La sección Codex usa `auto-rows-[340px]` que en mobile comprime el contenido y puede hacer ilegibles las métricas de los cards.

**Recomendación:**
- Ajustar a `auto-rows-auto` en mobile con `min-height` adecuado.
- Revisar que los charts de Chart.js redimensionen correctamente en viewport < 640px.

### 4.2 ⚠️ Dropdown de navegación sin soporte táctil
**Problema:** El nuevo dropdown de Servicios usa `:hover` CSS puro. En mobile/tablet táctil, el hover no se activa y el dropdown queda inaccesible.

**Recomendación:**
- Agregar un listener JavaScript para toggle del dropdown en `touchstart`.
- Alternativa: convertir el dropdown en un acordeón en viewport < 768px.

---

## 5. PRIORIZACIÓN DE MEJORAS

| # | Mejora                                          | Impacto  | Esfuerzo | Prioridad |
|---|------------------------------------------------|----------|----------|-----------|
| 1 | Foto real en hero                               | Crítico  | Bajo     | 🔴 P0     |
| 2 | CTA del hero → "Diagnóstico gratuito"           | Muy alto | Bajo     | 🔴 P1     |
| 3 | Formulario → 3 pasos o Calendly directo        | Muy alto | Medio    | 🔴 P1     |
| 4 | Métricas de Codex como elemento dominante       | Alto     | Bajo     | 🟡 P2     |
| 5 | Meta-descripción SEO                            | Alto     | Mínimo   | 🟡 P2     |
| 6 | Contraste de labels (WCAG AA)                   | Alto     | Bajo     | 🟡 P2     |
| 7 | Social proof / logos de sector                  | Alto     | Medio    | 🟡 P3     |
| 8 | Dropdown táctil en mobile                       | Medio    | Bajo     | 🟢 P3     |
| 9 | Bento Grid responsive                           | Medio    | Medio    | 🟢 P4     |
| 10| PDFs en nueva pestaña con aria-label           | Bajo     | Mínimo   | 🟢 P5     |

---

## 6. QUICK WINS IMPLEMENTABLES HOY

```html
<!-- 1. Meta descripción -->
<meta name="description" content="Consultor Senior en Arquitectura de Datos y E-Commerce para PyMEs. 10+ años en empresas Enterprise. Implementación TiendaNube, estrategia de datos y modernización cloud.">

<!-- 2. Contraste labels -->
<!-- Cambiar en todos los chips: text-slate-400 → text-slate-600 -->

<!-- 3. PDFs en nueva pestaña -->
<!-- Añadir target="_blank" rel="noopener" a todos los <a> de brochures -->

<!-- 4. Dropdown táctil -->
<script>
document.querySelectorAll('.nav-dropdown-wrapper').forEach(wrapper => {
    wrapper.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const dd = wrapper.querySelector('.nav-dropdown');
        dd.style.display = dd.style.display === 'grid' ? 'none' : 'grid';
    });
});
</script>
```

---

*Auditoría generada con framework interno basado en WCAG 2.1, Nielsen's 10 Heuristics y mejores prácticas de conversión B2B (Gartner, Forrester).*
