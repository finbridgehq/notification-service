import type { Transporter } from 'nodemailer';
import { ExternalServiceError } from '../../../shared/application/errors/external-service.error';
import type { EmailAddress } from '../../domain/model/valueobjects/email-address.vo';
import type { NotificationContent } from '../../domain/model/valueobjects/notification-content.vo';
import type { IEmailSender } from '../../domain/services/email-sender';
import { renderEmailHtml, renderEmailText } from './email-layout';

/**
 * @author LiquiLabs
 * @summary Envía los emails por SMTP con nodemailer.
 *
 * En local apunta a Mailpit (docker-compose de vankoo-infra, UI en localhost:8025);
 * desplegado, a cualquier proveedor SMTP (Azure Communication Services, SendGrid…).
 */
export class SmtpEmailSender implements IEmailSender {
  constructor(
    private readonly transporter: Transporter,
    private readonly from: string,
  ) {}

  async send(to: EmailAddress, content: NotificationContent): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: to.value,
        subject: content.title,
        text: renderEmailText(content),
        html: renderEmailHtml(content),
      });
    } catch (error) {
      throw new ExternalServiceError('SMTP', (error as Error).message, {
        cause: error,
      });
    }
  }
}
