# Plan de Testing E2E — Landing Page Service

## Ambiente de prueba

```bash
node mock-server.js   # http://localhost:3000
```

Antes de cada sesión de testing:
- Limpiar `localStorage`: DevTools → Application → Storage → "Clear site data"
- Estado conocido de `dsn/index.json`: vacío `[]` para flujos sin carrusel, con una entrada para flujos con carrusel
- `landing_page/data/clientes.json`: `[]` para evitar 409 inesperados

---

## Flujos principales (Happy Paths)

### Flujo A — Usuario nuevo, sin diseños previos

**Pre-condición:** `dsn/index.json = []`, email no registrado, `localStorage` limpio

| # | Acción | Resultado esperado |
|---|--------|--------------------|
| A1 | Abrir `http://localhost:3000/landing_page/` | Página carga; nav, hero y card de servicio visibles |
| A2 | Clic en "Empezar ahora →" | Modal se abre en **Paso 1** (Verificar); breadcrumb muestra "Verificar" activo |
| A3 | Seleccionar tipo "Negocio, servicio…"; pago = No; login = No; clic Continuar | Modal avanza al **Paso 2** (Tus datos); breadcrumb "Verificar" tachado, "Tus datos" activo |
| A4 | Completar nombre, apellido y email válidos | Botón "Empezar el chat" se habilita |
| A5 | Clic "Empezar el chat" | Botón muestra "Guardando…", luego modal avanza al **Paso 3** (Tu landing) en fullscreen; formulario se oculta con transición |
| A6 | Observar chat | Mensaje de saludo personalizado con el **nombre** ingresado |
| A7 | Escribir descripción del negocio y enviar | Indicador de typing aparece; Claude responde evaluando el proyecto |
| A8 | Observar respuesta de evaluación | Claude pregunta por más info o da OK; si da OK la fase cambia a ONBOARDING |
| A9 | Completar preguntas de onboarding (nombre marca, rubro, servicios, contacto) | Claude va recolectando; al tener brief completo muestra mensaje "Perfecto, tengo una idea clara…" |
| A10 | Observar transición a BRAND_DEFINITION | Botón 📎 aparece; Claude pregunta sobre identidad visual; input habilitado |
| A11 | Responder preguntas de identidad visual (colores, estilo, referencias) | Claude procesa; cuando tiene suficiente info muestra "Generando tus 3 diseños…" |
| A12 | Observar pantalla de generación | Indicador de progreso muestra "Generando diseño X de 3: [nombre]…" |
| A13 | Esperar fin de generación | 3 diseños en carrusel del chat; cada card tiene iframe con preview e iframe renderiza HTML |
| A14 | Clic en un diseño → "Elegir este diseño" | Sección de pago aparece con nombre de marca y template seleccionado; `MP_LINK` en el botón de MP |
| A15 | Clic "Ya pagué / Confirmar pago" | Botón deshabilitado, muestra "Enviando…"; mensaje del sistema "Enviando tu pedido a Martín…" |
| A16 | Observar sección de éxito | Sección success visible con nombre de marca y contacto; fase = DONE |

---

### Flujo B — Usuario nuevo, con diseños previos (selecciona del carrusel)

**Pre-condición:** `dsn/index.json` con una entrada válida (3 templates), email no registrado

| # | Acción | Resultado esperado |
|---|--------|--------------------|
| B1 | Pasos A1–A9 (llegar al final de ONBOARDING) | Igual que Flujo A |
| B2 | Observar transición post-onboarding | Chat muestra "¡Antes de generar nuevos diseños, revisemos los que ya existen!" + widget de carrusel |
| B3 | Navegar el carrusel con flechas | Indicador "1 / 3", "2 / 3", "3 / 3" actualiza correctamente; flecha anterior deshabilitada en índice 0 |
| B4 | Clic en iframe del diseño (fuera de "Elegir este") | Modal de preview se abre (90vw × 90vh) con el HTML del template |
| B5 | Clic en "Elegir este" en cualquier card | Chat muestra confirmación del diseño elegido; sección de pago aparece |
| B6 | Completar pago (A15–A16) | Flujo de pago igual que Flujo A |

---

### Flujo C — Usuario rechaza carrusel, genera diseños nuevos

**Pre-condición:** `dsn/index.json` con una entrada válida, email no registrado

| # | Acción | Resultado esperado |
|---|--------|--------------------|
| C1 | Pasos A1–A9, luego B2 | Carrusel de diseños previos visible |
| C2 | Clic "No me gusta ninguno →" | Chat muestra "Vamos a crear algo completamente nuevo"; transición a BRAND_DEFINITION |
| C3 | Completar preguntas de marca | Igual que A11–A16 |

---

### Flujo D — Usuario con sesión activa (regreso)

**Pre-condición:** `localStorage` tiene sesión válida (`mdlp_session` con id, nombre, phase=en_chat, `savedAt` < 48h)

| # | Acción | Resultado esperado |
|---|--------|--------------------|
| D1 | Abrir la página | Página carga normalmente |
| D2 | Clic "Empezar ahora →" | Modal abre **directamente en Paso 3** (salta formulario), muestra el chat |
| D3 | Observar chat | Saludo con el nombre guardado en sesión; input habilitado |

---

## Casos de borde — Paso 1 (Pre-calificación)

| ID | Escenario | Resultado esperado |
|----|-----------|-------------------|
| P1-1 | Seleccionar "Tienda online con carrito" como tipo | Al continuar: panel de rechazo visible con mensaje explicativo; botón "Continuar" no avanza al paso 2 |
| P1-2 | Seleccionar "App o sistema con login" como tipo | Igual que P1-1 |
| P1-3 | Seleccionar pago = Sí | Panel de rechazo por e-commerce |
| P1-4 | Seleccionar login = Sí | Panel de rechazo por login |
| P1-5 | No seleccionar ningún campo y clic Continuar | Errores de validación en campos requeridos; no avanza |
| P1-6 | Cerrar modal con botón X | Modal se cierra; overlay desaparece; body scroll restaurado |
| P1-7 | Cerrar modal con tecla ESC | Igual que P1-6 |
| P1-8 | Clic en overlay (fondo oscuro) | Modal se cierra |

---

## Casos de borde — Paso 2 (Registro)

| ID | Escenario | Pre-condición | Resultado esperado |
|----|-----------|---------------|--------------------|
| R1 | Email ya registrado con estado `en_chat` | Email en `clientes.json` con `estado: 'en_chat'` | Sesión restaurada; avanza al chat como si fuera primera vez |
| R2 | Email ya registrado con estado `pagado` | Email con `estado: 'pagado'` | Error en campo email con mensaje informativo "tu landing está en proceso"; no avanza |
| R3 | Email ya registrado con estado `generado` | Email con `estado: 'generado'` | Mensaje: "ya generaste tus diseños, escribime a…"; no avanza |
| R4 | Nombre menor a 2 caracteres | — | Error "Mínimo 2 caracteres" en campo nombre; no envía |
| R5 | Apellido menor a 2 caracteres | — | Error en campo apellido |
| R6 | Email con formato inválido (sin @) | — | Error "Revisá el formato del email"; botón deshabilitado |
| R7 | API `save-client` falla (simular timeout) | Detener mock server durante submit | Advertencia en consola; flujo continúa igual (fallthrough); usuario llega al chat |
| R8 | ESC en paso 2 | — | Modal se cierra |
| R9 | Clic en overlay en paso 2 | — | Modal se cierra |
| R10 | Clic en overlay en paso 3 | — | Modal NO se cierra (en fullscreen, overlay no está activo) |

---

## Casos de borde — Chat (fases)

| ID | Escenario | Resultado esperado |
|----|-----------|-------------------|
| C1 | Primera respuesta del usuario desencadena EVALUATING | `state.phase` cambia de GREETING a EVALUATING en el primer mensaje |
| C2 | Proyecto inviable (Claude evalúa con `siguiente_accion: 'rechazar'`) | Claude responde con rechazo; input se deshabilita; no avanza a ONBOARDING |
| C3 | Claude responde sin JSON en EVALUATING (texto libre) | Texto se muestra como burbuja AI; input sigue habilitado; fase permanece en EVALUATING |
| C4 | Enviar mensaje vacío | Botón no hace nada (guard en `handleSend`) |
| C5 | Tecla Enter envía mensaje | Mismo comportamiento que clic "Enviar" |
| C6 | Shift+Enter en textarea | Salto de línea en el input; no envía |
| C7 | Mensaje durante GENERATING | Input deshabilitado; texto no se procesa |
| C8 | Mensaje durante CAROUSEL_REVIEW | Input deshabilitado; texto no se procesa |
| C9 | Mensaje durante PAYMENT | Input deshabilitado |
| C10 | Mensaje durante DONE | Input deshabilitado |
| C11 | Límite de rate (Claude API 429) | Mensaje de sistema con texto de rate limit; input re-habilitado |
| C12 | Error de conexión durante ONBOARDING | Mensaje "error de conexión, intentá de nuevo"; input re-habilitado |
| C13 | Error de generación | Mensaje de error; `state.phase` vuelve a BRAND_DEFINITION; input habilitado |
| C14 | Error en notify | Botón muestra "Reintentar"; email alternativo mencionado en mensaje |

---

## Casos de borde — Upload de archivos

| ID | Escenario | Resultado esperado |
|----|-----------|-------------------|
| U1 | Adjuntar 1 archivo en BRAND_DEFINITION | Chip "pendiente" visible; al enviar mensaje → sube el archivo; chip cambia a "subido" |
| U2 | Adjuntar 5 archivos (límite exacto) | Los 5 chips aparecen |
| U3 | Intentar adjuntar 6 archivos | Mensaje de sistema "máximo 5 archivos"; 6to archivo no se agrega |
| U4 | Adjuntar archivos sumando > 10 MB | Mensaje de sistema "no puede superar 10 MB" |
| U5 | Quitar archivo pendiente con botón × | Chip desaparece; lista de pendientes actualiza |
| U6 | `upload-file` API falla | Mensaje "No pude subir los archivos. Continuamos sin ellos."; chat sigue funcionando |
| U7 | Botón 📎 no visible en fases previas a BRAND_DEFINITION | `attach-btn` tiene `hidden` hasta `enterBrandDefinitionPhase()` |

---

## Casos de borde — Carrusel (dsn/template/)

| ID | Escenario | Resultado esperado |
|----|-----------|-------------------|
| CV1 | `loadDsnIndex` fetchea `index.json` con `file` paths | HTTP GET a `/landing_page/dsn/template/dsn-001-template-1.html` visible en Network tab; `tpl.html` poblado |
| CV2 | Archivo de template no existe (404) | `tpl.html` queda undefined/vacío; iframe vacío pero sin crash |
| CV3 | Modal de preview: zoom con rueda del mouse | Zoom entre 0.5× y 3× |
| CV4 | Modal de preview: doble clic | Reset a 100% |
| CV5 | Clic "Elegir este diseño" dentro del modal | Modal se cierra; preview seleccionado; sección de pago aparece |
| CV6 | `save-dsn` al generar nuevos diseños | `dsn/template/dsn-002-template-1.html` creado; `index.json` actualizado con `file` path |

---

## Validación de contratos API (con mock)

### `/api/validate-email`
- **Request:** `POST { email }`
- **Mock response:** `{ deliverable: true, disposable: false }`
- **Verificar:** nunca bloquea el flujo (fail-open)

### `/api/save-client`
- **Request create:** `POST { action: 'create', client: { id, nombre, apellido, email, ... } }`
- **Respuesta 200:** `{}` → flujo continúa
- **Respuesta 409 `en_chat`:** `{ error: 'email_exists', estado: 'en_chat', nombre, id }` → sesión restaurada, flujo continúa
- **Respuesta 409 estado terminal:** mensaje informativo, no avanza
- **Respuesta 500 / sin respuesta:** catch → flujo continúa de todas formas

### `/api/claude`
- **EVALUATING:** `{ content: [{ text: '```json\n{ "siguiente_accion": "onboarding", "respuesta_cliente": "..." }\n```' }] }`
- **ONBOARDING:** debe incluir JSON con `nombre_marca`, `rubro`, `servicios[]`, `contacto`
- **BRAND_DEFINITION:** debe incluir JSON con `colores_principales[]`, `estilo_visual`
- **GENERATING:** HTML completo con DOCTYPE y estilos inline

### `/api/save-dsn`
- **Request:** `POST { rubro, clienteId, templates: [{ id, name, html }] }`
- **Mock escribe:** `dsn/template/{setId}-template-N.html`; actualiza `index.json` con `file` paths (sin `html` inline)
- **Respuesta:** `{ success: true, id: 'dsn-00N' }`

### `/api/notify`
- **Request:** `POST { brief, templateHtml, cliente }`
- **Verificar en consola mock:** log del brief con nombre_marca, rubro, template_nombre y contacto

### `/api/upload-file`
- **Request:** `POST { clientId, files: [{ name, content (base64), size, type }] }`
- **Respuesta:** `{ uploaded: [{ name, path, size }] }`

---

## Checklist de regresión rápida (smoke test)

Ejecutar antes de cada deploy o PR merge:

- [ ] Página carga sin errores de consola
- [ ] Modal abre al clic "Empezar ahora"
- [ ] Paso 1: proyecto válido avanza al paso 2
- [ ] Paso 1: e-commerce/login muestra rechazo
- [ ] Paso 2: formulario habilita botón con nombre + apellido + email
- [ ] Paso 2: avanza al chat (paso 3) tras envío exitoso
- [ ] Chat: saludo con nombre del usuario
- [ ] Chat: primera respuesta de Claude (EVALUATING)
- [ ] Chat: brief completo dispara transición (ONBOARDING → startBrandOrCarouselFlow)
- [ ] `dsn/template/dsn-001-template-1.html` se carga en el carrusel (Network tab: 200)
- [ ] Iframes de templates renderizan HTML distinto en cada card
- [ ] Botón 📎 aparece solo en BRAND_DEFINITION
- [ ] Generación muestra progreso y 3 diseños
- [ ] Selección de diseño muestra sección de pago con nombre y template correctos
- [ ] Confirmación de pago → sección de éxito
- [ ] Recargar página con sesión activa → modal va al paso 3 directamente
- [ ] `localStorage` limpio → modal va al paso 1

---

## Herramientas recomendadas

| Herramienta | Uso |
|-------------|-----|
| Chrome DevTools → Network | Verificar requests a `/api/*` y a `dsn/template/*.html` |
| DevTools → Application → localStorage | Inspeccionar y limpiar `mdlp_session` |
| DevTools → Console | Detectar errores JS y logs del mock |
| Mock server console | Ver logs de cada API call con contexto |
| `clientes.json` | Verificar persistencia de registros |
| `dsn/index.json` | Verificar estructura post save-dsn |
| `dsn/template/` | Verificar que se crean los archivos HTML |
