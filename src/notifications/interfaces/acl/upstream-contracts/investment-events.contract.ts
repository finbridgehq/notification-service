import { z } from 'zod';

/** Contrato: vankoo-investment-service/docs/contracts/auction-lifecycle/v1. */
export const AUCTION_LIFECYCLE_TOPIC = 'investment.auction-lifecycle.v1';

/**
 * @author LiquiLabs
 * @summary `data` de `AuctionRejected`: la evaluación de riesgo rechazó la factura.
 */
export const AuctionRejectedContract = z.object({
  invoiceId: z.string().min(1),
  mypeId: z.string().min(1),
  reasonCode: z.string().nullish(),
  reason: z.string().nullish(),
});

/** @author LiquiLabs */
export type AuctionRejectedEvent = z.infer<typeof AuctionRejectedContract>;

/**
 * @author LiquiLabs
 * @summary `data` de `AuctionPublished`: la factura ya está en el marketplace.
 */
export const AuctionPublishedContract = z.object({
  invoiceId: z.string().min(1),
  mypeId: z.string().min(1),
  payerName: z.string().nullish(),
  targetAmount: z.number(),
  currency: z.string().min(1),
  expiresAt: z.string().nullish(),
});

/** @author LiquiLabs */
export type AuctionPublishedEvent = z.infer<typeof AuctionPublishedContract>;
