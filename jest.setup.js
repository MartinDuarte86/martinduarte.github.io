// Polyfill WebSocket para Node.js < 22
// @supabase/realtime-js requiere WebSocket nativo (disponible en Node 22+)
// En Node 20 lo proveemos via el paquete ws
const WebSocket = require('ws');
if (!global.WebSocket) {
  global.WebSocket = WebSocket;
}
