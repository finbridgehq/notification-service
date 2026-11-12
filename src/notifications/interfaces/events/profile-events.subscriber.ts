import type { SendNotificationCommand } from '../../domain/model/commands/send-notification.command';
import type { NormalizedIntegrationEvent } from '../acl/integration-event-envelope.normalizer';
import {
  CompanyKycStatusChangedContract,
  InvestorKycDecisionContract,
  PROFILE_EVENTS_TOPIC,
} from '../acl/upstream-contracts/profile-events.contract';
import { NotificationEventSubscriber } from './notification-event.subscriber';
import { SendNotificationCommandFromProfileEventAssembler } from './transform/send-notification-command-from-profile-event.assembler';

/**
 * @author LiquiLabs
 * @summary `vankoo.profile.events` → decisiones de KYC del inversionista y de la empresa.
 *
 * Para las empresas se usa solo `CompanyKycStatusChanged`, que cubre la decisión del
 * risk-service y la manual. Los `KycVerified`/`KycRejected` de empresas se ignoran para no
 * notificar dos veces la misma decisión.
 */
export class ProfileEventsSubscriber extends NotificationEventSubscriber {
  readonly topic = PROFILE_EVENTS_TOPIC;

  protected toCommand(
    event: NormalizedIntegrationEvent,
  ): SendNotificationCommand | null {
    switch (event.eventType) {
      case 'KycVerified':
      case 'KycRejected': {
        const decision = this.parse(
          InvestorKycDecisionContract,
          event.data,
          event.eventType,
        );
        if (!decision || decision.profileType !== 'INVESTOR') {
          return decision ? this.ignore(event) : null;
        }
        return SendNotificationCommandFromProfileEventAssembler.toCommandFromInvestorKycDecision(
          decision,
        );
      }
      case 'CompanyKycStatusChanged': {
        const change = this.parse(
          CompanyKycStatusChangedContract,
          event.data,
          event.eventType,
        );
        if (!change) return null;
        return (
          SendNotificationCommandFromProfileEventAssembler.toCommandFromCompanyKycStatusChanged(
            change,
          ) ?? this.ignore(event)
        );
      }
      default:
        return this.ignore(event);
    }
  }
}
