import type { Logger } from '../../../shared/infrastructure/logging/logger';
import type { EmailAddress } from '../../domain/model/valueobjects/email-address.vo';
import type { NotificationContent } from '../../domain/model/valueobjects/notification-content.vo';
import type { IEmailSender } from '../../domain/services/email-sender';

/**
 * @author LiquiLabs
 * @summary EMAIL_PROVIDER=logging: escribe el email en el log en vez de enviarlo (útil sin Mailpit).
 */
export class LoggingEmailSender implements IEmailSender {
  constructor(private readonly logger: Logger) {}

  send(to: EmailAddress, content: NotificationContent): Promise<void> {
    this.logger.info(
      { to: to.value, subject: content.title, body: content.body },
      '[email:logging] Email',
    );
    return Promise.resolve();
  }
}
