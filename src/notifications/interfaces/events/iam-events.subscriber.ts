import type { SendNotificationCommand } from '../../domain/model/commands/send-notification.command';
import type { NormalizedIntegrationEvent } from '../acl/integration-event-envelope.normalizer';
import {
  IAM_EVENTS_TOPIC,
  UserCreatedContract,
} from '../acl/upstream-contracts/iam-events.contract';
import { NotificationEventSubscriber } from './notification-event.subscriber';
import { SendNotificationCommandFromIamEventAssembler } from './transform/send-notification-command-from-iam-event.assembler';

/**
 * @author LiquiLabs
 * @summary `vankoo.iam.events` → email de bienvenida al crear la cuenta.
 *
 * IAM publica el registro tal cual, sin `eventType`: se reconoce por sus campos.
 */
export class IamEventsSubscriber extends NotificationEventSubscriber {
  readonly topic = IAM_EVENTS_TOPIC;

  protected toCommand(
    event: NormalizedIntegrationEvent,
  ): SendNotificationCommand | null {
    if (event.eventType && !event.eventType.startsWith('UserCreated')) {
      return this.ignore(event);
    }
    const userCreated = this.parse(
      UserCreatedContract,
      event.data,
      'UserCreatedEvent',
    );
    if (!userCreated) return null;
    const role =
      SendNotificationCommandFromIamEventAssembler.toWelcomeRole(userCreated);
    if (!role) return this.ignore(event);
    return SendNotificationCommandFromIamEventAssembler.toCommandFromUserCreated(
      userCreated,
      role,
    );
  }
}
