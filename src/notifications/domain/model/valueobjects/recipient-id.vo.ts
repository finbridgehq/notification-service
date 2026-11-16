import { DomainError } from '../../../../shared/domain/model/domain.error';

/**
 * @author LiquiLabs
 * @summary Id en IAM del usuario que recibe la notificación.
 *
 * Todos los servicios usan el mismo: `mypeId` (Investment, Invoicing), `userId`
 * (Profile, Risk) y `accountId` (Finance) son el id del usuario en IAM.
 */
export class RecipientId {
  public readonly value: string;

  constructor(value: string) {
    const id = value?.trim() ?? '';
    if (id === '' || id.length > 128) {
      throw new DomainError(
        'INVALID_RECIPIENT_ID',
        'El id del destinatario no es válido',
      );
    }
    this.value = id;
  }
}
