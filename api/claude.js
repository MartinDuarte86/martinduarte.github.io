const ALLOWED_ORIGINS = [
  'https://martinduarte.com',
  'https://www.martinduarte.com',
  'https://ia-landing-page-flax.vercel.app',
  'https://ia-landing-page-martinduarte86s-projects.vercel.app',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

const ALLOWED_MODELS = {
  'claude-haiku-4-5-20251001': true,
  'claude-sonnet-4-6': true,
};

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (/^https:\/\/[a-z0-9-]+-martinduarte86\.vercel\.app$/.test(origin)) return true;
  if (/^https:\/\/ia-landing-page[a-z0-9-]*\.vercel\.app$/.test(origin)) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

// ─── Rate limiting en memoria ─────────────────────────────────────────────────
// Nota: en Vercel serverless cada instancia tiene su propio mapa.
// Para tráfico bajo esto es suficiente; para escalar, reemplazar con KV/Redis.

const rateLimitChat = new Map();       // ip → { count, resetAt }
const rateLimitGeneration = new Map(); // ip → { count, resetAt }

const CHAT_LIMIT       = 10;  // requests por IP por hora (evaluación + onboarding)
const GENERATION_LIMIT = 2;   // generaciones por IP por 24h
const HOUR_MS          = 60 * 60 * 1000;
const DAY_MS           = 24 * HOUR_MS;

function checkRateLimit(map, ip, limit, windowMs) {
  const now = Date.now();
  const entry = map.get(ip);

  if (!entry || now > entry.resetAt) {
    map.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= limit) {
    const waitMin = Math.ceil((entry.resetAt - now) / 60000);
    return { allowed: false, waitMin };
  }

  entry.count++;
  return { allowed: true };
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';

  // CORS — solo dominios permitidos
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Origen no autorizado' });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Servicio no disponible' });
  }

  const { messages, system, max_tokens = 4096, model, intent } = req.body;

  // Validaciones de entrada
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages es requerido' });
  }
  if (messages.length > 20) {
    return res.status(400).json({ error: 'Conversación demasiado larga' });
  }

  const totalChars = messages.reduce((acc, m) => acc + String(m.content || '').length, 0)
    + String(system || '').length;
  if (totalChars > 60000) {
    return res.status(400).json({ error: 'Contenido demasiado extenso' });
  }

  // Determinar modelo — whitelist explícita, default Sonnet
  const selectedModel = ALLOWED_MODELS[model] ? model : 'claude-sonnet-4-6';
  const clampedTokens = Math.min(Number(max_tokens) || 4096, 8192);

  // Rate limiting por IP
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';

  if (intent === 'generation') {
    const rl = checkRateLimit(rateLimitGeneration, ip, GENERATION_LIMIT, DAY_MS);
    if (!rl.allowed) {
      return res.status(429).json({
        error: 'rate_limit',
        message: `Límite de generaciones alcanzado. Podés volver a intentarlo en ${rl.waitMin} minutos.`,
      });
    }
  } else {
    const rl = checkRateLimit(rateLimitChat, ip, CHAT_LIMIT, HOUR_MS);
    if (!rl.allowed) {
      return res.status(429).json({
        error: 'rate_limit',
        message: `Demasiadas solicitudes. Esperá ${rl.waitMin} minuto${rl.waitMin !== 1 ? 's' : ''} e intentá de nuevo.`,
      });
    }
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: clampedTokens,
        system,
        messages,
      }),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Claude API error:', error);
    return res.status(500).json({ error: 'Error al conectar con Claude API' });
  }
};
