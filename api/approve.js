module.exports = async function handler(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send(htmlPage('Error', 'Token requerido.'));
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(token, 'base64url').toString('utf-8'));
  } catch {
    return res.status(400).send(htmlPage('Error', 'Token inválido.'));
  }

  const { slug, gist_id, nombre_marca } = payload;

  if (!slug || !gist_id) {
    return res.status(400).send(htmlPage('Error', 'Datos incompletos en el token.'));
  }

  try {
    // Fetch HTML from Gist
    const gistRes = await fetch(`https://api.github.com/gists/${gist_id}`, {
      headers: {
        'Authorization': `Bearer ${process.env.GH_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'martinduarte-landing-bot',
      },
    });

    if (!gistRes.ok) throw new Error(`Gist fetch failed: ${gistRes.status}`);

    const gist = await gistRes.json();
    const htmlContent = gist.files['landing.html']?.content;

    if (!htmlContent) throw new Error('HTML no encontrado en el Gist');

    const htmlBase64 = Buffer.from(htmlContent).toString('base64');

    // Trigger GitHub Actions workflow
    const owner = process.env.GITHUB_OWNER || 'MartinDuarte86';
    const repo = process.env.GITHUB_REPO || 'martinduarte.com';

    const dispatchRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/deploy-landing.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GH_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'martinduarte-landing-bot',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            cliente_slug: slug,
            html_content: htmlBase64,
          },
        }),
      }
    );

    if (!dispatchRes.ok) {
      const err = await dispatchRes.text();
      throw new Error(`GitHub dispatch failed: ${err}`);
    }

    // Delete Gist after use
    fetch(`https://api.github.com/gists/${gist_id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${process.env.GH_TOKEN}`,
        'User-Agent': 'martinduarte-landing-bot',
      },
    }).catch(() => {});

    return res.status(200).send(htmlPage(
      'Landing aprobada',
      `El deploy de <strong>${nombre_marca}</strong> está en proceso.<br><br>
       La landing estará disponible en<br>
       <a href="https://martinduarte.com/clientes/${slug}/" style="color:#2563EB;">
         martinduarte.com/clientes/${slug}/
       </a><br><br>en unos minutos.`,
      '#16A34A'
    ));
  } catch (error) {
    console.error('Approve error:', error);
    return res.status(500).send(htmlPage('Error en el deploy', error.message));
  }
};

function htmlPage(title, body, accentColor = '#2563EB') {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — Martín Duarte</title>
<style>
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         background:#0F172A; color:#F8FAFC; display:flex; align-items:center;
         justify-content:center; min-height:100vh; text-align:center; padding:24px; }
  .card { background:#1E293B; border-radius:24px; padding:48px 40px; max-width:480px; width:100%; }
  .icon { font-size:48px; margin-bottom:16px; }
  h1 { color:${accentColor}; margin:0 0 16px; font-size:28px; }
  p { color:#94A3B8; line-height:1.6; margin:0; }
  a { color:#2563EB; }
</style>
</head>
<body>
<div class="card">
  <div class="icon">${title.includes('Error') ? '✕' : '✓'}</div>
  <h1>${title}</h1>
  <p>${body}</p>
</div>
</body>
</html>`;
}
