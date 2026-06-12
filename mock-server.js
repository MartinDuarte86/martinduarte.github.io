/**
 * Servidor mock local para la webapp de landing pages.
 * No consume tokens de Anthropic ni APIs externas.
 * Uso: node mock-server.js  →  abre http://localhost:3000/landing_page/
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

// ─── Carga de .env (sin dependencias) ─────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnv();

const PORT        = 3000;
const STATIC_ROOT = __dirname;

// ─── Proveedor de LLM para pruebas locales ────────────────────────────────────
// Por defecto el mock no consume ninguna API real. Si se define
// LLM_PROVIDER=openrouter (en .env) las llamadas a /api/claude se redirigen a
// OpenRouter usando un modelo gratuito (DeepSeek o NVIDIA) — útil para probar
// la interacción real mientras el flujo se termina de afinar, sin tocar el
// stack de Anthropic que sigue siendo el usado en producción (api/claude.js).
const LLM_PROVIDER = (process.env.LLM_PROVIDER || 'mock').toLowerCase();

const OPENROUTER_FREE_MODELS = {
  'nvidia/nemotron-nano-9b-v2:free':           true,
  'nvidia/nemotron-3-nano-30b-a3b:free':       true,
  'nvidia/nemotron-3-super-120b-a12b:free':    true,
  'deepseek/deepseek-chat-v3-0324:free':       true, // dejar por si OpenRouter vuelve a ofrecerlo gratis
  'deepseek/deepseek-r1:free':                 true,
};
const OPENROUTER_DEFAULT_MODEL = 'nvidia/nemotron-nano-9b-v2:free';
const OPENROUTER_MODEL = OPENROUTER_FREE_MODELS[process.env.OPENROUTER_MODEL]
  ? process.env.OPENROUTER_MODEL
  : OPENROUTER_DEFAULT_MODEL;

// Convierte el formato de mensajes estilo Anthropic ({system, messages, max_tokens})
// que usa el front (callClaude en chat.js / generator.js) al formato OpenAI-compatible
// de OpenRouter, y devuelve la respuesta ya traducida a {content: [{text}]} para que
// el front no necesite ningún cambio.
async function callOpenRouter(body) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('Falta OPENROUTER_API_KEY en .env');
  }

  const { system, messages = [], max_tokens = 1024 } = body;
  const orMessages = [];
  if (system) orMessages.push({ role: 'system', content: system });
  for (const m of messages) orMessages.push({ role: m.role, content: m.content });

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer':  'http://localhost:3000',
      'X-Title':       'MarcaPersonal Web - prueba local OpenRouter',
    },
    body: JSON.stringify({
      model:      OPENROUTER_MODEL,
      max_tokens: Math.min(Number(max_tokens) || 1024, 4096),
      messages:   orMessages,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('  [openrouter] error:', data?.error || data);
    throw new Error(data?.error?.message || `OpenRouter respondió ${response.status}`);
  }

  return { content: [{ text: data.choices?.[0]?.message?.content || '' }] };
}

// ─── MIME types ───────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

// ─── Respuestas mock de Claude ────────────────────────────────────────────────
// Simula el flujo completo: evaluación → onboarding (2 turnos) → brief completo

function mockClaudeResponse(body) {
  // Routing por body.section (lo envía chat.js en cada llamada) en lugar de
  // sniffear strings del system prompt — sobrevive a reescrituras de prompts.
  const { section, messages } = body;
  const userMessages = (messages || []).filter(m => m.role === 'user');
  const turn = userMessages.length;
  const lastUser = String(userMessages[userMessages.length - 1]?.content || '').toLowerCase();

  // — Evaluación: contrato nuevo = JSON crudo, sin fences ni texto extra
  if (section === 'evaluating') {
    // Casos determinísticos para testear los 3 caminos de la máquina de decisión
    if (/ilegal|sin receta|falsificad/.test(lastUser)) {
      return { content: [{ text: JSON.stringify({
        aplica: false, motivo: 'contenido ilegal',
        respuesta_cliente: 'Gracias por escribir, pero no trabajamos con ese tipo de contenido. ¡Éxitos con tu proyecto!',
        siguiente_accion: 'rechazar',
      }) }] };
    }
    if (/tienda online|e-?commerce|pago online|carrito/.test(lastUser)) {
      return { content: [{ text: JSON.stringify({
        aplica: false, motivo: 'necesita e-commerce, redirigir',
        respuesta_cliente: 'Eso es más que una landing — es una tienda online, y también la hacemos. ¿Cuántos productos venderías?',
        siguiente_accion: 'seguir_conversando',
      }) }] };
    }
    return { content: [{ text: JSON.stringify({
      aplica: true, motivo: 'producto claro, solo mostrar y recibir contactos',
      respuesta_cliente: 'Tu proyecto aplica muy bien para una landing page. Vamos a armar todo paso a paso — arranquemos.',
      siguiente_accion: 'onboarding',
    }) }] };
  }

  // — Sección Hero
  if (section === 'hero') {
    if (turn < 2) {
      return { content: [{ text: '¿Cómo se llama tu marca y a qué rubro pertenece?' }] };
    }
    return {
      content: [{
        text: 'Buenísimo, con eso ya tengo el Hero.\n\n```json\n' + JSON.stringify({
          seccion: 'hero',
          nombre_marca: 'Demo Marca Local',
          rubro: 'peluquería',
          slogan: 'Tu mejor versión, a un corte de distancia',
          propuesta_valor: 'Cortes y tratamientos de peluquería a domicilio, con productos premium y atención personalizada.',
        }) + '\n```',
      }],
    };
  }

  // — Sección Sobre mí / Nosotros
  if (section === 'sobre_mi') {
    if (turn < 2) {
      return { content: [{ text: '¿Tu emprendimiento es personal o es una empresa/equipo?' }] };
    }
    return {
      content: [{
        text: 'Genial, con esto alcanza para esta sección.\n\n```json\n' + JSON.stringify({
          seccion: 'sobre_mi',
          tipo: 'personal',
          historia: 'Empecé haciendo cortes a domicilio para amigas y se fue corriendo la voz hasta que se convirtió en mi trabajo de tiempo completo.',
          experiencia_o_equipo: 'Más de 6 años de experiencia en peluquería y tratamientos capilares.',
          diferencial: 'Atención 100% personalizada, productos de calidad y horarios flexibles.',
        }) + '\n```',
      }],
    };
  }

  // — Sección Servicios
  if (section === 'servicios') {
    if (turn < 2) {
      return { content: [{ text: '¿Qué servicios ofrecés? Contame también una breve descripción de cada uno.' }] };
    }
    return {
      content: [{
        text: 'Con esos servicios ya armamos la sección.\n\n```json\n' + JSON.stringify({
          seccion: 'servicios',
          servicios: [
            { nombre: 'Corte y peinado', descripcion: 'Cortes a medida y peinados para cualquier ocasión.' },
            { nombre: 'Coloración', descripcion: 'Tinturas y mechas con productos profesionales.' },
            { nombre: 'Tratamientos capilares', descripcion: 'Hidratación y reparación profunda para tu cabello.' },
          ],
          precio_visible: false,
          precios: [],
        }) + '\n```',
      }],
    };
  }

  // — Sección Testimonios
  if (section === 'testimonios') {
    if (turn < 2) {
      return { content: [{ text: '¿Querés incluir una sección de testimonios de clientes en tu landing?' }] };
    }
    return {
      content: [{
        text: 'Te armé algunos testimonios verosímiles que podés reemplazar después por reales.\n\n```json\n' + JSON.stringify({
          seccion: 'testimonios',
          incluir: true,
          testimonios: [
            { nombre: 'Lucía Fernández', cargo_o_rubro: 'clienta frecuente', texto: 'Hace dos años que solo me corto el pelo con ella, siempre quedo encantada.' },
            { nombre: 'Marina Sosa', cargo_o_rubro: 'clienta', texto: 'La atención a domicilio me cambió la rutina, súper recomendable.' },
            { nombre: 'Carla Gómez', cargo_o_rubro: 'clienta', texto: 'Profesional, puntual y con productos de primera calidad.' },
          ],
          son_reales: false,
        }) + '\n```',
      }],
    };
  }

  // — Sección Contacto
  if (section === 'contacto') {
    if (turn < 2) {
      return { content: [{ text: '¿Cuál es tu WhatsApp y tus redes sociales?' }] };
    }
    return {
      content: [{
        text: 'Con el WhatsApp ya armamos el botón de contacto.\n\n```json\n' + JSON.stringify({
          seccion: 'contacto',
          contacto_wsp: '1123456789',
          email: '',
          redes: { instagram: 'demo.marca', linkedin: '', facebook: '' },
          zona: 'Zona norte del GBA',
          horarios: 'Lunes a sábados de 9 a 19 hs',
        }) + '\n```',
      }],
    };
  }

  // — Sección Diseño / identidad visual
  if (section === 'diseno') {
    if (turn < 2) {
      return { content: [{ text: '¿Tenés alguna preferencia de colores o estilo para tu landing?' }] };
    }
    return {
      content: [{
        text: 'Con esa paleta y ese estilo ya podemos generar tus diseños.\n\n```json\n' + JSON.stringify({
          seccion: 'diseno',
          colores: ['violeta', 'negro'],
          colores_hex: ['#7C3AED', '#0F172A'],
          estilo: 'moderno y elegante',
          tipografia: 'sans-serif moderna',
          tono: 'cercano y profesional',
          referencias: '',
        }) + '\n```',
      }],
    };
  }

  return { content: [{ text: 'Entendido.' }] };
}

// HTML mínimo pero realista que devuelve el mock de generación
function mockGeneratedHtml() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Demo Marca Local — Landing Page</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #0F172A; color: #F8FAFC; }
  nav  { padding: 20px 40px; background: rgba(15,23,42,.9); display: flex; justify-content: space-between; align-items: center; }
  nav .logo { font-weight: 800; font-size: 18px; color: #2563EB; }
  nav a { font-size: 13px; color: #94A3B8; text-decoration: none; }
  .hero { padding: 100px 40px 80px; text-align: center; }
  .hero h1 { font-size: 56px; font-weight: 900; line-height: 1.05; margin-bottom: 20px; }
  .hero h1 em { color: #2563EB; font-style: normal; }
  .hero p { font-size: 18px; color: #94A3B8; max-width: 520px; margin: 0 auto 36px; line-height: 1.65; }
  .btn { display: inline-block; background: #2563EB; color: #fff; padding: 16px 36px; border-radius: 100px; font-weight: 700; text-decoration: none; font-size: 16px; }
  .services { padding: 80px 40px; background: #1E293B; }
  .services h2 { font-size: 32px; font-weight: 800; text-align: center; margin-bottom: 48px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 24px; max-width: 900px; margin: 0 auto; }
  .card { background: #0F172A; border: 1px solid #334155; border-radius: 20px; padding: 28px; }
  .card h3 { font-size: 18px; font-weight: 700; margin-bottom: 10px; color: #2563EB; }
  .card p { font-size: 14px; color: #94A3B8; line-height: 1.6; }
  .contact { padding: 80px 40px; text-align: center; }
  .contact h2 { font-size: 28px; font-weight: 800; margin-bottom: 12px; }
  .contact p { color: #94A3B8; margin-bottom: 32px; }
  footer { padding: 32px 40px; border-top: 1px solid #1E293B; text-align: center; font-size: 13px; color: #475569; }
  .badge { display: inline-block; background: rgba(37,99,235,.15); color: #60A5FA; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; padding: 5px 14px; border-radius: 100px; margin-bottom: 24px; }
</style>
</head>
<body>
<nav>
  <span class="logo">DEMO MARCA</span>
  <a href="#contacto">Contacto</a>
</nav>
<section class="hero">
  <div class="badge">🖥 Mock Preview — Diseño Moderno Oscuro</div>
  <h1>Tecnología que<br><em>impulsa tu negocio</em></h1>
  <p>Empresa de desarrollo de software con 5 años de experiencia creando soluciones digitales a medida.</p>
  <a href="#contacto" class="btn">Hablemos →</a>
</section>
<section class="services">
  <h2>Nuestros Servicios</h2>
  <div class="grid">
    <div class="card"><h3>Desarrollo Web</h3><p>Sitios y aplicaciones web optimizados, rápidos y modernos.</p></div>
    <div class="card"><h3>Apps Móviles</h3><p>Aplicaciones nativas para iOS y Android con tu identidad.</p></div>
    <div class="card"><h3>Consultoría IT</h3><p>Estrategia tecnológica para escalar tu negocio de manera eficiente.</p></div>
  </div>
</section>
<section class="contact" id="contacto">
  <h2>¿Listo para empezar?</h2>
  <p>Escribinos y coordinamos una reunión sin compromiso.</p>
  <a href="https://wa.me/5491155551234" class="btn">WhatsApp +54 11 5555-1234</a>
</section>
<footer>© 2026 Demo Marca Local · martinduarte.com</footer>
</body>
</html>`;
}

// ─── Mocks de las demás APIs ──────────────────────────────────────────────────

// Sesiones en memoria (se pierden al reiniciar el server, suficiente para testing local)
const _sessions = new Map(); // session_id → { meta, brief, messages }
// Clientes en memoria (para conflicto de email en tests)
const _clientsByEmail = new Map(); // email → { session_id, estado, nombre_marca }
// Contador para IDs de design sets (no se persiste al disco en modo mock)
let _dsnCounter = 1;
// Diseños "anteriores" para el carrusel DSN. Vacío por defecto (los tests del
// flujo de generación esperan no encontrar carrusel previo); se puebla solo
// vía POST /api/_test/seed-dsn para el caso de uso del carrusel.
let _dsnStore = [];

function mockValidateEmail(body) {
  const { email } = body;
  const isDisposable = /@(mailinator|tempmail|guerrilla|yopmail|throwam)/.test(email || '');
  console.log(`  [mock] validate-email: ${email} → ${isDisposable ? 'DISPOSABLE' : 'DELIVERABLE'}`);
  return { deliverable: !isDisposable, disposable: isDisposable };
}

function mockSaveClient(body) {
  // Formato nuevo: { action, session_id, email, data }
  // Formato legacy (feedback): { action, session_id, data }
  const { action, session_id, email, data } = body;
  const filePath = path.join(__dirname, 'landing_page', 'data', 'clientes.json');

  let clientes = [];
  try { clientes = JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch {}

  if (action === 'create') {
    // Verificar duplicado
    if (email && _clientsByEmail.has(email)) {
      const existing = _clientsByEmail.get(email);
      return {
        error: 'email_exists',
        session_id: existing.session_id,
        id: existing.session_id,
        estado: existing.estado,
        nombre: existing.nombre_marca,
      };
    }
    const client = { id: session_id, email: data?.email || email, session_id, estado: 'en_chat', nombre_marca: data?.nombre_marca || '' };
    clientes.push(client);
    if (email) _clientsByEmail.set(email, { session_id, estado: 'en_chat', nombre_marca: data?.nombre_marca || '' });
    console.log(`  [mock] save-client CREATE: session=${session_id} email=${email}`);
    fs.writeFileSync(filePath, JSON.stringify(clientes, null, 2));
    return { ok: true, client_id: session_id };
  }

  if (action === 'update') {
    const idx = clientes.findIndex(c => c.session_id === session_id || c.id === session_id);
    if (idx >= 0 && data?.estado) { clientes[idx].estado = data.estado; }
    if (idx >= 0 && data?.nombre_marca) { clientes[idx].nombre_marca = data.nombre_marca; }
    fs.writeFileSync(filePath, JSON.stringify(clientes, null, 2));
    console.log(`  [mock] save-client UPDATE: session=${session_id} estado=${data?.estado}`);
    return { ok: true };
  }

  if (action === 'feedback') {
    const idx = clientes.findIndex(c => c.session_id === session_id || c.id === session_id);
    if (idx >= 0) {
      clientes[idx].template_elegido = data?.template_elegido;
      clientes[idx].estado = 'diseños_generados';
    }
    fs.writeFileSync(filePath, JSON.stringify(clientes, null, 2));
    console.log(`  [mock] save-client FEEDBACK: session=${session_id} template=${data?.template_elegido}`);
    return { ok: true };
  }

  return { ok: true };
}

function mockSaveSession(body) {
  const { session_id, type, payload } = body;
  if (!session_id || !type) return { error: 'session_id y type requeridos' };

  const sess = _sessions.get(session_id) || { meta: null, brief: null, messages: [] };

  if (type === 'brief')           { sess.brief = payload; }
  else if (type === 'meta')       { sess.meta = { ...(sess.meta || {}), ...payload }; }
  else if (type === 'message')    { sess.messages.push(payload); }
  else if (type === 'messages_batch' && Array.isArray(payload)) { sess.messages.push(...payload); }

  _sessions.set(session_id, sess);
  console.log(`  [mock] save-session ${session_id} type=${type}`);
  return { ok: true };
}

function mockGetSession(sessionId) {
  const sess = _sessions.get(sessionId);
  if (!sess || (!sess.meta && !sess.brief)) return { found: false };
  return { found: true, ...sess };
}

function mockApproveReject(action, queryParams) {
  const token = queryParams.get('token');
  if (!token) return { status: 400, html: '<h1>Token faltante</h1>' };
  console.log(`  [mock] ${action}: token recibido, aprobando automáticamente`);
  const html = action === 'approve'
    ? '<h1 style="color:green">✅ Deploy aprobado (mock)</h1>'
    : '<h1 style="color:red">❌ Diseño rechazado (mock)</h1>';
  return { status: 200, html };
}

function mockSaveDsn(body) {
  // En modo mock, save-dsn retorna éxito sin escribir al disco.
  // Esto evita que dsn/index.json acumule entradas entre tests E2E,
  // lo que causaría que initCarousel() detecte "diseños anteriores"
  // y muestre el carrusel legacy en lugar de generar nuevos diseños.
  const { rubro, templates } = body;
  const nextNum = (_dsnCounter++).toString().padStart(3, '0');
  const setId   = `dsn-${nextNum}`;
  console.log(`  [mock] save-dsn (in-memory): ${setId} (${rubro}) ${(templates || []).length} templates`);
  return { success: true, id: setId };
}

function mockNotify(body) {
  const { brief, cliente } = body;
  console.log('\n  ┌─ [mock] notify — Brief recibido ─────────────────────────────');
  if (cliente) {
    console.log(`  │  Cliente:  ${cliente.nombre} <${cliente.email}>`);
    console.log(`  │  Sesión:   ${cliente.id}`);
    if (cliente.feedback_diseño) {
      console.log(`  │  Feedback: "${cliente.feedback_diseño}"`);
    }
  }
  console.log(`  │  Marca:    ${brief?.nombre_marca}`);
  console.log(`  │  Rubro:    ${brief?.rubro}`);
  console.log(`  │  Template: ${brief?.template_nombre || brief?.template_elegido || '—'}`);
  console.log(`  │  Contacto: ${brief?.contacto}`);
  console.log('  └──────────────────────────────────────────────────────────────\n');
  return { success: true };
}

// ─── Servidor HTTP ────────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(json);
}

// Replica el contrato SSE de api/claude.js para generation/redesign:
// eventos `delta` con fragmentos del HTML y un `done` final con stop_reason.
function sendSse(res, fullText) {
  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Access-Control-Allow-Origin': '*',
  });
  const CHUNK = 800;
  let i = 0;
  const timer = setInterval(() => {
    if (i >= fullText.length) {
      clearInterval(timer);
      res.write(`event: done\ndata: ${JSON.stringify({ stop_reason: 'end_turn' })}\n\n`);
      return res.end();
    }
    res.write(`event: delta\ndata: ${JSON.stringify({ t: fullText.slice(i, i + CHUNK) })}\n\n`);
    i += CHUNK;
  }, 25);
}

function serveStatic(res, filePath) {
  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url    = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method;
  const urlPath  = url.pathname;

  // ── CORS preflight ──────────────────────────────────────────────────────────
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  // ── API routes ──────────────────────────────────────────────────────────────
  if (urlPath.startsWith('/api/')) {
    const route = urlPath.slice(5); // remove /api/

    // ── GET routes (session recovery, approve, reject) ──────────────────────
    if (method === 'GET') {
      console.log(`→ GET /api/${route}`);

      if (route === 'get-session') {
        const sessionId = url.searchParams.get('session_id');
        if (!sessionId) return sendJson(res, 400, { error: 'session_id requerido' });
        return sendJson(res, 200, mockGetSession(sessionId));
      }

      // Carrusel de diseños anteriores (replica /api/get-dsn-html de prod)
      if (route === 'get-dsn-html') {
        return sendJson(res, 200, { designs: _dsnStore });
      }

      if (route === 'approve' || route === 'reject') {
        const result = mockApproveReject(route, url.searchParams);
        res.writeHead(result.status, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(result.html);
      }

      return sendJson(res, 404, { error: `GET /api/${route} no tiene mock` });
    }

    // ── POST routes ─────────────────────────────────────────────────────────
    const body = await readBody(req);
    console.log(`→ POST /api/${route}`);

    try {
      // Rutas solo-test: sembrar/limpiar estado para casos de uso específicos
      if (route === '_test/seed-dsn') {
        _dsnStore = Array.isArray(body.designs) ? body.designs : [];
        console.log(`  [mock] _test/seed-dsn: ${_dsnStore.length} diseños sembrados`);
        return sendJson(res, 200, { ok: true, count: _dsnStore.length });
      }
      if (route === '_test/reset') {
        _sessions.clear(); _clientsByEmail.clear(); _dsnStore = [];
        console.log('  [mock] _test/reset: estado limpio');
        return sendJson(res, 200, { ok: true });
      }

      let result;
      switch (route) {
        case 'claude': {
          const intent = body.intent || 'chat';
          // generation/redesign responden SSE como api/claude.js en producción
          if (intent === 'generation' || intent === 'redesign') {
            const html = LLM_PROVIDER === 'openrouter'
              ? (await callOpenRouter(body)).content[0].text
              : mockGeneratedHtml();
            return sendSse(res, html);
          }
          result = LLM_PROVIDER === 'openrouter'
            ? await callOpenRouter(body)
            : mockClaudeResponse(body);
          break;
        }
        case 'track':          result = { ok: true };               break;
        case 'validate-email': result = mockValidateEmail(body);    break;
        case 'save-client':    result = mockSaveClient(body);       break;
        case 'save-session':   result = mockSaveSession(body);      break;
        case 'save-dsn':       result = mockSaveDsn(body);          break;
        case 'notify':         result = mockNotify(body);           break;
        case 'upload-file':    result = { ok: true, url: '/assets/mock-upload.png' }; break;
        default:
          return sendJson(res, 404, { error: `API route '${route}' no tiene mock definido` });
      }
      return sendJson(res, 200, result);
    } catch (err) {
      console.error(`  [error] /api/${route}:`, err.message);
      return sendJson(res, 500, { error: err.message });
    }
  }

  // ── Archivos estáticos ──────────────────────────────────────────────────────
  let filePath;

  if (urlPath === '/' || urlPath === '/landing_page' || urlPath === '/landing_page/') {
    filePath = path.join(__dirname, 'landing_page', 'index.html');
  } else if (urlPath.startsWith('/landing_page/')) {
    filePath = path.join(__dirname, urlPath.slice(1));
  } else {
    // Recursos de la raíz (assets, etc.)
    filePath = path.join(__dirname, urlPath.slice(1));
  }

  serveStatic(res, filePath);
});

server.listen(PORT, () => {
  console.log('\n  ╔══════════════════════════════════════════════════════════╗');
  console.log('  ║         MOCK SERVER — Landing Page Webapp              ║');
  console.log('  ╠══════════════════════════════════════════════════════════╣');
  console.log(`  ║  URL:     http://localhost:${PORT}/landing_page/            ║`);
  if (LLM_PROVIDER === 'openrouter') {
    console.log('  ║  LLM:     → OpenRouter (real) — modelo gratuito         ║');
    console.log(`  ║  Modelo:  ${OPENROUTER_MODEL.padEnd(46)}║`);
  } else {
    console.log('  ║  Tokens:  ✗ ninguno consumido (Claude mockeado)         ║');
  }
  console.log('  ║  APIs:    ✗ Abstract API, GitHub API, Resend mockeados  ║');
  console.log('  ╠══════════════════════════════════════════════════════════╣');
  console.log('  ║  Flujo simulado:                                        ║');
  console.log('  ║  1. Completar formulario (cualquier email válido)       ║');
  console.log('  ║  2. Enviar 1 mensaje → IA pide más datos               ║');
  console.log('  ║  3. Enviar 2° mensaje → genera 3 diseños mock           ║');
  console.log('  ║  4. Ver modal, elegir, confirmar pago (log en consola)  ║');
  console.log('  ╚══════════════════════════════════════════════════════════╝\n');
});
