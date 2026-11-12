import type { NotificationTypeDefinition } from '../../../domain/model/entities/notification-type-definition.entity';
import type { GetAllNotificationTypesQuery } from '../../../domain/model/queries/get-all-notification-types.query';
import type { INotificationQueryService } from '../../../domain/services/notification-query.service';
import type { INotificationTemplateCatalog } from '../../../domain/services/notification-template-catalog';

/**
 * @author LiquiLabs
 * @summary Caso de uso de lectura: el catálogo de tipos de notificación.
 */
export class NotificationQueryServiceImpl implements INotificationQueryService {
  constructor(private readonly templateCatalog: INotificationTemplateCatalog) {}

  handleGetAllNotificationTypes(
    _query: GetAllNotificationTypesQuery,
  ): NotificationTypeDefinition[] {
    return this.templateCatalog.definitions();
  }
}
