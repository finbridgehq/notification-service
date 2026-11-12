import type { SendNotificationCommand } from '../../domain/model/commands/send-notification.command';
import type { NormalizedIntegrationEvent } from '../acl/integration-event-envelope.normalizer';
import {
  GREEN_CERTIFICATIONS_TOPIC,
  GreenCertificationIssuedContract,
} from '../acl/upstream-contracts/risk-events.contract';
import { NotificationEventSubscriber } from './notification-event.subscriber';
import { SendNotificationCommandFromRiskEventAssembler } from './transform/send-notification-command-from-risk-event.assembler';

/**
 * @author LiquiLabs
 * @summary `risk.green-certifications.v1` → resultado del certificado verde de la Mype.
 */
export class GreenCertificationsSubscriber extends NotificationEventSubscriber {
  readonly topic = GREEN_CERTIFICATIONS_TOPIC;

  protected toCommand(
    event: NormalizedIntegrationEvent,
  ): SendNotificationCommand | null {
    if (event.eventType !== 'GreenCertificationIssued') {
      return this.ignore(event);
    }
    if (!this.requireV1(event, event.eventType)) return null;
    const certification = this.parse(
      GreenCertificationIssuedContract,
      event.data,
      event.eventType,
    );
    if (!certification) return null;
    return SendNotificationCommandFromRiskEventAssembler.toCommandFromGreenCertificationIssued(
      event.eventId,
      certification,
    );
  }
}
