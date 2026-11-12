import type { SendNotificationCommand } from '../../domain/model/commands/send-notification.command';
import type { NormalizedIntegrationEvent } from '../acl/integration-event-envelope.normalizer';
import {
  AUCTION_LIFECYCLE_TOPIC,
  AuctionPublishedContract,
  AuctionRejectedContract,
} from '../acl/upstream-contracts/investment-events.contract';
import { NotificationEventSubscriber } from './notification-event.subscriber';
import { SendNotificationCommandFromInvestmentEventAssembler } from './transform/send-notification-command-from-investment-event.assembler';

/**
 * @author LiquiLabs
 * @summary `investment.auction-lifecycle.v1` → avisos a la Mype sobre su factura.
 *
 * Los eventos dirigidos a inversionistas (PartitionAdded, AuctionFullyFunded, Expired,
 * Cancelled, Closed) no se notifican todavía: Investment no publica sus investorId.
 */
export class AuctionLifecycleSubscriber extends NotificationEventSubscriber {
  readonly topic = AUCTION_LIFECYCLE_TOPIC;

  protected toCommand(
    event: NormalizedIntegrationEvent,
  ): SendNotificationCommand | null {
    if (
      event.eventType !== 'AuctionRejected' &&
      event.eventType !== 'AuctionPublished'
    ) {
      return this.ignore(event);
    }
    if (!this.requireV1(event, event.eventType)) return null;

    if (event.eventType === 'AuctionRejected') {
      const rejected = this.parse(
        AuctionRejectedContract,
        event.data,
        event.eventType,
      );
      return rejected
        ? SendNotificationCommandFromInvestmentEventAssembler.toCommandFromAuctionRejected(
            event.eventId,
            rejected,
          )
        : null;
    }
    const published = this.parse(
      AuctionPublishedContract,
      event.data,
      event.eventType,
    );
    return published
      ? SendNotificationCommandFromInvestmentEventAssembler.toCommandFromAuctionPublished(
          event.eventId,
          published,
        )
      : null;
  }
}
