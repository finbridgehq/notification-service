import type { TemplateVariables } from '../model/commands/send-notification.command';
import type { NotificationTypeDefinition } from '../model/entities/notification-type-definition.entity';
import type { NotificationContent } from '../model/valueobjects/notification-content.vo';
import type { NotificationType } from '../model/valueobjects/notification-type.enum';

/**
 * @author LiquiLabs
 * @summary Puerto de las plantillas: el texto de cada tipo de notificación.
 */
export interface INotificationTemplateCatalog {
  render(
    type: NotificationType,
    variables: TemplateVariables,
  ): NotificationContent;
  definitions(): NotificationTypeDefinition[];
}
