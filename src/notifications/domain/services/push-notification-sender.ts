import type { NotificationContent } from '../model/valueobjects/notification-content.vo';
import type { RecipientId } from '../model/valueobjects/recipient-id.vo';

/**
 * @author LiquiLabs
 * @summary Puerto del canal push: entrega a todos los dispositivos registrados del usuario.
 */
export interface IPushNotificationSender {
  send(recipientId: RecipientId, content: NotificationContent): Promise<void>;
}
