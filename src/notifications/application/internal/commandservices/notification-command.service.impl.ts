import type { Logger } from '../../../../shared/infrastructure/logging/logger';
import { Notification } from '../../../domain/model/aggregates/notification.aggregate';
import type { SendNotificationCommand } from '../../../domain/model/commands/send-notification.command';
import { EmailAddress } from '../../../domain/model/valueobjects/email-address.vo';
import { NotificationChannel } from '../../../domain/model/valueobjects/notification-channel.enum';
import { RecipientId } from '../../../domain/model/valueobjects/recipient-id.vo';
import type { IEmailSender } from '../../../domain/services/email-sender';
import type { INotificationCommandService } from '../../../domain/services/notification-command.service';
import type { INotificationTemplateCatalog } from '../../../domain/services/notification-template-catalog';
import type { IProcessedEventRegistry } from '../../../domain/services/processed-event-registry';
import type { IPushNotificationSender } from '../../../domain/services/push-notification-sender';
import type { IRecipientDirectory } from '../../../domain/services/recipient-directory';
import { NotificationDeliveryError } from './notification-delivery.error';

/**
 * @author LiquiLabs
 * @summary Caso de uso de escritura: arma la notificación desde su plantilla y la entrega por cada canal.
 *
 * Pasos: descarta los canales que ya se entregaron (idempotencia) → resuelve el email
 * con el ACL de Profile si el evento no lo trajo → entrega cada canal pendiente. Si
 * alguno falla, lanza para que el evento se reintente.
 */
export class NotificationCommandServiceImpl implements INotificationCommandService {
  constructor(
    private readonly templateCatalog: INotificationTemplateCatalog,
    private readonly recipientDirectory: IRecipientDirectory,
    private readonly pushSender: IPushNotificationSender,
    private readonly emailSender: IEmailSender,
    private readonly processedEvents: IProcessedEventRegistry,
    private readonly logger: Logger,
  ) {}

  async handleSendNotification(
    command: SendNotificationCommand,
  ): Promise<Notification | null> {
    const notification = Notification.create({
      sourceEventKey: command.sourceEventKey,
      type: command.type,
      recipientId: new RecipientId(command.recipientId),
      content: this.templateCatalog.render(command.type, command.variables),
      channels: command.channels,
      email: EmailAddress.tryCreate(command.recipientEmail),
    });

    for (const channel of notification.channels) {
      if (this.processedEvents.has(this.deliveryKey(notification, channel))) {
        notification.markSkipped(channel, 'ALREADY_DELIVERED');
      }
    }
    if (notification.pendingChannels().length === 0) {
      this.logger.debug(
        { sourceEventKey: notification.sourceEventKey },
        'Evento ya notificado: se ignora el duplicado',
      );
      return null;
    }

    if (notification.needsEmailResolution()) {
      await this.resolveEmail(notification);
    }

    for (const channel of notification.pendingChannels()) {
      try {
        await this.deliver(notification, channel);
        notification.markSent(channel);
        this.processedEvents.markProcessed(
          this.deliveryKey(notification, channel),
        );
      } catch (error) {
        notification.markFailed(channel, (error as Error).message);
      }
    }

    if (notification.hasFailures()) {
      throw new NotificationDeliveryError(notification);
    }
    this.logger.info(
      {
        type: notification.type,
        recipientId: notification.recipientId.value,
        sourceEventKey: notification.sourceEventKey,
        channels: notification.channels.map((channel) => ({
          channel,
          ...notification.deliveryOf(channel),
        })),
      },
      'Notificación procesada',
    );
    return notification;
  }

  private async resolveEmail(notification: Notification): Promise<void> {
    try {
      const email = await this.recipientDirectory.findEmail(
        notification.recipientId,
      );
      if (email) {
        notification.assignEmail(email);
        return;
      }
      this.logger.warn(
        {
          type: notification.type,
          recipientId: notification.recipientId.value,
        },
        'El destinatario no tiene email conocido: no se envía el email',
      );
      notification.markSkipped(
        NotificationChannel.EMAIL,
        'RECIPIENT_EMAIL_NOT_FOUND',
      );
    } catch (error) {
      notification.markFailed(
        NotificationChannel.EMAIL,
        (error as Error).message,
      );
    }
  }

  private deliver(
    notification: Notification,
    channel: NotificationChannel,
  ): Promise<void> {
    switch (channel) {
      case NotificationChannel.PUSH:
        return this.pushSender.send(
          notification.recipientId,
          notification.content,
        );
      case NotificationChannel.EMAIL:
        // needsEmailResolution() ya garantizó el email; markSent lo vuelve a comprobar.
        return this.emailSender.send(
          notification.recipientEmail as EmailAddress,
          notification.content,
        );
    }
  }

  private deliveryKey(
    notification: Notification,
    channel: NotificationChannel,
  ): string {
    return `${notification.sourceEventKey}#${channel}`;
  }
}
