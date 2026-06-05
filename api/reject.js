module.exports = async function handler(req, res) {
  const { token } = req.query;

  let payload = {};
  if (token) {
    try {
      payload = JSON.parse(Buffer.from(token, 'base64url').toString('utf-8'));
    } catch {}
  }

  const { nombre_marca = 'este cliente', gist_id } = payload;

  // Delete Gist if present
  if (gist_id && process.env.GH_TOKEN) {
    fetch(`https://api.github.com/gists/${gist_id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${process.env.GH_TOKEN}`,
        'User-Agent': 'martinduarte-landing-bot',
      },
    }).catch(() => {});
  }

  return res.status(200).send(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Solicitud rechazada — Martín Duarte</title>
<style>
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         background:#0F172A; color:#F8FAFC; display:flex; align-items:center;
         justify-content:center; min-height:100vh; text-align:center; padding:24px; }
  .card { background:#1E293B; border-radius:24px; padding:48px 40px; max-width:480px; width:100%; }
  .icon { font-size:48px; margin-bottom:16px; }
  h1 { color:#F59E0B; margin:0 0 16px; font-size:28px; }
  p { color:#94A3B8; line-height:1.6; margin:0; }
</style>
</head>
<body>
<div class="card">
  <div class="icon">✕</div>
  <h1>Solicitud rechazada</h1>
  <p>La landing de <strong style="color:#F8FAFC;">${nombre_marca}</strong> fue rechazada.<br><br>
     Coordiná con el cliente los próximos pasos de forma directa.</p>
</div>
</body>
</html>`);
};
