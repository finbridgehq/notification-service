import { NotificationChannel } from './notification-channel.enum';
import { NotificationType } from './notification-type.enum';

const { EMAIL, PUSH } = NotificationChannel;

/**
 * La Mype usa el web (sin FCM en el C4): todo le llega por email. El inversionista usa
 * el mobile: push, y además email cuando el evento ya trae su dirección.
 */
const CHANNELS_BY_TYPE: Record<
  NotificationType,
  readonly NotificationChannel[]
> = {
  [NotificationType.USER_WELCOME]: [EMAIL],
  [NotificationType.INVESTOR_KYC_VERIFIED]: [PUSH, EMAIL],
  [NotificationType.INVESTOR_KYC_REJECTED]: [PUSH, EMAIL],
  [NotificationType.COMPANY_KYC_VERIFIED]: [EMAIL],
  [NotificationType.COMPANY_KYC_REJECTED]: [EMAIL],
  [NotificationType.COMPANY_VERIFICATION_CORRECTION_REQUIRED]: [EMAIL],
  [NotificationType.GREEN_CERTIFICATION_GRANTED]: [EMAIL],
  [NotificationType.GREEN_CERTIFICATION_DENIED]: [EMAIL],
  [NotificationType.INVOICE_RECEIVED]: [EMAIL],
  [NotificationType.INVOICE_REJECTED]: [EMAIL],
  [NotificationType.AUCTION_PUBLISHED]: [EMAIL],
  [NotificationType.DEPOSIT_SUCCEEDED]: [PUSH],
  [NotificationType.DEPOSIT_FAILED]: [PUSH],
  [NotificationType.DEPOSIT_CANCELLED]: [PUSH],
};

/**
 * @author LiquiLabs
 * @summary Regla de negocio: por qué canales se envía cada tipo de notificación.
 */
export class NotificationChannelPolicy {
  static channelsFor(type: NotificationType): NotificationChannel[] {
    return [...CHANNELS_BY_TYPE[type]];
  }
}
