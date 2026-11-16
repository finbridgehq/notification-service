import type { DeviceRegistration } from '../model/aggregates/device-registration.aggregate';
import type { RegisterDeviceCommand } from '../model/commands/register-device.command';
import type { UnregisterDeviceCommand } from '../model/commands/unregister-device.command';

/** @author LiquiLabs */
export interface IDeviceCommandService {
  handleRegisterDevice(
    command: RegisterDeviceCommand,
  ): Promise<DeviceRegistration>;
  handleUnregisterDevice(command: UnregisterDeviceCommand): Promise<void>;
}
