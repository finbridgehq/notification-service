import { z } from 'zod';

/**
 * Contrato: InvoiceEligibleForFundingIntegrationEvent en vankoo-invoicing-service. El
 * topic sale del nombre de la clase y el JSON viene en PascalCase; el normalizador lo
 * pasa a camelCase antes de validar.
 */
export const INVOICE_ELIGIBLE_FOR_FUNDING_TOPIC =
  'invoicing.invoice-eligible-for-funding';

/**
 * @author LiquiLabs
 * @summary La factura pasó la validación (OCR y SUNAT) y se envió a evaluación de riesgo.
 */
export const InvoiceEligibleForFundingContract = z.object({
  eventId: z.string().min(1),
  invoiceId: z.string().min(1),
  mypeId: z.string().min(1),
  payerName: z.string().nullish(),
  currency: z.string().min(1),
  totalAmount: z.number(),
});

/** @author LiquiLabs */
export type InvoiceEligibleForFundingEvent = z.infer<
  typeof InvoiceEligibleForFundingContract
>;
