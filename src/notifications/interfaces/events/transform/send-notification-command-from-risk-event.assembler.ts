import { SendNotificationCommand } from '../../../domain/model/commands/send-notification.command';
import { NotificationChannelPolicy } from '../../../domain/model/valueobjects/notification-channel-policy';
import { NotificationType } from '../../../domain/model/valueobjects/notification-type.enum';
import type {
  CompanyVerificationIssuedEvent,
  GreenCertificationIssuedEvent,
} from '../../acl/upstream-contracts/risk-events.contract';

/** Nombres de los campos del perfil de la empresa, como los ve la Mype. */
const COMPANY_FIELD_LABELS: Record<string, string> = {
  rucNumber: 'RUC',
  businessName: 'razón social',
  legalAddress: 'domicilio fiscal',
  industrySector: 'sector',
  contactPhone: 'teléfono',
  rucDocument: 'ficha RUC',
};

/** @author LiquiLabs */
export class SendNotificationCommandFromRiskEventAssembler {
  /**
   * Solo CORRECTION_REQUIRED: VERIFIED y REJECTED ya se notifican con el
   * CompanyKycStatusChanged que Profile publica al aplicarlos.
   */
  public static toCommandFromCompanyVerificationIssued(
    eventId: string,
    event: CompanyVerificationIssuedEvent,
  ): SendNotificationCommand | null {
    if (event.decision !== 'CORRECTION_REQUIRED') return null;
    const type = NotificationType.COMPANY_VERIFICATION_CORRECTION_REQUIRED;
    const fields = [
      ...new Set(
        event.fieldErrors.map(
          ({ field }) => COMPANY_FIELD_LABELS[field] ?? field,
        ),
      ),
    ].join(', ');
    return new SendNotificationCommand(
      eventId,
      type,
      event.userId,
      NotificationChannelPolicy.channelsFor(type),
      { fields, companyId: event.companyId },
    );
  }

  public static toCommandFromGreenCertificationIssued(
    eventId: string,
    event: GreenCertificationIssuedEvent,
  ): SendNotificationCommand {
    const type =
      event.decision === 'GREEN'
        ? NotificationType.GREEN_CERTIFICATION_GRANTED
        : NotificationType.GREEN_CERTIFICATION_DENIED;
    return new SendNotificationCommand(
      eventId,
      type,
      event.mypeUserId,
      NotificationChannelPolicy.channelsFor(type),
      {
        standard: event.standard?.replace(/_/g, ' '),
        validUntil: event.validUntil,
        companyId: event.companyId,
      },
    );
  }
}
