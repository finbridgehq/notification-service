import { SendNotificationCommand } from '../../../domain/model/commands/send-notification.command';
import { NotificationChannelPolicy } from '../../../domain/model/valueobjects/notification-channel-policy';
import { NotificationType } from '../../../domain/model/valueobjects/notification-type.enum';
import type {
  AuctionPublishedEvent,
  AuctionRejectedEvent,
} from '../../acl/upstream-contracts/investment-events.contract';

/** @author LiquiLabs */
export class SendNotificationCommandFromInvestmentEventAssembler {
  public static toCommandFromAuctionRejected(
    eventId: string,
    event: AuctionRejectedEvent,
  ): SendNotificationCommand {
    const type = NotificationType.INVOICE_REJECTED;
    return new SendNotificationCommand(
      eventId,
      type,
      event.mypeId,
      NotificationChannelPolicy.channelsFor(type),
      { invoiceId: event.invoiceId, reason: event.reason },
    );
  }

  public static toCommandFromAuctionPublished(
    eventId: string,
    event: AuctionPublishedEvent,
  ): SendNotificationCommand {
    const type = NotificationType.AUCTION_PUBLISHED;
    return new SendNotificationCommand(
      eventId,
      type,
      event.mypeId,
      NotificationChannelPolicy.channelsFor(type),
      {
        invoiceId: event.invoiceId,
        payerName: event.payerName,
        targetAmount: event.targetAmount,
        currency: event.currency,
        expiresAt: event.expiresAt,
      },
    );
  }
}
