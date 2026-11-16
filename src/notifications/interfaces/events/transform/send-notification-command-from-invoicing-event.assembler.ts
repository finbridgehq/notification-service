import { SendNotificationCommand } from '../../../domain/model/commands/send-notification.command';
import { NotificationChannelPolicy } from '../../../domain/model/valueobjects/notification-channel-policy';
import { NotificationType } from '../../../domain/model/valueobjects/notification-type.enum';
import type { InvoiceEligibleForFundingEvent } from '../../acl/upstream-contracts/invoicing-events.contract';

/** @author LiquiLabs */
export class SendNotificationCommandFromInvoicingEventAssembler {
  public static toCommandFromInvoiceEligibleForFunding(
    event: InvoiceEligibleForFundingEvent,
  ): SendNotificationCommand {
    const type = NotificationType.INVOICE_RECEIVED;
    return new SendNotificationCommand(
      event.eventId,
      type,
      event.mypeId,
      NotificationChannelPolicy.channelsFor(type),
      {
        invoiceId: event.invoiceId,
        payerName: event.payerName,
        amount: event.totalAmount,
        currency: event.currency,
      },
    );
  }
}
