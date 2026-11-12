import type { SendNotificationCommand } from '../../domain/model/commands/send-notification.command';
import type { NormalizedIntegrationEvent } from '../acl/integration-event-envelope.normalizer';
import {
  DEPOSIT_OUTCOME_EVENT_TYPES,
  DepositOutcomeContract,
  FINANCE_EVENTS_TOPIC,
} from '../acl/upstream-contracts/finance-events.contract';
import { NotificationEventSubscriber } from './notification-event.subscriber';
import { SendNotificationCommandFromFinanceEventAssembler } from './transform/send-notification-command-from-finance-event.assembler';

type DepositOutcomeEventType = (typeof DEPOSIT_OUTCOME_EVENT_TYPES)[number];

const isDepositOutcome = (
  eventType: string | null,
): eventType is DepositOutcomeEventType =>
  (DEPOSIT_OUTCOME_EVENT_TYPES as readonly (string | null)[]).includes(
    eventType,
  );

/**
 * @author LiquiLabs
 * @summary `vankoo.finance.events.v1` → push al inversionista con el desenlace de su recarga.
 */
export class FinanceEventsSubscriber extends NotificationEventSubscriber {
  readonly topic = FINANCE_EVENTS_TOPIC;

  protected toCommand(
    event: NormalizedIntegrationEvent,
  ): SendNotificationCommand | null {
    const { eventType } = event;
    if (!isDepositOutcome(eventType)) return this.ignore(event);
    const outcome = this.parse(DepositOutcomeContract, event.data, eventType);
    if (!outcome) return null;
    return SendNotificationCommandFromFinanceEventAssembler.toCommandFromDepositOutcome(
      eventType,
      event.eventId,
      outcome,
    );
  }
}
