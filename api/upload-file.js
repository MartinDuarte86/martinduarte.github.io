// Sube archivos del usuario a landing_page/data/{clientId}/ via GitHub REST API
// POST /api/upload-file
// Body: { clientId, files: [{ name, content (base64), size, type }] }
// Límites: máx 5 archivos, máx 10 MB total

const MAX_FILES   = 5;
const MAX_TOTAL_B = 10 * 1024 * 1024; // 10 MB

const ALLOWED_ORIGINS = [
  'https://martinduarte.com',
  'https://www.martinduarte.com',
];

module.exports = async function handler(req, res) {
  // CORS
  const origin = req.headers.origin;
  if (process.env.NODE_ENV !== 'development' && origin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Origen no permitido' });
  }
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { clientId, files } = req.body || {};

  if (!clientId || typeof clientId !== 'string') {
    return res.status(400).json({ error: 'clientId requerido' });
  }
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'files requerido (array)' });
  }
  if (files.length > MAX_FILES) {
    return res.status(400).json({ error: `Máximo ${MAX_FILES} archivos por envío` });
  }

  // Validar tamaño total (el content viene en base64 → cada carácter ≈ 0.75 bytes)
  const totalBytes = files.reduce((acc, f) => acc + Math.ceil((f.content?.length || 0) * 0.75), 0);
  if (totalBytes > MAX_TOTAL_B) {
    return res.status(400).json({ error: 'Tamaño total supera los 10 MB' });
  }

  // Sanitizar nombre de archivo
  function sanitizeName(name) {
    return String(name)
      .replace(/[^a-zA-Z0-9._\-]/g, '_')
      .slice(0, 80);
  }

  const token = process.env.GH_TOKEN;
  const owner = process.env.GH_OWNER || 'MartinDuarte86';
  const repo  = process.env.GH_REPO  || 'MarcaPersonal-Web';

  if (!token) return res.status(500).json({ error: 'GH_TOKEN no configurado' });

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'martinduarte-landing-bot',
  };

  const uploaded = [];
  const errors   = [];

  for (const file of files) {
    const safeName = sanitizeName(file.name || 'archivo');
    const path = `landing_page/data/${clientId}/${safeName}`;

    // Verificar si ya existe (para obtener el sha y poder sobrescribir)
    let sha = null;
    try {
      const checkRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
        { headers }
      );
      if (checkRes.ok) {
        const existing = await checkRes.json();
        sha = existing.sha;
      }
    } catch {}

    const body = {
      message: `upload: ${clientId}/${safeName}`,
      content: file.content, // base64 ya viene del cliente
    };
    if (sha) body.sha = sha;

    try {
      const putRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
        { method: 'PUT', headers, body: JSON.stringify(body) }
      );

      if (!putRes.ok) {
        const err = await putRes.text();
        errors.push({ name: safeName, error: `GitHub error: ${err.slice(0, 120)}` });
      } else {
        uploaded.push({
          name: safeName,
          path,
          size: file.size || 0,
          type: file.type || 'application/octet-stream',
        });
      }
    } catch (err) {
      errors.push({ name: safeName, error: err.message });
    }
  }

  if (uploaded.length === 0 && errors.length > 0) {
    return res.status(500).json({ error: 'No se pudo subir ningún archivo', errors });
  }

  return res.status(200).json({ uploaded, errors });
};
