const ALLOWED_ORIGINS = [
  'https://martinduarte.com',
  'https://www.martinduarte.com',
  'https://ia-landing-page-flax.vercel.app',
  'https://ia-landing-page-martinduarte86s-projects.vercel.app',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  // Allow Vercel preview deployments for this project
  if (/^https:\/\/[a-z0-9-]+-martinduarte86\.vercel\.app$/.test(origin)) return true;
  if (/^https:\/\/ia-landing-page[a-z0-9-]*\.vercel\.app$/.test(origin)) return true;
  return ALLOWED_ORIGINS.includes(origin);
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

  // Bloquear orígenes no autorizados
  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Origen no autorizado' });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Servicio no disponible' });
  }

  const { messages, system, max_tokens = 4096 } = req.body;

  // Validaciones de entrada
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages es requerido' });
  }
  if (messages.length > 40) {
    return res.status(400).json({ error: 'Conversación demasiado larga' });
  }

  const totalChars = messages.reduce((acc, m) => acc + String(m.content || '').length, 0)
    + String(system || '').length;
  if (totalChars > 80000) {
    return res.status(400).json({ error: 'Contenido demasiado extenso' });
  }

  const clampedTokens = Math.min(Number(max_tokens) || 4096, 8192);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
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
