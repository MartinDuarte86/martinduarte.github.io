# Plan de Negocio y Monetización — Servicio de Landing Pages con IA

**Producto:** generador conversacional de landing pages (`/landing_page/`)
**Premisa:** operación 100% sobre free tiers (Vercel Hobby + Upstash Free + Supabase Free). El único costo variable es la API de Anthropic.
**Fecha:** junio 2026 · **Autor:** Martín Duarte

---

## 1. Diagnóstico comercial de partida

### 1.1 El funnel y sus fugas

```
Visita → Modal 3 pasos → Registro → Wizard (6 secciones, ~10-15 min)
  → Generación de diseños → Selección → Pago (link MP) → Confirmación → Entrega
```

Hasta esta iteración, la conversión era **estructuralmente cero**: el rate limit
de generación (2/día) era menor que las llamadas necesarias por set (3), por lo
que ningún usuario podía completar el funnel. Cada sesión que llegaba al final
representaba costo de API real (~US$0.15-0.25 en Sonnet) sin posibilidad de
revenue. Ese bug está corregido (límite 8/día + generación resiliente + streaming),
lo que habilita por primera vez medir conversión real.

### 1.2 Asimetría costo/valor (corregida)

- El **budget guard** ($4.000 ARS por sesión) ahora cubre también las llamadas de
  generación (Sonnet), que son ~85% del costo por sesión. Antes solo limitaba Haiku.
- **Prompt caching** activado en el proxy: el system prompt estable de cada sección
  se cachea (90% de descuento en tokens de input repetidos a lo largo de las
  20-35 llamadas del wizard).

---

## 2. Costos unitarios por sesión (precios API vigentes)

| Componente | Modelo | Tokens estimados | Costo |
|---|---|---|---|
| Evaluación + wizard (~25 llamadas) | Haiku 4.5 | ~38k in / ~8k out | US$0.062 |
| → con prompt caching del núcleo | Haiku 4.5 | 90% desc. sobre ~60% del input | **US$0.035** |
| Generación de 3 diseños | Sonnet 4.6 | ~6k in / ~22k out | **US$0.35** |
| **Total sesión completa** | | | **≈ US$0.39** |
| Total con generación híbrida (v2, ver §6) | | | ≈ US$0.10 |

---

## 3. Modelo Freemium — el pago se adelanta al costo

**Principio:** hoy el 85% del costo (Sonnet) se gasta antes de pedir plata, y el
usuario ve el diseño completo antes de pagar. El modelo nuevo invierte el orden:

```
Wizard gratis (Haiku, ~US$0.04)
  → 1 PREVIEW GRATIS (1 llamada Sonnet ~US$0.12,
     con marca de agua CSS + blur del 40% inferior)
  → [MOMENTO DE PAGO — link MP existente]
  → pago confirmado → se generan los otros 2 diseños
  → entrega de los 3 completos + ronda de ajustes
```

### 3.1 Tiers

| Tier | Incluye | Costo API | Precio sugerido (ARS) |
|---|---|---|---|
| **Gratis** | Wizard + 1 preview con watermark | ~US$0.16 | $0 — costo de adquisición |
| **Landing** | 3 diseños completos + 1 ronda de ajustes + entrega | ~US$0.40 | $45.000 – $60.000 |
| **Landing Pro** | + publicación con dominio + 3 meses de cambios | ~US$0.50 | $90.000 – $120.000 |
| **Mantenimiento** (recurrente) | cambios mensuales + hosting gestionado | ~$0 | $8.000 – $12.000/mes |

Notas:
- La marca de agua/blur es CSS inyectado sobre el iframe del preview gratuito —
  costo $0. El HTML completo solo se entrega post-pago (cierra la fuga del
  "inspeccionar elemento").
- El preview gratuito puede servirse desde el **cache por rubro en Redis**
  (`rubro-cache:*`, ya implementado): para rubros repetidos la demo cuesta $0.
- **El tier recurrente es el negocio real**: 20 clientes de mantenimiento =
  $160.000–240.000 ARS/mes de base estable, inmune al costo de API.

### 3.2 Inventario sin costo marginal

Cada set generado se persiste en Supabase (`design_sets`) y alimenta el carrusel
de "diseños anteriores". Un diseño previo elegido del carrusel es una venta con
costo de API **cero** → margen 100%. Acción comercial: "Elegí uno de nuestros
diseños y lo adaptamos a tu marca — entrega en 24h".

---

## 4. Proyección — el stack gratuito aguanta

| Recurso | Free tier | 100 ses./mes | 1.000 ses./mes |
|---|---|---|---|
| Vercel funciones (GB-hrs) | 100 | ~3% | ~30% |
| Upstash Redis (comandos/mes) | 500.000 | ~2% | ~20% |
| Supabase storage | 500 MB | ~15 MB | ~150 MB |
| **Costo API Anthropic** | — | **≈ US$18** | **≈ US$180** |

*Supuesto: 40% de las sesiones llegan al preview gratuito.*

**Unit economics a 100 sesiones/mes** con conversión del 5% al tier Landing
($50.000 ARS): 5 ventas ≈ **$250.000 ARS de ingreso** contra ~US$18 (~$22.000 ARS)
de costo. **Rentable desde la primera venta del mes.**

Punto de migración: recién a ~1.000 sesiones/mes conviene pasar la generación al
esquema híbrido (§6) antes que pagar infraestructura.

---

## 5. Medición — KPIs y tracking

Sin métricas, cada decisión es a ciegas. Implementación mínima sobre el Redis
existente (endpoint `/api/analytics`, `INCR funnel:{paso}:{fecha}`, ~20 líneas).

**Eventos del funnel:** `modal_open` → `registro` → `wizard_inicio` → `seccion_3`
→ `wizard_fin` → `preview_visto` → `pago_click` → `pago_confirmado`.

**KPIs de las primeras 4 semanas:**

| KPI | Objetivo | Si está por debajo… |
|---|---|---|
| Completitud del wizard | > 40% | problema de fricción UX (largo, preguntas) |
| Wizard → preview visto | > 90% | quedan bugs técnicos en la generación |
| Preview → clic en pago | > 10% | problema de precio/propuesta, no de código |
| Costo API / sesión | < US$0.45 | revisar caching y largo de conversaciones |

---

## 6. Roadmap de evolución

| Fase | Disparador | Cambio |
|---|---|---|
| **v1 (actual)** | — | Streaming SSE, budget guard completo, caching, carrusel con inventario |
| **v1.5** | primeras ventas | Preview gratuito con watermark + pago pre-generación + `/api/analytics` |
| **v2** | ~1.000 ses./mes o costo API > US$100/mes | Generación híbrida: el LLM genera solo el copy (JSON ~800 tokens) y el HTML se ensambla determinísticamente con los templates CSS existentes (`landing_page/templates/`). Costo ÷3.5, cero truncamiento, cero timeout |
| **v2.5** | demanda de recurrencia | Panel de cliente para pedir cambios (alimenta el tier Mantenimiento) |

---

## 7. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Abuso del preview gratuito | costo API sin revenue | rate limit 8/día por IP + budget guard por sesión + cache por rubro |
| Suba de precios de API | margen | migración a v2 híbrida (÷3.5) ya diseñada |
| Vercel Hobby cambia límites | downtime | el código ya streamea (inmune a timeouts cortos); alternativa: Cloudflare Pages Functions (free tier equivalente) |
| Dependencia del link MP manual | fricción de cobro | v1.5: webhook de MP para confirmar pago automáticamente (free) |
