import { DomainError } from '../../../../shared/domain/model/domain.error';
import { DeliveryStatus } from '../valueobjects/delivery-status.enum';
import { EmailAddress } from '../valueobjects/email-address.vo';
import { NotificationChannel } from '../valueobjects/notification-channel.enum';
import { NotificationContent } from '../valueobjects/notification-content.vo';
import { NotificationType } from '../valueobjects/notification-type.enum';
import { RecipientId } from '../valueobjects/recipient-id.vo';

/** @author LiquiLabs */
export interface ChannelDelivery {
  status: DeliveryStatus;
  reason?: string;
}

/**
 * @author LiquiLabs
 * @summary Agregado raíz: una notificación para un usuario y su entrega en cada canal.
 *
 * Vive lo que dura el procesamiento de un evento (no hay base de datos). Sus reglas:
 * - un canal solo se entrega una vez y solo si está pendiente;
 * - el email necesita la dirección del destinatario: sin ella el canal se omite;
 * - la notificación está completa cuando ningún canal queda pendiente ni fallido.
 */
export class Notification {
  private email: EmailAddress | null;
  private readonly deliveries = new Map<NotificationChannel, ChannelDelivery>();

  private constructor(
    public readonly sourceEventKey: string,
    public readonly type: NotificationType,
    public readonly recipientId: RecipientId,
    public readonly content: NotificationContent,
    channels: NotificationChannel[],
    email: EmailAddress | null,
  ) {
    this.email = email;
    for (const channel of new Set(channels)) {
      this.deliveries.set(channel, { status: DeliveryStatus.PENDING });
    }
  }

  static create(props: {
    sourceEventKey: string;
    type: NotificationType;
    recipientId: RecipientId;
    content: NotificationContent;
    channels: NotificationChannel[];
    email?: EmailAddress | null;
  }): Notification {
    if (props.channels.length === 0) {
      throw new DomainError(
        'MISSING_CHANNELS',
        'La notificación necesita al menos un canal',
      );
    }
    return new Notification(
      props.sourceEventKey,
      props.type,
      props.recipientId,
      props.content,
      props.channels,
      props.email ?? null,
    );
  }

  get recipientEmail(): EmailAddress | null {
    return this.email;
  }

  get channels(): NotificationChannel[] {
    return [...this.deliveries.keys()];
  }

  deliveryOf(channel: NotificationChannel): ChannelDelivery | undefined {
    return this.deliveries.get(channel);
  }

  /** Canales que todavía hay que intentar entregar. */
  pendingChannels(): NotificationChannel[] {
    return this.channels.filter(
      (channel) =>
        this.deliveries.get(channel)?.status === DeliveryStatus.PENDING,
    );
  }

  /** Hay que buscar el email del destinatario antes de entregar el canal EMAIL. */
  needsEmailResolution(): boolean {
    return (
      this.email === null &&
      this.deliveries.get(NotificationChannel.EMAIL)?.status ===
        DeliveryStatus.PENDING
    );
  }

  assignEmail(email: EmailAddress): void {
    this.email = email;
  }

  markSent(channel: NotificationChannel): void {
    this.transition(channel, { status: DeliveryStatus.SENT });
  }

  markSkipped(channel: NotificationChannel, reason: string): void {
    this.transition(channel, { status: DeliveryStatus.SKIPPED, reason });
  }

  markFailed(channel: NotificationChannel, reason: string): void {
    this.transition(channel, { status: DeliveryStatus.FAILED, reason });
  }

  hasFailures(): boolean {
    return [...this.deliveries.values()].some(
      (delivery) => delivery.status === DeliveryStatus.FAILED,
    );
  }

  private transition(
    channel: NotificationChannel,
    delivery: ChannelDelivery,
  ): void {
    const current = this.deliveries.get(channel);
    if (!current) {
      throw new DomainError(
        'CHANNEL_NOT_REQUESTED',
        `La notificación no se pidió por ${channel}`,
      );
    }
    if (current.status !== DeliveryStatus.PENDING) {
      throw new DomainError(
        'CHANNEL_ALREADY_RESOLVED',
        `El canal ${channel} ya está ${current.status}`,
      );
    }
    if (
      delivery.status === DeliveryStatus.SENT &&
      channel === NotificationChannel.EMAIL &&
      this.email === null
    ) {
      throw new DomainError(
        'MISSING_RECIPIENT_EMAIL',
        'No se puede entregar un email sin la dirección del destinatario',
      );
    }
    this.deliveries.set(channel, delivery);
  }
}
