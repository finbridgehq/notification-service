import { z } from 'zod';
import { NotificationAudience } from '../../../domain/model/entities/notification-type-definition.entity';
import { NotificationChannel } from '../../../domain/model/valueobjects/notification-channel.enum';
import { NotificationType } from '../../../domain/model/valueobjects/notification-type.enum';

/**
 * @author LiquiLabs
 * @summary Un tipo de notificación del catálogo.
 */
export const NotificationTypeResource = z
  .object({
    type: z.enum(NotificationType),
    name: z.string().meta({ example: 'Recarga acreditada' }),
    description: z.string(),
    audience: z.enum(NotificationAudience),
    channels: z.array(z.enum(NotificationChannel)),
    sourceEvent: z
      .string()
      .meta({ example: 'vankoo.finance.events.v1 · DepositSucceededEvent' }),
  })
  .meta({ id: 'NotificationTypeResource' });

/** @author LiquiLabs */
export type NotificationTypeResource = z.infer<typeof NotificationTypeResource>;
