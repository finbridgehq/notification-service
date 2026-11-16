import type { NotificationTypeDefinition } from '../model/entities/notification-type-definition.entity';
import type { GetAllNotificationTypesQuery } from '../model/queries/get-all-notification-types.query';

/** @author LiquiLabs */
export interface INotificationQueryService {
  handleGetAllNotificationTypes(
    query: GetAllNotificationTypesQuery,
  ): NotificationTypeDefinition[];
}
