import { SendNotificationCommand } from '../../../domain/model/commands/send-notification.command';
import { NotificationChannelPolicy } from '../../../domain/model/valueobjects/notification-channel-policy';
import { NotificationType } from '../../../domain/model/valueobjects/notification-type.enum';
import type {
  DEPOSIT_OUTCOME_EVENT_TYPES,
  DepositOutcomeEvent,
} from '../../acl/upstream-contracts/finance-events.contract';

const TYPE_BY_EVENT: Record<
  (typeof DEPOSIT_OUTCOME_EVENT_TYPES)[number],
  NotificationType
> = {
  DepositSucceededEvent: NotificationType.DEPOSIT_SUCCEEDED,
  DepositFailedEvent: NotificationType.DEPOSIT_FAILED,
  DepositCancelledEvent: NotificationType.DEPOSIT_CANCELLED,
};

/** @author LiquiLabs */
export class SendNotificationCommandFromFinanceEventAssembler {
  public static toCommandFromDepositOutcome(
    eventType: (typeof DEPOSIT_OUTCOME_EVENT_TYPES)[number],
    eventId: string | null,
    event: DepositOutcomeEvent,
  ): SendNotificationCommand {
    const type = TYPE_BY_EVENT[eventType];
    return new SendNotificationCommand(
      // Finance siempre manda event-id; la recarga solo tiene un desenlace si faltara.
      eventId ?? `finance:${eventType}:${event.depositId}`,
      type,
      event.accountId,
      NotificationChannelPolicy.channelsFor(type),
      {
        depositId: event.depositId,
        amount: event.amountMinor / 100,
        currency: event.currency,
        reason: event.failureReason ?? event.cancellationReason,
      },
    );
  }
}
