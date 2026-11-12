import { SendNotificationCommand } from '../../../domain/model/commands/send-notification.command';
import { NotificationChannelPolicy } from '../../../domain/model/valueobjects/notification-channel-policy';
import { NotificationType } from '../../../domain/model/valueobjects/notification-type.enum';
import type { UserCreatedEvent } from '../../acl/upstream-contracts/iam-events.contract';

/** @author LiquiLabs */
export type WelcomeRole = 'MYPE' | 'INVESTOR';

/** @author LiquiLabs */
export class SendNotificationCommandFromIamEventAssembler {
  /** Rol para la bienvenida, o `null` si el usuario no es Mype ni inversionista. */
  public static toWelcomeRole(event: UserCreatedEvent): WelcomeRole | null {
    if (event.roles.includes('ROLE_MYPE')) return 'MYPE';
    if (event.roles.includes('ROLE_INVESTOR')) return 'INVESTOR';
    return null;
  }

  public static toCommandFromUserCreated(
    event: UserCreatedEvent,
    role: WelcomeRole,
  ): SendNotificationCommand {
    const type = NotificationType.USER_WELCOME;
    // IAM no publica eventId: un usuario se crea una sola vez, así que su id basta.
    return new SendNotificationCommand(
      `iam:UserCreated:${event.id}`,
      type,
      event.id,
      NotificationChannelPolicy.channelsFor(type),
      { role },
      event.email,
    );
  }
}
