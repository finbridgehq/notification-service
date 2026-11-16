import { DeviceRegistration } from '../../../domain/model/aggregates/device-registration.aggregate';
import type { RegisterDeviceCommand } from '../../../domain/model/commands/register-device.command';
import type { UnregisterDeviceCommand } from '../../../domain/model/commands/unregister-device.command';
import { DeviceToken } from '../../../domain/model/valueobjects/device-token.vo';
import { UserId } from '../../../domain/model/valueobjects/user-id.vo';
import type { IDeviceCommandService } from '../../../domain/services/device-command.service';
import type { IPushSubscriptionGateway } from '../../../domain/services/push-subscription-gateway';

/**
 * @author LiquiLabs
 * @summary Casos de uso de escritura de los dispositivos: registrar y dar de baja.
 */
export class DeviceCommandServiceImpl implements IDeviceCommandService {
  constructor(
    private readonly pushSubscriptionGateway: IPushSubscriptionGateway,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async handleRegisterDevice(
    command: RegisterDeviceCommand,
  ): Promise<DeviceRegistration> {
    const registration = DeviceRegistration.register(command, this.clock());
    await this.pushSubscriptionGateway.subscribe(
      registration.userId,
      registration.deviceToken,
    );
    return registration;
  }

  async handleUnregisterDevice(
    command: UnregisterDeviceCommand,
  ): Promise<void> {
    await this.pushSubscriptionGateway.unsubscribe(
      new UserId(command.userId),
      new DeviceToken(command.deviceToken),
    );
  }
}
