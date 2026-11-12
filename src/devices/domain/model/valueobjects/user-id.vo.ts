import { DomainError } from '../../../../shared/domain/model/domain.error';

/**
 * @author LiquiLabs
 * @summary Id del usuario en IAM, dueño del dispositivo.
 */
export class UserId {
  public readonly value: string;

  constructor(value: string) {
    const id = value?.trim() ?? '';
    if (id === '' || id.length > 128) {
      throw new DomainError(
        'INVALID_USER_ID',
        'El id del usuario no es válido',
      );
    }
    this.value = id;
  }
}
