import { RegisterDeviceCommand } from '../../../domain/model/commands/register-device.command';
import type { RegisterDeviceResource } from '../resources/register-device.resource';

/** @author LiquiLabs */
export class RegisterDeviceCommandFromResourceAssembler {
  public static toCommandFromResource(
    userId: string,
    resource: RegisterDeviceResource,
  ): RegisterDeviceCommand {
    return new RegisterDeviceCommand(
      userId,
      resource.deviceToken,
      resource.platform,
    );
  }
}
