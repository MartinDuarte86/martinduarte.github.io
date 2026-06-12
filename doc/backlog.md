# Backlog — Servicio de Landing Pages

Tareas e ideas a futuro. No están en alcance del MVP actual; se priorizan según
tracción y feedback. Estado de hoy (12-jun-2026): MVP estable, flujo
onboarding→venta verde y deployado.

---

## 🟢 Producto / Monetización

### B-01 · Upsell de servicios complementarios en la fase post-diseño
**Idea:** aprovechar el momento de mayor intención de compra —cuando el usuario ya
vio/eligió su diseño y está por pagar— para ofrecer **servicios adicionales** que
completan el lanzamiento de la marca. Es revenue incremental con costo marginal
casi nulo y sube el ticket promedio.

**Punto del flujo:** justo en (o después de) la pantalla de generación/selección
de diseño, antes o junto al pago. Hoy ahí solo está el link de MercadoPago del
diseño; se puede agregar un bloque "¿Querés que también nos encarguemos de…?".

**Catálogo inicial de add-ons (ejemplos):**

| Servicio | Precio (ARS) | Notas |
|---|---|---|
| **Trámite de generación de dominio** | **$30.000** | Registro y configuración del dominio propio (.com / .com.ar) — primer ejemplo definido |
| Publicación + hosting gestionado | a definir | Subir la landing a producción con dominio propio |
| Conexión de email profesional | a definir | `hola@tudominio.com` |
| Carga de contenido real / fotos | a definir | Reemplazar placeholders por material del cliente |
| Mantenimiento mensual | $8.000–12.000/mes | Ya contemplado como tier recurrente en el plan de negocio |

**Consideraciones de implementación (cuando se priorice):**
- Cada add-on seleccionado se suma al pedido y se notifica a Martín junto con el brief.
- Puede ser un set de checkboxes/cards en la sección de pago (`showPaymentSection`)
  que ajuste el total y el mensaje de la notificación (`sendNotification`).
- Tracking: agregar un evento de funnel (p. ej. `addon_seleccionado`) en
  `/api/analytics` para medir adopción por tipo de servicio en el dashboard.
- Mantiene el stack free: no requiere infraestructura nueva, solo UI + el dato en
  la notificación/brief.

**Por qué importa:** convierte una venta de un solo producto (la landing) en un
**bundle de lanzamiento de marca**, que es justo lo que el cliente necesita y no
sabe pedir. Alineado con la lógica de cross-sell de la evaluación inicial
(`evaluacion.txt`), que ya redirige pedidos hacia otros servicios.

---

## 🔵 Técnico

### B-02 · Generación híbrida v2 (diseños más ricos sin riesgo de timeout)
**Idea:** que el LLM genere **solo el copy** (JSON ~800 tokens, ~15s) y el HTML se
ensamble determinísticamente en el cliente con las plantillas CSS que ya existen
en `landing_page/templates/`.

**Motivación:** hoy la generación va compacta (`max_tokens` 3200, ~35s por diseño)
para entrar holgada en el presupuesto de tiempo. Si en el futuro se quieren
diseños más elaborados, subir `max_tokens` cuesta UX (cada diseño pasaría a
~70-85s, y son 3 secuenciales). La generación híbrida elimina el problema de raíz:
- Costo de generación ÷3.5 (solo copy, sin HTML).
- Cero truncamiento y cero timeout (el ensamblado es instantáneo y local).
- Diseños visualmente consistentes (plantillas curadas) y más ricos.

**Estado:** la infraestructura base ya existe (8 plantillas CSS en
`landing_page/templates/`). Falta el contrato de copy por sección y el ensamblador
en el cliente.

**Disparador sugerido:** ~1.000 sesiones/mes o costo API > US$100/mes, o demanda
de diseños más elaborados (lo que llegue primero).

*(Nota: Fluid Compute ya está activo y `maxDuration` en 120s, así que el timeout
dejó de ser un riesgo inmediato; este ítem es para riqueza visual + costo, no
urgencia.)*
