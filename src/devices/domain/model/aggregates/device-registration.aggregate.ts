import { RegisterDeviceCommand } from '../commands/register-device.command';
import { DevicePlatform } from '../valueobjects/device-platform.enum';
import { DeviceToken } from '../valueobjects/device-token.vo';
import { UserId } from '../valueobjects/user-id.vo';

/**
 * @author LiquiLabs
 * @summary Agregado raíz: un dispositivo suscrito a las notificaciones push de su usuario.
 *
 * No se persiste: quien guarda la relación dispositivo-usuario es Firebase, a través
 * del topic del usuario. El agregado valida la registración antes de pedírsela.
 */
export class DeviceRegistration {
  private constructor(
    public readonly userId: UserId,
    public readonly deviceToken: DeviceToken,
    public readonly platform: DevicePlatform,
    public readonly registeredAt: Date,
  ) {}

  static register(
    command: RegisterDeviceCommand,
    now: Date = new Date(),
  ): DeviceRegistration {
    return new DeviceRegistration(
      new UserId(command.userId),
      new DeviceToken(command.deviceToken),
      command.platform,
      now,
    );
  }
}
