module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email requerido' });

  const key = process.env.ABSTRACT_API_KEY;
  if (!key) return res.status(500).json({ error: 'API key no configurada' });

  try {
    const url = `https://emailvalidation.abstractapi.com/v1/?api_key=${key}&email=${encodeURIComponent(email)}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Abstract API error: ${r.status}`);
    const data = await r.json();

    return res.status(200).json({
      deliverable: data.deliverability === 'DELIVERABLE',
      disposable: data.is_disposable_email?.value === true,
      reason: data.deliverability,
    });
  } catch (err) {
    console.error('validate-email error:', err);
    return res.status(500).json({ error: err.message });
  }
};
