/**
 * @author LiquiLabs
 * @summary Puerto de idempotencia: recuerda qué entregas ya se hicieron.
 *
 * Kafka entrega al menos una vez, así que el mismo evento puede llegar repetido. Cada
 * clave es `<evento de origen>#<canal>`, de modo que un reintento no repite un canal
 * que ya se entregó.
 */
export interface IProcessedEventRegistry {
  has(key: string): boolean;
  markProcessed(key: string): void;
}
