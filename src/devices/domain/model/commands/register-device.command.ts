import { DomainError } from '../../../../shared/domain/model/domain.error';
import { DevicePlatform } from '../valueobjects/device-platform.enum';

/**
 * @author LiquiLabs
 * @summary Registrar el dispositivo de un usuario para que reciba sus notificaciones push.
 */
export class RegisterDeviceCommand {
  constructor(
    public readonly userId: string,
    public readonly deviceToken: string,
    public readonly platform: DevicePlatform,
  ) {
    if (!Object.values(DevicePlatform).includes(platform)) {
      throw new DomainError(
        'INVALID_DEVICE_PLATFORM',
        `La plataforma debe ser ${Object.values(DevicePlatform).join(' o ')}`,
      );
    }
  }
}
