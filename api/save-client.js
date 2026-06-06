// Guarda o actualiza un registro en landing_page/data/clientes.json via GitHub REST API
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, client, sessionId, feedbackText } = req.body;
  if (!action) return res.status(400).json({ error: 'action requerida' });

  const token = process.env.GH_TOKEN;
  const owner = process.env.GH_OWNER || 'MartinDuarte86';
  const repo  = process.env.GH_REPO  || 'MarcaPersonal-Web';
  const path  = 'landing_page/data/clientes.json';

  if (!token) return res.status(500).json({ error: 'GH_TOKEN no configurado' });

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'martinduarte-landing-bot',
  };

  try {
    // Leer archivo actual
    const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { headers });
    let clientes = [];
    let sha = null;

    if (getRes.ok) {
      const fileData = await getRes.json();
      sha = fileData.sha;
      clientes = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf-8'));
    }

    if (action === 'create') {
      if (!client) return res.status(400).json({ error: 'client requerido' });
      clientes.push(client);
    } else if (action === 'feedback') {
      if (!sessionId || !feedbackText) return res.status(400).json({ error: 'sessionId y feedbackText requeridos' });
      const entry = clientes.find(c => c.id === sessionId);
      if (entry) {
        entry.feedback_diseño = feedbackText;
        entry.estado = 'feedback_pendiente';
      }
    } else {
      return res.status(400).json({ error: 'action inválida' });
    }

    const content = Buffer.from(JSON.stringify(clientes, null, 2)).toString('base64');
    const body = { message: `chore: update clientes.json [${action}]`, content };
    if (sha) body.sha = sha;

    const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });

    if (!putRes.ok) {
      const err = await putRes.text();
      throw new Error(`GitHub PUT failed: ${err}`);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('save-client error:', err);
    return res.status(500).json({ error: err.message });
  }
};
