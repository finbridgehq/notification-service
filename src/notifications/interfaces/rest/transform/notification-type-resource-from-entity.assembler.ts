import type { NotificationTypeDefinition } from '../../../domain/model/entities/notification-type-definition.entity';
import type { NotificationTypeResource } from '../resources/notification-type.resource';

/** @author LiquiLabs */
export class NotificationTypeResourceFromEntityAssembler {
  public static toResourceFromEntity(
    entity: NotificationTypeDefinition,
  ): NotificationTypeResource {
    return {
      type: entity.type,
      name: entity.name,
      description: entity.description,
      audience: entity.audience,
      channels: [...entity.channels],
      sourceEvent: entity.sourceEvent,
    };
  }
}
