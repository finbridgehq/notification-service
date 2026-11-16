import type { Notification } from '../model/aggregates/notification.aggregate';
import type { SendNotificationCommand } from '../model/commands/send-notification.command';

/** @author LiquiLabs */
export interface INotificationCommandService {
  /**
   * Entrega la notificación por sus canales. Devuelve `null` si ese evento ya se
   * notificó. Lanza si algún canal falló, para que el evento se reintente: en el
   * reintento solo se vuelven a intentar los canales que no se entregaron.
   */
  handleSendNotification(
    command: SendNotificationCommand,
  ): Promise<Notification | null>;
}
