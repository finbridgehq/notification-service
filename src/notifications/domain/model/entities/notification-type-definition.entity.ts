import { NotificationChannel } from '../valueobjects/notification-channel.enum';
import { NotificationType } from '../valueobjects/notification-type.enum';

/** A quién va dirigido cada tipo de notificación. */
export enum NotificationAudience {
  MYPE = 'MYPE',
  INVESTOR = 'INVESTOR',
  ANY = 'ANY',
}

/**
 * @author LiquiLabs
 * @summary Definición de un tipo de notificación: lo que muestra el catálogo (GET /notification-types).
 */
export class NotificationTypeDefinition {
  constructor(
    public readonly type: NotificationType,
    public readonly name: string,
    public readonly description: string,
    public readonly audience: NotificationAudience,
    public readonly channels: readonly NotificationChannel[],
    public readonly sourceEvent: string,
  ) {}
}
