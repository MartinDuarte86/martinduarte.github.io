// Envía la notificación a Martín por email via /api/notify

async function sendNotification(brief, htmlElegido) {
  const response = await fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brief, html_elegido: htmlElegido }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(error.error || `Error ${response.status}`);
  }

  return response.json();
}

export { sendNotification };
