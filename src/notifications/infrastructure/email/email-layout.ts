import type { NotificationContent } from '../../domain/model/valueobjects/notification-content.vo';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Los textos traen datos de otros servicios (razón social, motivos): se escapan siempre. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

/**
 * @author LiquiLabs
 * @summary Versión en texto plano del email (para clientes sin HTML).
 */
export function renderEmailText(content: NotificationContent): string {
  const lines = [content.body];
  if (content.actionUrl) lines.push('', content.actionUrl);
  lines.push('', '— El equipo de Vankoo');
  return lines.join('\n');
}

/**
 * @author LiquiLabs
 * @summary Plantilla HTML común de los emails de Vankoo.
 */
export function renderEmailHtml(content: NotificationContent): string {
  const paragraphs = content.body
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map(
      (line) =>
        `<p style="margin:0 0 12px;line-height:1.5">${escapeHtml(line)}</p>`,
    )
    .join('');
  const action = content.actionUrl
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(content.actionUrl)}" style="background:#2ba0d6;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Ir a Vankoo</a></p>`
    : '';
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2933">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px">
      <h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(content.title)}</h1>
      ${paragraphs}
      ${action}
      <p style="margin:32px 0 0;font-size:12px;color:#7b8794">Este es un mensaje automático de Vankoo. No respondas a este correo.</p>
    </div>
  </body>
</html>`;
}
