import type { Notification } from '../../../domain/model/aggregates/notification.aggregate';
import { DeliveryStatus } from '../../../domain/model/valueobjects/delivery-status.enum';

/**
 * @author LiquiLabs
 * @summary Algún canal no se pudo entregar. Hace que el evento de Kafka se reintente.
 */
export class NotificationDeliveryError extends Error {
  constructor(public readonly notification: Notification) {
    const failures = notification.channels
      .map((channel) => ({
        channel,
        delivery: notification.deliveryOf(channel),
      }))
      .filter(({ delivery }) => delivery?.status === DeliveryStatus.FAILED)
      .map(({ channel, delivery }) => `${channel}: ${delivery?.reason}`);
    super(`No se pudo entregar ${notification.type} (${failures.join('; ')})`);
    this.name = 'NotificationDeliveryError';
  }
}
