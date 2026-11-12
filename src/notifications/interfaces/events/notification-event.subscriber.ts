import type { ZodType } from 'zod';
import { DomainError } from '../../../shared/domain/model/domain.error';
import type { Logger } from '../../../shared/infrastructure/logging/logger';
import type {
  IntegrationEventSubscriber,
  IntegrationMessage,
} from '../../../shared/interfaces/events/integration-event-subscriber';
import type { SendNotificationCommand } from '../../domain/model/commands/send-notification.command';
import type { INotificationCommandService } from '../../domain/services/notification-command.service';
import {
  IntegrationEventEnvelopeNormalizer,
  type NormalizedIntegrationEvent,
} from '../acl/integration-event-envelope.normalizer';

/**
 * @author LiquiLabs
 * @summary Base de los subscribers: normaliza el mensaje, lo traduce a un comando y lo envía.
 *
 * Un mensaje que no cumple el contrato, o que no es un evento que se notifique, se
 * ignora con un log (reintentarlo no lo arreglaría). Un fallo de entrega sí se propaga,
 * para que el runner de Kafka reintente y, si sigue fallando, lo mande a la DLQ.
 */
export abstract class NotificationEventSubscriber implements IntegrationEventSubscriber {
  abstract readonly topic: string;

  constructor(
    private readonly notificationCommandService: INotificationCommandService,
    protected readonly logger: Logger,
  ) {}

  async handle(message: IntegrationMessage): Promise<void> {
    const event = IntegrationEventEnvelopeNormalizer.normalize(message);
    if (!event) {
      this.logger.warn(
        { topic: this.topic, offset: message.offset },
        'Mensaje ignorado: no es un objeto JSON',
      );
      return;
    }
    let command: SendNotificationCommand | null;
    try {
      command = this.toCommand(event);
      if (!command) return;
      await this.notificationCommandService.handleSendNotification(command);
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      this.logger.warn(
        { topic: this.topic, eventType: event.eventType, error: error.message },
        'Evento ignorado: sus datos no son válidos',
      );
    }
  }

  /** Comando a enviar, o `null` si el evento no se notifica o no cumple el contrato. */
  protected abstract toCommand(
    event: NormalizedIntegrationEvent,
  ): SendNotificationCommand | null;

  protected parse<T>(
    contract: ZodType<T>,
    data: unknown,
    eventName: string,
  ): T | null {
    const result = contract.safeParse(data);
    if (result.success) return result.data;
    this.logger.warn(
      {
        topic: this.topic,
        eventName,
        issues: result.error.issues.map(
          (issue) => `${issue.path.join('.')}: ${issue.message}`,
        ),
      },
      `Mensaje ignorado: no cumple el contrato de ${eventName}`,
    );
    return null;
  }

  protected ignore(event: NormalizedIntegrationEvent): null {
    this.logger.debug(
      { topic: this.topic, eventType: event.eventType },
      'Evento sin notificación asociada',
    );
    return null;
  }

  /** Los eventos v1 necesitan eventId (para deduplicar) y la versión 1 del schema. */
  protected requireV1(
    event: NormalizedIntegrationEvent,
    eventName: string,
  ): event is NormalizedIntegrationEvent & { eventId: string } {
    if (event.eventId && event.schemaVersion === 1) return true;
    this.logger.warn(
      {
        topic: this.topic,
        eventName,
        eventId: event.eventId,
        schemaVersion: event.schemaVersion,
      },
      `Mensaje ignorado: no es un ${eventName} v1 con eventId`,
    );
    return false;
  }
}
