// Polyfill WebSocket para Node.js < 22
// @supabase/realtime-js requiere WebSocket nativo (disponible en Node 22+)
// En Node 20 lo proveemos via el paquete ws
const WebSocket = require('ws');
if (!global.WebSocket) {
  global.WebSocket = WebSocket;
}

// Secreto de sesión determinístico para los tests, de modo que las cookies
// firmadas por el helper de test coincidan con las que verifica api/_lib/session.js.
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';
