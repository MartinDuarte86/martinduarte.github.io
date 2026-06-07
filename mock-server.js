/**
 * Servidor mock local para la webapp de landing pages.
 * No consume tokens de Anthropic ni APIs externas.
 * Uso: node mock-server.js  →  abre http://localhost:3000/landing_page/
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT        = 3000;
const STATIC_ROOT = __dirname;

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
  const { system, messages, max_tokens } = body;

  // — Llamada de generación de HTML (generator.js, sin system, max_tokens 6000)
  if (!system && max_tokens === 6000) {
    return { content: [{ text: mockGeneratedHtml() }] };
  }

  // — Llamada de evaluación (evaluacion.txt — identifiable por "CRITERIOS DE ACEPTACIÓN")
  if (system && system.includes('CRITERIOS DE ACEPTACIÓN')) {
    return {
      content: [{
        text: '```json\n' + JSON.stringify({
          respuesta_cliente: '¡Perfecto! Tu proyecto aplica muy bien para una landing page. Vamos a armar todo paso a paso — arranquemos.',
          siguiente_accion: 'onboarding',
        }) + '\n```',
      }],
    };
  }

  const userMessages = (messages || []).filter(m => m.role === 'user');
  const turn = userMessages.length;

  // — Sección Hero (prompt_hero.txt)
  if (system && system.includes('sección Hero')) {
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

  // — Sección Sobre mí / Nosotros (prompt_sobre_mi.txt)
  if (system && system.includes('"Sobre mí" o "Nosotros"')) {
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

  // — Sección Servicios (prompt_servicios.txt)
  if (system && system.includes('sección Servicios')) {
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

  // — Sección Testimonios (prompt_testimonios.txt)
  if (system && system.includes('sección Testimonios')) {
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

  // — Sección Contacto (prompt_contacto.txt)
  if (system && system.includes('sección Contacto')) {
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

  // — Sección Diseño / identidad visual (prompt_diseno.txt)
  if (system && system.includes('identidad visual')) {
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

function mockValidateEmail(body) {
  const { email } = body;
  const isDisposable = /@(mailinator|tempmail|guerrilla|yopmail|throwam)/.test(email || '');
  console.log(`  [mock] validate-email: ${email} → ${isDisposable ? 'DISPOSABLE' : 'DELIVERABLE'}`);
  return { deliverable: !isDisposable, disposable: isDisposable };
}

function mockSaveClient(body) {
  const { action, client, sessionId, feedbackText } = body;
  const filePath = path.join(__dirname, 'landing_page', 'data', 'clientes.json');

  let clientes = [];
  try { clientes = JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch {}

  if (action === 'create' && client) {
    clientes.push(client);
    console.log(`  [mock] save-client CREATE: ${client.nombre} ${client.apellido} <${client.email}>`);
  } else if (action === 'feedback' && sessionId) {
    const entry = clientes.find(c => c.id === sessionId);
    if (entry) {
      entry.feedback_diseño = feedbackText;
      entry.estado = 'feedback_pendiente';
      console.log(`  [mock] save-client FEEDBACK session ${sessionId}: "${feedbackText?.slice(0, 60)}..."`);
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(clientes, null, 2));
  return { success: true };
}

function mockSaveDsn(body) {
  const { rubro, templates } = body;
  const indexPath = path.join(__dirname, 'landing_page', 'dsn', 'index.json');

  let index = [];
  try { index = JSON.parse(fs.readFileSync(indexPath, 'utf-8')); } catch {}

  const nextNum = (index.length + 1).toString().padStart(3, '0');
  const setId   = `dsn-${nextNum}`;
  const today   = new Date().toISOString().split('T')[0];

  // Guardar HTMLs en dsn/template/
  const tplDir = path.join(__dirname, 'landing_page', 'dsn', 'template');
  fs.mkdirSync(tplDir, { recursive: true });

  const templateMeta = (templates || []).map((tpl, i) => {
    fs.writeFileSync(path.join(tplDir, `${setId}-template-${i + 1}.html`), tpl.html || '');
    return { id: tpl.id, name: tpl.name, file: `dsn/template/${setId}-template-${i + 1}.html` };
  });

  // Guardar meta.json del set
  const setDir = path.join(__dirname, 'landing_page', 'dsn', setId);
  fs.mkdirSync(setDir, { recursive: true });
  const meta = { id: setId, rubro, fecha: today };
  fs.writeFileSync(path.join(setDir, 'meta.json'), JSON.stringify(meta, null, 2));

  index.push({ id: setId, rubro, templates: templateMeta, fecha: today });
  if (index.length > 10) index.shift();
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

  console.log(`  [mock] save-dsn: guardado ${setId} (${rubro}) con ${templateMeta.length} templates`);
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
    const body = await readBody(req);
    const route = urlPath.slice(5); // remove /api/
    console.log(`→ POST /api/${route}`);

    try {
      let result;
      switch (route) {
        case 'claude':         result = mockClaudeResponse(body);   break;
        case 'validate-email': result = mockValidateEmail(body);    break;
        case 'save-client':    result = mockSaveClient(body);       break;
        case 'save-dsn':       result = mockSaveDsn(body);          break;
        case 'notify':         result = mockNotify(body);           break;
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
  console.log('  ║  Tokens:  ✗ ninguno consumido (Claude mockeado)         ║');
  console.log('  ║  APIs:    ✗ Abstract API, GitHub API, Resend mockeados  ║');
  console.log('  ╠══════════════════════════════════════════════════════════╣');
  console.log('  ║  Flujo simulado:                                        ║');
  console.log('  ║  1. Completar formulario (cualquier email válido)       ║');
  console.log('  ║  2. Enviar 1 mensaje → IA pide más datos               ║');
  console.log('  ║  3. Enviar 2° mensaje → genera 3 diseños mock           ║');
  console.log('  ║  4. Ver modal, elegir, confirmar pago (log en consola)  ║');
  console.log('  ╚══════════════════════════════════════════════════════════╝\n');
});
