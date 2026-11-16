import { DomainError } from '../../../../shared/domain/model/domain.error';
import { NotificationChannel } from '../valueobjects/notification-channel.enum';
import { NotificationType } from '../valueobjects/notification-type.enum';

/** Valores que rellenan la plantilla (montos, nombres, motivos…). */
export type TemplateVariables = Readonly<
  Record<string, string | number | null | undefined>
>;

/**
 * @author LiquiLabs
 * @summary Enviar una notificación a un usuario a raíz de un evento de otro bounded context.
 *
 * `sourceEventKey` identifica el evento de origen (su `eventId` o, si no trae, una clave
 * de negocio) y sirve para no notificar dos veces lo mismo.
 */
export class SendNotificationCommand {
  constructor(
    public readonly sourceEventKey: string,
    public readonly type: NotificationType,
    public readonly recipientId: string,
    public readonly channels: NotificationChannel[],
    public readonly variables: TemplateVariables = {},
    public readonly recipientEmail?: string | null,
  ) {
    if (!sourceEventKey?.trim()) {
      throw new DomainError(
        'MISSING_SOURCE_EVENT_KEY',
        'Falta la clave del evento de origen',
      );
    }
    if (channels.length === 0) {
      throw new DomainError(
        'MISSING_CHANNELS',
        'La notificación necesita al menos un canal',
      );
    }
  }
}
