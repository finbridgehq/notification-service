import type { Messaging } from 'firebase-admin/messaging';
import { ExternalServiceError } from '../../../shared/application/errors/external-service.error';
import type { PushTopicNaming } from '../../../shared/infrastructure/firebase/push-topic-naming';
import type { NotificationContent } from '../../domain/model/valueobjects/notification-content.vo';
import type { RecipientId } from '../../domain/model/valueobjects/recipient-id.vo';
import type { IPushNotificationSender } from '../../domain/services/push-notification-sender';

/**
 * @author LiquiLabs
 * @summary Envía el push al topic de FCM del usuario: Firebase lo reparte a sus dispositivos.
 *
 * Si el usuario no registró ningún dispositivo, FCM acepta el mensaje igual y no lo
 * entrega a nadie; no es un error.
 */
export class FirebasePushNotificationSender implements IPushNotificationSender {
  constructor(
    private readonly messaging: Messaging,
    private readonly topicNaming: PushTopicNaming,
  ) {}

  async send(
    recipientId: RecipientId,
    content: NotificationContent,
  ): Promise<void> {
    try {
      await this.messaging.send({
        topic: this.topicNaming.topicFor(recipientId.value),
        notification: { title: content.title, body: content.body },
        data: {
          ...content.data,
          ...(content.actionUrl ? { actionUrl: content.actionUrl } : {}),
        },
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });
    } catch (error) {
      throw new ExternalServiceError(
        'Firebase Cloud Messaging',
        (error as Error).message,
        { cause: error },
      );
    }
  }
}
