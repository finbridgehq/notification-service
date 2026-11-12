import { DomainError } from '../../../../shared/domain/model/domain.error';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @author LiquiLabs
 * @summary Dirección de email del destinatario.
 */
export class EmailAddress {
  public readonly value: string;

  constructor(value: string) {
    const address = value?.trim().toLowerCase() ?? '';
    if (address.length > 254 || !EMAIL_PATTERN.test(address)) {
      throw new DomainError(
        'INVALID_EMAIL_ADDRESS',
        'El email del destinatario no es válido',
      );
    }
    this.value = address;
  }

  /** Para eventos con un email que puede venir vacío o mal escrito. */
  static tryCreate(value: string | null | undefined): EmailAddress | null {
    if (!value) return null;
    try {
      return new EmailAddress(value);
    } catch {
      return null;
    }
  }
}
