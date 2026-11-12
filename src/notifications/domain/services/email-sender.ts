import type { EmailAddress } from '../model/valueobjects/email-address.vo';
import type { NotificationContent } from '../model/valueobjects/notification-content.vo';

/**
 * @author LiquiLabs
 * @summary Puerto del canal email.
 */
export interface IEmailSender {
  send(to: EmailAddress, content: NotificationContent): Promise<void>;
}
