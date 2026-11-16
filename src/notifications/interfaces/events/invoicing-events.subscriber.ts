import type { SendNotificationCommand } from '../../domain/model/commands/send-notification.command';
import type { NormalizedIntegrationEvent } from '../acl/integration-event-envelope.normalizer';
import {
  INVOICE_ELIGIBLE_FOR_FUNDING_TOPIC,
  InvoiceEligibleForFundingContract,
} from '../acl/upstream-contracts/invoicing-events.contract';
import { NotificationEventSubscriber } from './notification-event.subscriber';
import { SendNotificationCommandFromInvoicingEventAssembler } from './transform/send-notification-command-from-invoicing-event.assembler';

/**
 * @author LiquiLabs
 * @summary `invoicing.invoice-eligible-for-funding` → confirmar a la Mype que su factura se recibió.
 *
 * El topic solo lleva este evento, así que no trae `eventType`.
 */
export class InvoicingEventsSubscriber extends NotificationEventSubscriber {
  readonly topic = INVOICE_ELIGIBLE_FOR_FUNDING_TOPIC;

  protected toCommand(
    event: NormalizedIntegrationEvent,
  ): SendNotificationCommand | null {
    const invoice = this.parse(
      InvoiceEligibleForFundingContract,
      event.data,
      'InvoiceEligibleForFunding',
    );
    if (!invoice) return null;
    return SendNotificationCommandFromInvoicingEventAssembler.toCommandFromInvoiceEligibleForFunding(
      invoice,
    );
  }
}
