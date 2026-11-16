import type { DeviceRegistration } from '../../../domain/model/aggregates/device-registration.aggregate';
import type { DeviceRegistrationResource } from '../resources/device-registration.resource';

/** @author LiquiLabs */
export class DeviceRegistrationResourceFromEntityAssembler {
  public static toResourceFromEntity(
    entity: DeviceRegistration,
  ): DeviceRegistrationResource {
    return {
      userId: entity.userId.value,
      platform: entity.platform,
      registeredAt: entity.registeredAt.toISOString(),
    };
  }
}
