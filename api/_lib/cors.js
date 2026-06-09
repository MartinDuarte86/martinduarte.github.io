// Middleware CORS compartido para todos los endpoints.
// Centraliza la lógica para evitar inconsistencias entre endpoints.

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);

export function corsHeaders(origin, methods = 'POST, OPTIONS') {
  const allowed = ALLOWED_ORIGINS.length > 0
    ? (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0])
    : origin || '*';
  return {
    'Access-Control-Allow-Origin':  allowed || '*',
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

/**
 * Aplica headers CORS y maneja OPTIONS preflight.
 * @returns {boolean} true si la request fue el preflight OPTIONS (ya respondida)
 */
export function applyCors(req, res, methods = 'POST, OPTIONS') {
  const headers = corsHeaders(req.headers.origin || '', methods);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}
