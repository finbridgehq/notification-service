import type { IntegrationMessage } from '../../../shared/interfaces/events/integration-event-subscriber';

/**
 * @author LiquiLabs
 * @summary Un evento de otro bounded context, ya en un formato único.
 */
export interface NormalizedIntegrationEvent {
  eventId: string | null;
  eventType: string | null;
  schemaVersion: number | null;
  occurredAt: string | null;
  data: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

const asNumber = (value: unknown): number | null => {
  const number = typeof value === 'string' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) ? number : null;
};

/** `EventId` → `eventId`. Invoicing (.NET) publica en PascalCase. */
const camelCaseKeys = (value: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(value).map(([key, field]) => [
      key.charAt(0).toLowerCase() + key.slice(1),
      field,
    ]),
  );

/**
 * @author LiquiLabs
 * @summary Anti-Corruption Layer de entrada: unifica los tres formatos de evento de Vankoo.
 *
 * 1. Envelope `{ eventId, eventType, schemaVersion, occurredAt, data }`: Investment y Risk.
 * 2. Metadatos en cabeceras (`event-type`, `event-id`, `event-version`, `occurred-at`) y
 *    el registro de dominio como valor: Finance.
 * 3. JSON plano: Profile y IAM en camelCase (IAM sin `eventType` ni `eventId`) e
 *    Invoicing en PascalCase.
 *
 * Así cada subscriber valida solo los campos de negocio de su contrato.
 */
export class IntegrationEventEnvelopeNormalizer {
  static normalize(
    message: IntegrationMessage,
  ): NormalizedIntegrationEvent | null {
    const { value, headers } = message;
    if (!isRecord(value)) return null;

    if (asString(value.eventType) && isRecord(value.data)) {
      return {
        eventId: asString(value.eventId),
        eventType: asString(value.eventType),
        schemaVersion: asNumber(value.schemaVersion),
        occurredAt: asString(value.occurredAt),
        data: value.data,
      };
    }

    const headerEventType = asString(headers['event-type']);
    if (headerEventType) {
      return {
        eventId: asString(headers['event-id']),
        eventType: headerEventType,
        schemaVersion: asNumber(headers['event-version']),
        occurredAt: asString(headers['occurred-at']),
        data: value,
      };
    }

    const data = camelCaseKeys(value);
    return {
      eventId: asString(data.eventId),
      eventType: asString(data.eventType),
      schemaVersion: asNumber(data.schemaVersion),
      occurredAt: asString(data.occurredAt) ?? asString(data.occurredOn),
      data,
    };
  }
}
