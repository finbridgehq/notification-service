/**
 * @author LiquiLabs
 * @summary Estado de la entrega en cada canal.
 */
export enum DeliveryStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  /** No hacía falta o no se podía: ya se había entregado, o no hay email del destinatario. */
  SKIPPED = 'SKIPPED',
  FAILED = 'FAILED',
}
