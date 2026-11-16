import { z } from 'zod';

/** Topic de IAM. Contrato: UserCreatedEvent en vankoo-iam-service (sin envelope ni eventId). */
export const IAM_EVENTS_TOPIC = 'vankoo.iam.events';

/**
 * @author LiquiLabs
 * @summary `UserCreatedEvent` de IAM: `{ id, email, roles }`.
 */
export const UserCreatedContract = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
  roles: z.array(z.string()),
});

/** @author LiquiLabs */
export type UserCreatedEvent = z.infer<typeof UserCreatedContract>;
