import { EmailAddress } from '../../../../domain/model/valueobjects/email-address.vo';
import type { RecipientId } from '../../../../domain/model/valueobjects/recipient-id.vo';
import type { IRecipientDirectory } from '../../../../domain/services/recipient-directory';
import type { IProfileContactClient } from './profile-contact-client';

/**
 * @author LiquiLabs
 * @summary Anti-Corruption Layer hacia Profile: traduce su empresa a nuestro EmailAddress.
 *
 * Solo las Mypes necesitan esta consulta: sus eventos (KYC de la empresa, Risk, Invoicing,
 * Investment) traen el userId pero no el email. Los del inversionista que van por email
 * (bienvenida, KYC) ya traen el email en el evento, y los de Finance van solo por push.
 * Si Profile cambia su recurso, solo cambia esta clase y el cliente HTTP.
 */
export class ExternalProfileService implements IRecipientDirectory {
  constructor(private readonly profileContactClient: IProfileContactClient) {}

  async findEmail(recipientId: RecipientId): Promise<EmailAddress | null> {
    const contact = await this.profileContactClient.fetchCompanyContact(
      recipientId.value,
    );
    return EmailAddress.tryCreate(contact?.contactEmail);
  }
}
