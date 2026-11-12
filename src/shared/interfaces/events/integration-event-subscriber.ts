/**
 * @author LiquiLabs
 * @summary Un mensaje de Kafka ya leído: el valor viene como JSON y las cabeceras como texto.
 */
export interface IntegrationMessage {
  topic: string;
  partition: number;
  offset: string;
  key: string | null;
  value: unknown;
  headers: Record<string, string>;
}

/**
 * @author LiquiLabs
 * @summary Lo que implementa cada subscriber de eventos de otro bounded context.
 *
 * Si `handle` lanza, el runner de Kafka reintenta y al final manda el mensaje a la
 * DLQ. Un mensaje que no cumple el contrato no debe lanzar: se registra y se ignora.
 */
export interface IntegrationEventSubscriber {
  readonly topic: string;
  handle(message: IntegrationMessage): Promise<void>;
}
