// Guarda un nuevo set de diseños en dsn/ y actualiza dsn/index.json via GitHub REST API
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { rubro, clienteId, templates } = req.body;
  if (!rubro || !Array.isArray(templates) || templates.length === 0) {
    return res.status(400).json({ error: 'rubro y templates son requeridos' });
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

  async function getFile(path) {
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { headers });
    if (!r.ok) return null;
    return r.json();
  }

  async function putFile(path, content, sha, message) {
    const body = {
      message,
      content: Buffer.from(content).toString('base64'),
    };
    if (sha) body.sha = sha;
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const err = await r.text();
      throw new Error(`GitHub PUT ${path} failed: ${err}`);
    }
    return r.json();
  }

  try {
    // Leer índice actual
    const indexPath = 'landing_page/dsn/index.json';
    const indexFile = await getFile(indexPath);
    let index = [];
    let indexSha = null;
    if (indexFile) {
      indexSha = indexFile.sha;
      index = JSON.parse(Buffer.from(indexFile.content, 'base64').toString('utf-8'));
    }

    // Generar ID del nuevo set
    const nextNum = (index.length + 1).toString().padStart(3, '0');
    const setId   = `dsn-${nextNum}`;
    const basePath = `landing_page/dsn/${setId}`;
    const today    = new Date().toISOString().split('T')[0];

    // Subir cada template HTML en dsn/template/
    const templateMeta = [];
    for (let i = 0; i < templates.length; i++) {
      const tpl = templates[i];
      const tplFile = `landing_page/dsn/template/${setId}-template-${i + 1}.html`;
      await putFile(tplFile, tpl.html, null, `chore: add template/${setId}-template-${i + 1}`);
      templateMeta.push({
        id: tpl.id,
        name: tpl.name,
        file: `dsn/template/${setId}-template-${i + 1}.html`,
      });
    }

    // Subir meta.json del set
    const meta = { id: setId, rubro, fecha: today, cliente_id: clienteId || null };
    await putFile(`${basePath}/meta.json`, JSON.stringify(meta, null, 2), null, `chore: add ${setId}/meta.json`);

    // Actualizar índice (máximo 10 sets; eliminar el más antiguo si se supera)
    const newEntry = {
      id: setId,
      rubro,
      templates: templateMeta,
      fecha: today,
    };
    index.push(newEntry);
    if (index.length > 10) index.shift();

    // Volver a leer el sha del índice (puede haber cambiado si ya existía)
    const freshIndex = await getFile(indexPath);
    await putFile(
      indexPath,
      JSON.stringify(index, null, 2),
      freshIndex?.sha || indexSha,
      `chore: update dsn/index.json — add ${setId}`
    );

    return res.status(200).json({ success: true, id: setId });
  } catch (err) {
    console.error('save-dsn error:', err);
    return res.status(500).json({ error: err.message });
  }
};
