import { z } from 'zod';

/**
 * Contrato: "Eventos de integración hacia Kafka" en
 * vankoo-finance-service/docs/contracts/finance-contracts.md. El tipo viaja en la
 * cabecera `event-type` (nombre de la clase) y el id en `event-id`.
 */
export const FINANCE_EVENTS_TOPIC = 'vankoo.finance.events.v1';

export const DEPOSIT_OUTCOME_EVENT_TYPES = [
  'DepositSucceededEvent',
  'DepositFailedEvent',
  'DepositCancelledEvent',
] as const;

/**
 * @author LiquiLabs
 * @summary Desenlace de una recarga: el registro de dominio de Finance tal cual.
 *
 * `accountId` es el userId del inversionista y `amountMinor` está en céntimos.
 */
export const DepositOutcomeContract = z.object({
  depositId: z.string().min(1),
  accountId: z.string().min(1),
  amountMinor: z.number().int(),
  currency: z.string().min(1),
  failureReason: z.string().nullish(),
  cancellationReason: z.string().nullish(),
});

/** @author LiquiLabs */
export type DepositOutcomeEvent = z.infer<typeof DepositOutcomeContract>;
