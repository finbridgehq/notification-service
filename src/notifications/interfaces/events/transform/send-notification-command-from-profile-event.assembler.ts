import { SendNotificationCommand } from '../../../domain/model/commands/send-notification.command';
import { NotificationChannelPolicy } from '../../../domain/model/valueobjects/notification-channel-policy';
import { NotificationType } from '../../../domain/model/valueobjects/notification-type.enum';
import type {
  CompanyKycStatusChangedEvent,
  InvestorKycDecisionEvent,
} from '../../acl/upstream-contracts/profile-events.contract';

/** @author LiquiLabs */
export class SendNotificationCommandFromProfileEventAssembler {
  public static toCommandFromInvestorKycDecision(
    event: InvestorKycDecisionEvent,
  ): SendNotificationCommand {
    const type =
      event.eventType === 'KycVerified'
        ? NotificationType.INVESTOR_KYC_VERIFIED
        : NotificationType.INVESTOR_KYC_REJECTED;
    // Estos eventos no traen eventId: la clave es la decisión misma. Un nuevo rechazo
    // con otro motivo se notifica; el mismo mensaje repetido, no.
    const sourceEventKey = [
      'profile',
      event.eventType,
      event.userId,
      event.kycStatus ?? '',
      (event.reason ?? '').slice(0, 120),
    ].join(':');
    return new SendNotificationCommand(
      sourceEventKey,
      type,
      event.userId,
      NotificationChannelPolicy.channelsFor(type),
      { reason: event.reason },
      event.email,
    );
  }

  /** Solo VERIFIED y REJECTED se notifican; los estados intermedios devuelven `null`. */
  public static toCommandFromCompanyKycStatusChanged(
    event: CompanyKycStatusChangedEvent,
  ): SendNotificationCommand | null {
    const type =
      event.kycStatus === 'VERIFIED'
        ? NotificationType.COMPANY_KYC_VERIFIED
        : event.kycStatus === 'REJECTED'
          ? NotificationType.COMPANY_KYC_REJECTED
          : null;
    if (!type) return null;
    return new SendNotificationCommand(
      event.eventId,
      type,
      event.userId,
      NotificationChannelPolicy.channelsFor(type),
      { companyId: event.companyId },
    );
  }
}
