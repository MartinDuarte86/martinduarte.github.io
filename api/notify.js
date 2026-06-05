module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { brief, html_elegido } = req.body;

  if (!brief || !html_elegido) {
    return res.status(400).json({ error: 'Faltan datos: brief y html_elegido son requeridos' });
  }

  const slug = slugify(brief.nombre_marca);

  try {
    // Create a secret GitHub Gist with the HTML
    const gistRes = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GH_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'martinduarte-landing-bot',
      },
      body: JSON.stringify({
        description: `Landing page — ${brief.nombre_marca}`,
        public: false,
        files: {
          'landing.html': { content: html_elegido },
        },
      }),
    });

    if (!gistRes.ok) {
      const err = await gistRes.text();
      throw new Error(`Gist creation failed: ${err}`);
    }

    const gist = await gistRes.json();
    const gistId = gist.id;

    // Build approval token
    const tokenPayload = { slug, gist_id: gistId, nombre_marca: brief.nombre_marca };
    const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');

    const baseUrl = process.env.BASE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const approveUrl = `${baseUrl}/api/approve?token=${token}`;
    const rejectUrl = `${baseUrl}/api/reject?token=${token}`;
    const previewUrl = `${baseUrl}/landing_page/preview.html?gist_id=${gistId}`;

    // Send email via Resend
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Landing Bot <noreply@martinduarte.com>',
        to: ['martynduarte@gmail.com'],
        subject: `NUEVO CLIENTE — ${brief.nombre_marca} | Landing Page`,
        html: buildEmail(brief, approveUrl, rejectUrl, previewUrl),
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.json();
      throw new Error(`Email send failed: ${JSON.stringify(err)}`);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Notify error:', error);
    return res.status(500).json({ error: error.message });
  }
};

function slugify(text) {
  return (text || 'cliente')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildEmail(brief, approveUrl, rejectUrl, previewUrl) {
  const serviciosHtml = Array.isArray(brief.servicios) && brief.servicios.length
    ? brief.servicios.map(s => `<li style="margin:6px 0;color:#334155;font-size:15px;">${s}</li>`).join('')
    : '<li style="color:#94A3B8;">No especificados</li>';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { box-sizing:border-box; }
  body { margin:0; padding:0; background:#F1F5F9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
  .wrap { max-width:600px; margin:32px auto; padding:0 16px; }
  .card { background:#fff; border-radius:20px; overflow:hidden; box-shadow:0 4px 24px rgba(15,23,42,.10); }
  .hdr { background:#0F172A; padding:32px; text-align:center; }
  .hdr-tag { font-size:11px; font-weight:700; letter-spacing:.15em; text-transform:uppercase; color:#64748B; margin-bottom:8px; }
  .hdr-brand { font-size:26px; font-weight:700; color:#2563EB; margin:0 0 4px; }
  .hdr-sub { font-size:13px; color:#94A3B8; }
  .body { padding:32px; }
  .section-tag { font-size:10px; font-weight:700; letter-spacing:.15em; text-transform:uppercase; color:#94A3B8; margin-bottom:12px; }
  .field { margin-bottom:20px; }
  .field-lbl { font-size:12px; color:#94A3B8; margin-bottom:3px; }
  .field-val { font-size:16px; color:#0F172A; font-weight:600; }
  .chip { display:inline-block; background:#EFF6FF; color:#2563EB; padding:4px 12px; border-radius:100px; font-size:12px; font-weight:600; }
  .chip-warn { background:#FEF3C7; color:#D97706; }
  .divider { border:none; border-top:1px solid #E2E8F0; margin:24px 0; }
  .btn { display:inline-block; padding:14px 28px; border-radius:100px; font-size:15px; font-weight:600; text-decoration:none; margin-right:10px; margin-bottom:10px; }
  .btn-green { background:#16A34A; color:#fff; }
  .btn-gray { background:#F1F5F9; color:#475569; border:1px solid #E2E8F0; }
  .btn-sm { background:#F8FAFC; color:#0F172A; border:1px solid #E2E8F0; font-size:13px; padding:10px 20px; border-radius:100px; text-decoration:none; display:inline-block; margin-top:12px; }
  .ftr { background:#F8FAFC; padding:16px 32px; text-align:center; font-size:12px; color:#94A3B8; }
  ul { margin:0; padding-left:20px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="hdr">
      <div class="hdr-tag">Nuevo cliente — Landing Page</div>
      <div class="hdr-brand">${brief.nombre_marca || 'Sin nombre'}</div>
      <div class="hdr-sub">${brief.rubro || ''}</div>
    </div>
    <div class="body">
      <div class="section-tag">Datos del cliente</div>

      <div class="field">
        <div class="field-lbl">Contacto</div>
        <div class="field-val">${brief.contacto || 'No proporcionado'}</div>
      </div>

      <div class="field">
        <div class="field-lbl">Email / redes</div>
        <div class="field-val">${brief.email || '—'} &nbsp; ${brief.redes ? Object.values(brief.redes).join(' · ') : '—'}</div>
      </div>

      <div class="field">
        <div class="field-lbl">Template elegido</div>
        <div class="field-val">${brief.template_nombre || brief.template_elegido || '—'}</div>
      </div>

      <div class="field">
        <div class="field-lbl">Secciones</div>
        <div class="field-val">${(brief.secciones || ['Hero', 'Servicios', 'Contacto']).join(' · ')}</div>
      </div>

      <hr class="divider">
      <div class="section-tag">Servicios</div>
      <ul>${serviciosHtml}</ul>

      ${brief.slogan ? `<hr class="divider">
      <div class="field">
        <div class="field-lbl">Slogan</div>
        <div class="field-val">"${brief.slogan}"</div>
      </div>` : ''}

      ${brief.descripcion ? `<div class="field">
        <div class="field-lbl">Descripción del negocio</div>
        <div class="field-val" style="font-weight:400;font-size:14px;line-height:1.6;color:#475569;">${brief.descripcion}</div>
      </div>` : ''}

      <hr class="divider">
      <div class="field">
        <div class="field-lbl">Estado de pago</div>
        <span class="chip chip-warn">PENDIENTE — El cliente confirmó el pago</span>
      </div>

      <div style="margin-top:24px;">
        <a href="${approveUrl}" class="btn btn-green">Aprobar deploy</a>
        <a href="${rejectUrl}" class="btn btn-gray">Rechazar</a>
      </div>
      <div>
        <a href="${previewUrl}" class="btn-sm">Ver preview del cliente</a>
      </div>
    </div>
    <div class="ftr">martinduarte.com · Landing Page Service</div>
  </div>
</div>
</body>
</html>`;
}
