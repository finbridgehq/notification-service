import { DomainError } from '../../../../shared/domain/model/domain.error';

/**
 * @author LiquiLabs
 * @summary Lo que ve el usuario: título, cuerpo, un enlace opcional y datos para la app.
 *
 * `data` viaja en el push (FCM solo acepta valores de texto) para que la app sepa a qué
 * pantalla ir al tocar la notificación.
 */
export class NotificationContent {
  constructor(
    public readonly title: string,
    public readonly body: string,
    public readonly actionUrl?: string,
    public readonly data: Readonly<Record<string, string>> = {},
  ) {
    if (!title?.trim() || !body?.trim()) {
      throw new DomainError(
        'INVALID_NOTIFICATION_CONTENT',
        'La notificación necesita título y cuerpo',
      );
    }
  }
}
