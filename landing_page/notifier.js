// Envía la notificación a Martín por email via /api/notify
// Incluye datos del cliente registrado (Mejora 1) y feedback de diseño (Mejora 3)

async function sendNotification(brief, htmlElegido, clientData) {
  const payload = {
    brief,
    html_elegido: htmlElegido,
  };

  if (clientData) {
    payload.cliente = {
      nombre:           `${clientData.nombre} ${clientData.apellido}`,
      email:            clientData.email,
      id:               clientData.id,
      timestamp_inicio: clientData.timestamp_inicio,
      feedback_diseño:  clientData.feedback_diseño || null,
    };
  }

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
