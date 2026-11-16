import type { SendNotificationCommand } from '../../domain/model/commands/send-notification.command';
import type { NormalizedIntegrationEvent } from '../acl/integration-event-envelope.normalizer';
import {
  COMPANY_VERIFICATIONS_TOPIC,
  CompanyVerificationIssuedContract,
} from '../acl/upstream-contracts/risk-events.contract';
import { NotificationEventSubscriber } from './notification-event.subscriber';
import { SendNotificationCommandFromRiskEventAssembler } from './transform/send-notification-command-from-risk-event.assembler';

/**
 * @author LiquiLabs
 * @summary `risk.company-verifications.v1` → pedir a la Mype que corrija sus datos.
 */
export class CompanyVerificationsSubscriber extends NotificationEventSubscriber {
  readonly topic = COMPANY_VERIFICATIONS_TOPIC;

  protected toCommand(
    event: NormalizedIntegrationEvent,
  ): SendNotificationCommand | null {
    if (event.eventType !== 'CompanyVerificationIssued') {
      return this.ignore(event);
    }
    if (!this.requireV1(event, event.eventType)) return null;
    const verification = this.parse(
      CompanyVerificationIssuedContract,
      event.data,
      event.eventType,
    );
    if (!verification) return null;
    return (
      SendNotificationCommandFromRiskEventAssembler.toCommandFromCompanyVerificationIssued(
        event.eventId,
        verification,
      ) ?? this.ignore(event)
    );
  }
}
