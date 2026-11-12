import { DomainError } from '../../../../shared/domain/model/domain.error';

/** Un token de registro de FCM: letras, dígitos, `:`, `-` y `_`. */
const DEVICE_TOKEN_PATTERN = /^[A-Za-z0-9:_-]+$/;
const MIN_LENGTH = 20;
const MAX_LENGTH = 4096;

/**
 * @author LiquiLabs
 * @summary Token de registro de Firebase Cloud Messaging de un dispositivo.
 */
export class DeviceToken {
  public readonly value: string;

  constructor(value: string) {
    const token = value?.trim() ?? '';
    if (
      token.length < MIN_LENGTH ||
      token.length > MAX_LENGTH ||
      !DEVICE_TOKEN_PATTERN.test(token)
    ) {
      throw new DomainError(
        'INVALID_DEVICE_TOKEN',
        'El token del dispositivo no tiene el formato de un token de FCM',
      );
    }
    this.value = token;
  }

  /** Para logs: nunca se escribe el token completo. */
  masked(): string {
    return `…${this.value.slice(-6)}`;
  }
}
