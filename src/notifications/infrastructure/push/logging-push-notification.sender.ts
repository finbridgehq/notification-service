import type { Logger } from '../../../shared/infrastructure/logging/logger';
import type { NotificationContent } from '../../domain/model/valueobjects/notification-content.vo';
import type { RecipientId } from '../../domain/model/valueobjects/recipient-id.vo';
import type { IPushNotificationSender } from '../../domain/services/push-notification-sender';

/**
 * @author LiquiLabs
 * @summary Para desarrollo local (PUSH_PROVIDER=logging): escribe el push en el log en vez de enviarlo.
 */
export class LoggingPushNotificationSender implements IPushNotificationSender {
  constructor(private readonly logger: Logger) {}

  send(recipientId: RecipientId, content: NotificationContent): Promise<void> {
    this.logger.info(
      {
        recipientId: recipientId.value,
        title: content.title,
        body: content.body,
        data: content.data,
      },
      '[push:logging] Notificación push',
    );
    return Promise.resolve();
  }
}
