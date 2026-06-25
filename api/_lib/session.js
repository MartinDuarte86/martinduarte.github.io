// Objetivo: identidad de sesión inolvidable. El servidor emite una cookie httpOnly
//   firmada (JWT con SESSION_SECRET) que ATA un session_id a este navegador. El
//   acceso a los datos de una sesión se autoriza por esa cookie, no por el
//   session_id que viaja en el body/query (que es adivinable). Esto cierra el IDOR
//   y la mezcla de sesiones entre usuarios.
// Dependencias: jsonwebtoken, crypto, env SESSION_SECRET (fallback dev/test).
// Resultado esperado: helpers para emitir, leer, limpiar y exigir la sesión.

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const COOKIE_NAME = 'lp_sid';
const MAX_AGE_S   = 60 * 60 * 48; // 48h, igual que el TTL de la sesión en Redis

// SESSION_SECRET es obligatorio en producción. En dev/test, si no está, se usa un
// secreto fijo no-seguro para que el mock y los tests funcionen sin configurarlo.
function secret() {
  return process.env.SESSION_SECRET || 'dev-insecure-session-secret-no-usar-en-prod';
}

export function newSessionId() {
  return crypto.randomUUID();
}

// Firma `sid` y lo setea como cookie httpOnly. Secure solo en producción para no
// romper http://localhost en desarrollo/tests.
export function issueSessionCookie(res, sid) {
  const token = jwt.sign({ sid }, secret());
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${MAX_AGE_S}`,
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  appendSetCookie(res, parts.join('; '));
}

// Expira la cookie (logout / "empezar de nuevo").
export function clearSessionCookie(res) {
  appendSetCookie(res, `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

// Devuelve el sid de la cookie verificada, o null si no hay/está manipulada/expiró.
export function getSessionId(req) {
  const raw = req.headers?.cookie || '';
  const hit = raw.split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE_NAME}=`));
  if (!hit) return null;
  const token = hit.slice(COOKIE_NAME.length + 1);
  try {
    const payload = jwt.verify(token, secret());
    return payload?.sid || null;
  } catch {
    return null;
  }
}

// Guard: exige una sesión válida. Responde 401 y devuelve null si no hay cookie.
// El sid devuelto es la ÚNICA fuente de verdad de qué sesión se está tocando:
// los handlers deben usar este valor e ignorar cualquier session_id del cliente.
export function requireSession(req, res) {
  const sid = getSessionId(req);
  if (!sid) {
    res.status(401).json({ error: 'no_session', message: 'Sesión no válida o expirada.' });
    return null;
  }
  return sid;
}

function appendSetCookie(res, cookieStr) {
  const prev = res.getHeader && res.getHeader('Set-Cookie');
  if (!prev) res.setHeader('Set-Cookie', cookieStr);
  else res.setHeader('Set-Cookie', Array.isArray(prev) ? [...prev, cookieStr] : [prev, cookieStr]);
}
