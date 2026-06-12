# Informe E2E — Auditoría de Usabilidad y Componentes

**Proyecto:** Landing Page Service — `ia-landing-page-flax.vercel.app/landing_page/`
**Tipo:** Prueba E2E de 10 casos de uso + regresión + seguridad + smoke de producción
**Fecha:** 12 de junio de 2026
**Entorno:** Híbrido — 10 UC + regresión contra `localhost:3000` (mock-server con contrato idéntico a prod); validación de IA/persistencia/timeout reales contra producción.
**Stack:** 100% free tier (Vercel Hobby + Upstash Redis Free + Supabase Free + Anthropic API).

---

## 1. Resumen ejecutivo

| Indicador | Resultado |
|---|---|
| **Casos de uso E2E (10 UC)** | ✅ 10/10 PASS |
| **Regresión E2E (flujos 1-6)** | ✅ 30/30 PASS |
| **Suite E2E total** | ✅ **40/40 PASS** (baseline era 13/40) |
| **Unit/integration (Jest)** | ✅ 162/162 PASS |
| **Seguridad (acotada)** | ✅ 4/4 PASS |
| **Smoke generación producción** | ✅ PASS (tras fix de timeout) |
| **Bugs detectados y resueltos** | 🐞 5 (1 crítico de generación + 1 de deploy) |
| **Costo API de todo el ciclo** | ~US$0.10 |
| **Deploy a producción** | ✅ Ready y validado (generación real 32.2s, HTML completo) |
| **Estado de la aplicación** | 🟢 Estable — flujo onboarding→venta completo y verde |

La regla de gating se respetó: **no se avanzó de caso de uso sin cumplir su objetivo**, y ante cada bug se aplicó el fix y se re-corrió la suite completa antes de continuar. La progresión de métricas fue **13/40 → 37/40 → 40/40**.

---

## 2. Objetivos de la prueba

1. Validar el flujo completo **onboarding → venta de la landing** desde la óptica del usuario final.
2. Detectar errores de usabilidad y de componentes (carrusel, chat, transiciones, inputs).
3. Cubrir 10 casos de uso de **cobertura diferenciada** (no repetir el happy path).
4. Verificar persistencia real (Redis) y datos de negocio (Supabase).
5. Probar resistencia a abuso (ráfaga/DoS acotado, aislamiento de sesión, inyección).
6. Dejar instrumentado un **dashboard de monitoreo técnico + financiero**.

---

## 3. Descripción de los 10 casos de uso

Cada UC ejercita un ángulo distinto del producto. Spec: [e2e/10-casos-de-uso-auditoria.spec.js](../e2e/10-casos-de-uso-auditoria.spec.js).

| UC | Nombre | Qué valida | Resultado |
|---|---|---|---|
| **UC-01** | Onboarding + encuadre | Pre-cal → registro → saludo con expectativa de duración; input habilitado, wizard no arrancado | ✅ |
| **UC-02** | Redirección comercial | Pedido de e-commerce → "seguir conversando" sin cerrar la puerta (no rechaza) | ✅ |
| **UC-03** | Rechazo por contenido ilegal | Único caso de rechazo definitivo; input bloqueado tras el cierre cordial | ✅ |
| **UC-04** | Wizard completo (6 secciones) | Recolección completa → handoff visual al "Equipo de Diseño" + progress bar | ✅ |
| **UC-05** | Skip de sección opcional | Testimonios salteable con botón; salta a Contacto sin preguntar | ✅ |
| **UC-06** | Recuperación de sesión | Reload a mitad del wizard → historial **repintado** desde Redis + retoma fase | ✅ |
| **UC-07** | Carrusel DSN (venta $0) | Diseños anteriores → elegir uno → pago directo sin generación (margen 100%) | ✅ |
| **UC-08** | DSN sin lockout | En revisión de diseños previos, texto libre NO queda bloqueado y genera nuevos | ✅ |
| **UC-09** | Venta completa | Generación SSE con skeletons → selección → pago → **éxito** (objetivo final) | ✅ |
| **UC-10a** | Resiliencia de red | Caída del LLM → auto-retry recupera el flujo solo | ✅ |
| **UC-10b** | Anti-XSS + límite input | Payload `<script>` se renderiza como texto; contador respeta 600 chars | ✅ |

---

## 4. Bugs detectados y resueltos durante el testing

> Se trabajó en paralelo: cada bug detectado se diagnosticó, corrigió y re-validó antes de avanzar.

### 🔴 BUG-1 (CRÍTICO, producción) — La generación moría a los 60s por timeout de pared
- **Detección:** smoke directo contra `/api/claude` (intent=generation) en producción.
- **Síntoma:** el HTML llegaba por SSE pero se cortaba a los **60.4s exactos** (= `maxDuration` de Vercel Hobby), sin `</html>` ni evento `done`. 13.637 caracteres incompletos.
- **Causa raíz:** Sonnet genera a ~59 tokens/s. Con `max_tokens: 8192`, una landing completa tarda >60s y choca contra el techo de ejecución. El fix previo de subir `max_tokens` resolvió el truncamiento *por tokens* pero destapó el límite *por tiempo*.
- **Fix:** `max_tokens` 8192 → **3200** (techo de seguridad: 3200 × 59 tok/s ≈ 54s < 60s) + presupuesto de tamaño compacto en [generacion.txt](../landing_page/prompts/generacion.txt) (130-170 líneas, prioridad de cerrar `</html>`).
- **Validación post-fix (producción):** ✅ 38.8s, HTML 6903 chars, cierra `</html>`, `stop_reason: end_turn`, sin truncar.

### 🟠 BUG-2 (UX, producción) — Mensajes fuera de orden por el saludo con typing
- **Detección:** UC-02/03 — el mensaje del usuario se procesaba *antes* de que apareciera el saludo.
- **Causa raíz:** el saludo se renderiza con `showTyping() + sleep(900ms)`, pero el input quedaba **habilitado** durante esos 900ms; un mensaje rápido se respondía antes que el saludo.
- **Fix:** [chat.js](../landing_page/chat.js) — bloquear el input durante el typing del saludo y rehabilitarlo al terminar.

### 🟠 BUG-3 (UX, producción) — Ventana muerta de input tras el registro
- **Causa raíz:** `setupEventListeners()` se llamaba *después* del `await` del saludo (~900ms), dejando el input sin listeners en ese lapso.
- **Fix:** registrar los listeners **antes** del saludo.

### 🟡 BUG-4 (lógica) — El rechazo re-habilitaba el input
- **Causa raíz:** el `finally` de `handleSend` rehabilitaba el input incluso tras un `rechazar`.
- **Fix:** setear `state.phase = DONE` en la rama de rechazo para que el `finally` no lo reactive.

### 🟠 BUG-5 (deploy) — El deploy fallaba por el límite de 12 funciones de Vercel Hobby
- **Detección:** tras el push, el deploy quedaba en estado **Error** (build OK, fallo en "Deploying outputs"); producción seguía sirviendo la versión anterior.
- **Causa raíz:** el plan Hobby permite **máximo 12 Serverless Functions**. Las 2 nuevas (`track.js` + `metrics.js`) llevaban el total de 11 a 13.
- **Fix:** fusionar ambas en **`api/analytics.js`** (POST = registrar evento, GET = métricas con `ADMIN_TOKEN`) → total 12, dentro del límite. Deploy posterior: ✅ Ready, `/api/analytics` validado en prod (POST→200, GET sin token→401).

*(Adicional: se actualizaron las fixtures de los specs 01 y 04, que asumían el contrato viejo de prompts y el sembrado de diseños en disco; ahora siembran vía el mismo data path que producción.)*

---

## 5. Evidencia de bases de datos

### Upstash Redis (persistencia de sesión) — ✅ funcionando
Consulta en vivo sobre una sesión real:

| Clave | Valor | Lectura |
|---|---|---|
| `session:<id>:cost` | `0.01254` USD | Cost-tracking de tokens operativo |
| `session:<id>:cost` TTL | `132990` s (~37 h) | Dentro de la ventana de 48h |
| `session:<id>:messages` (LLEN) | `16` mensajes | Historial persistido correctamente |
| `DBSIZE` | 3 claves activas | Free tier holgado (500K cmd/mes) |

**Conclusión:** la persistencia de historial —que antes aparecía vacía al recuperar sesión— está confirmada en Redis y se repinta correctamente (UC-06).

### Supabase Postgres (diseños y clientes) — ⚠️ vacío (esperado)

| Tabla | Conteo | Interpretación |
|---|---|---|
| `design_sets` | `0` | Ningún flujo con generación real completó en prod **antes** de este fix |
| `clients` | `0` | Sin registros productivos (beta sin tráfico real) |

**Interpretación:** confirma el diagnóstico original — la generación nunca completaba en producción (bug del rate limit 2-vs-3 + timeout). Con BUG-1 resuelto, `design_sets` se poblará en la primera venta real y alimentará el carrusel DSN (UC-07).

---

## 6. Seguridad (acotada — beta, free tier)

Script: [e2e/security-checks.mjs](../e2e/security-checks.mjs). Complementa los 162 unit tests de `__tests__/security/`.

| Check | Descripción | Resultado |
|---|---|---|
| **S1** | Aislamiento de sesión: `get-session` con UUID ajeno no filtra datos | ✅ `found:false` |
| **S2** | Resiliencia a ráfaga local: 60 requests concurrentes | ✅ 60 OK, 0 caídas |
| **S3** | Inyección por payload (`intent`/`type` malformados) no crashea | ✅ sin 5xx |
| **S4** | [PROD] ráfaga controlada (25 req): el servicio sigue en pie | ✅ 0×5xx, 0×429 |

**Cubierto adicionalmente por unit tests (162 verdes):** forja de JWT (`alg:none`, swap de acción, token de otra sesión), spoofing de `X-Forwarded-For` para evadir rate limit, inyección de prompt, TOCTOU en tokens one-time-use, y el budget guard (402 al superar el límite de costo por sesión).

**Nota:** el rate limit real de generación (`8/día por IP`) + el budget guard por sesión (`$4000 ARS`) actúan como cortafuegos de abuso/costo. No se ejecutó DoS de alto volumen contra producción (viola ToS de Vercel y quema el free tier); la validación de carga real se hizo contra localhost.

---

## 7. Saturación del servicio y límites del free tier

| Recurso | Free tier | Uso observado | Margen |
|---|---|---|---|
| Vercel funciones | 100 GB-hrs/mes | despreciable (beta) | ✅ amplio |
| **Vercel `maxDuration`** | **60s (Hobby)** | generación ~39-54s tras fix | ⚠️ ajustado — ver §9 |
| Upstash Redis | 500K cmd/mes | 3 claves activas | ✅ amplio |
| Supabase | 500 MB | ~0 MB | ✅ amplio |
| Anthropic API | pago por uso | ~US$0.39/sesión completa | controlado por budget guard |

**Punto de atención:** la generación quedó a ~39-54s contra un techo de 60s. Es el recurso más ajustado. Mitigación inmediata aplicada (output compacto); mitigaciones futuras en §9.

---

## 8. Dashboard de monitoreo (técnico + financiero)

Entregado y listo para deploy:
- **[api/analytics.js](../api/analytics.js)** — registra eventos de funnel en Redis (`INCR funnel:{paso}:{fecha}`) + rubros (`biz:rubro:*`). Fire-and-forget, costo $0. Cableado en [chat.js](../landing_page/chat.js) y [modal.js](../landing_page/modal.js).
- **[api/analytics.js](../api/analytics.js)** — agrega funnel (7 días), KPIs, rubros y templates top, costo API acumulado, sesiones activas y diseños guardados. Protegido con `ADMIN_TOKEN`.
- **[admin/dashboard.html](../admin/dashboard.html)** — panel con login por token, refresco cada 60s.

**KPIs financieros incluidos:** ventas (7d), costo API total, **costo por venta**, completitud del wizard, conversión preview→pago, cierre de ventas. **KPIs de uso:** sesiones activas, rubros más solicitados, templates más usados, embudo completo `modal_open → … → pago_confirmado`.

> **Acción requerida:** definir `ADMIN_TOKEN` en las env vars de Vercel para activar el dashboard.

---

## 9. Mejoras recomendadas (próximas)

| Prioridad | Mejora | Motivo |
|---|---|---|
| 🔴 Alta | **Activar Fluid Compute en Vercel** (gratis) | Sube `maxDuration` a 300s → permite diseños más ricos sin riesgo de corte. Hoy el margen es ajustado. |
| 🔴 Alta | **Generación híbrida (v2)** | El LLM genera solo el copy (JSON ~800 tokens, ~15s); el HTML se ensambla con los templates CSS existentes. Elimina de raíz el timeout y el truncamiento, y reduce el costo ÷3.5. |
| 🟠 Media | Pago **antes** de generar las 3 (preview gratis con watermark) | Alinea costo de API con revenue confirmado (ver [plan-de-negocio.md](plan-de-negocio.md)). |
| 🟠 Media | Reemplazar el `confirm()` nativo de recuperación por tarjeta inline | Consistencia visual del producto. |
| 🟡 Baja | Monitorear longitud media de conversación vía dashboard | Con prompts reales, secciones con respuestas ambiguas pueden requerir más turnos (observado en el smoke conversacional). El gating funciona; conviene vigilar el costo por sesión. |

---

## 10. Costos del testing

| Concepto | Detalle | Costo API |
|---|---|---|
| 10 UC + regresión (40 tests × 3 rondas) | contra mock-server (LLM simulado) | **US$0** |
| Unit/integration (162 tests) | mockeado | **US$0** |
| Seguridad S1-S3 | local | **US$0** |
| Seguridad S4 | 25 llamadas chat a prod | ~US$0.01 |
| Smoke generación prod | 2 generaciones Sonnet (8192 + 3200) | ~US$0.08 |
| Smoke conversacional prod | 7 llamadas Haiku | ~US$0.01 |
| **Total del ciclo completo** | | **≈ US$0.10** |

El enfoque híbrido (mock para volumen, API real solo para validar IA/persistencia/timeout) mantuvo el costo en centavos pese a 3 rondas completas de re-ejecución.

---

## 11. Estado final de la aplicación

🟢 **ESTABLE.** El flujo completo onboarding → wizard → generación → selección → pago → éxito está verde en E2E (40/40), con la generación validada en producción tras resolver el timeout de pared. Persistencia confirmada en Redis. Seguridad acotada sin hallazgos. Dashboard de monitoreo entregado.

**Posibles problemas remanentes (vigilar):**
1. Margen ajustado de `maxDuration` (39-54s vs 60s) → mitigar con Fluid Compute o generación híbrida.
2. `design_sets` se poblará recién con la primera venta real; el carrusel DSN estará vacío hasta entonces (comportamiento ya manejado: genera directo).
3. Longitud de conversación con prompts reales: monitorear costo/sesión vía dashboard.

**Artefactos de testing entregados:**
- [e2e/10-casos-de-uso-auditoria.spec.js](../e2e/10-casos-de-uso-auditoria.spec.js) — los 10 UC
- [e2e/security-checks.mjs](../e2e/security-checks.mjs) — seguridad acotada
- [e2e/smoke-generation-prod.mjs](../e2e/smoke-generation-prod.mjs) — smoke del fix de generación
- [api/analytics.js](../api/analytics.js) · [api/analytics.js](../api/analytics.js) · [admin/dashboard.html](../admin/dashboard.html) — monitoreo
