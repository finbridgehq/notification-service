import type { EmailAddress } from '../model/valueobjects/email-address.vo';
import type { RecipientId } from '../model/valueobjects/recipient-id.vo';

/**
 * @author LiquiLabs
 * @summary Puerto para averiguar el email de un destinatario cuando el evento no lo trae.
 *
 * Devuelve `null` si el usuario no tiene un email conocido; lanza si el origen de los
 * datos no está disponible, para que el evento se reintente.
 */
export interface IRecipientDirectory {
  findEmail(recipientId: RecipientId): Promise<EmailAddress | null>;
}
