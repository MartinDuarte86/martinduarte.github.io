// Envía la notificación a Martín por email via /api/notify
// Incluye datos del cliente registrado (Mejora 1) y feedback de diseño (Mejora 3)

async function sendNotification(brief, htmlElegido, clientData, templateElegido, dsnId, metodoPago) {
  const payload = {
    session_id:       brief?.session_id,
    client_id:        clientData?.id || null,
    nombre_marca:     brief?.nombre_marca,
    rubro:            brief?.rubro,
    email_cliente:    clientData?.email || brief?.email || '',
    template_elegido: templateElegido,
    full_brief:       brief,
    html_preview:     htmlElegido,
    dsn_id:           dsnId || null,
    metodo_pago:      metodoPago || null,
  };

  const response = await fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(error.error || `Error ${response.status}`);
  }

  return response.json();
}

export { sendNotification };
