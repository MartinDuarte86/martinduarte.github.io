// Objetivo: construir el header Cookie de una sesión válida para los tests, firmado
//   con el mismo SESSION_SECRET que usa api/_lib/session.js (seteado en jest.setup.js).
// Dependencias: jsonwebtoken, process.env.SESSION_SECRET.
// Resultado esperado: cookieFor(sid) → string apta para headers.cookie de node-mocks-http.

import jwt from 'jsonwebtoken';

export function cookieFor(sid) {
  const token = jwt.sign({ sid }, process.env.SESSION_SECRET || 'test-session-secret');
  return `lp_sid=${token}`;
}
