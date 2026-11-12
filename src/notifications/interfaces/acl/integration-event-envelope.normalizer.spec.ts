import {
  auctionPublishedEvent,
  depositSucceededEvent,
  financeHeaders,
  invoiceEligibleForFundingEvent,
  message,
  userCreatedEvent,
} from '../../../test-support/fixtures/upstream-events';
import { IntegrationEventEnvelopeNormalizer } from './integration-event-envelope.normalizer';

describe('IntegrationEventEnvelopeNormalizer', () => {
  it('desenvuelve el envelope { eventId, eventType, data } de Investment y Risk', () => {
    const event = IntegrationEventEnvelopeNormalizer.normalize(
      message('investment.auction-lifecycle.v1', auctionPublishedEvent),
    );
    expect(event).toEqual({
      eventId: auctionPublishedEvent.eventId,
      eventType: 'AuctionPublished',
      schemaVersion: 1,
      occurredAt: auctionPublishedEvent.occurredAt,
      data: auctionPublishedEvent.data,
    });
  });

  it('lee los metadatos de las cabeceras de Finance', () => {
    const event = IntegrationEventEnvelopeNormalizer.normalize(
      message(
        'vankoo.finance.events.v1',
        depositSucceededEvent,
        financeHeaders('DepositSucceededEvent'),
      ),
    );
    expect(event).toEqual({
      eventId: 'a1000000-0000-4000-8000-000000000001',
      eventType: 'DepositSucceededEvent',
      schemaVersion: 1,
      occurredAt: '2026-11-01T12:00:00Z',
      data: depositSucceededEvent,
    });
  });

  it('pasa a camelCase el JSON plano en PascalCase de Invoicing', () => {
    const event = IntegrationEventEnvelopeNormalizer.normalize(
      message(
        'invoicing.invoice-eligible-for-funding',
        invoiceEligibleForFundingEvent,
      ),
    );
    expect(event?.eventId).toBe(invoiceEligibleForFundingEvent.EventId);
    expect(event?.occurredAt).toBe(invoiceEligibleForFundingEvent.OccurredOn);
    expect(event?.data).toMatchObject({
      mypeId: invoiceEligibleForFundingEvent.MypeId,
      totalAmount: 10000.5,
    });
  });

  it('acepta el JSON plano de IAM, sin eventType ni eventId', () => {
    const event = IntegrationEventEnvelopeNormalizer.normalize(
      message('vankoo.iam.events', userCreatedEvent),
    );
    expect(event).toEqual({
      eventId: null,
      eventType: null,
      schemaVersion: null,
      occurredAt: null,
      data: userCreatedEvent,
    });
  });

  it('lee la versión aunque venga como texto', () => {
    const event = IntegrationEventEnvelopeNormalizer.normalize(
      message('t', { eventType: 'X', schemaVersion: '1', data: {} }),
    );
    expect(event?.schemaVersion).toBe(1);
  });

  it.each([[null], ['texto'], [[1, 2]], [42]])(
    'devuelve null si el valor no es un objeto (%p)',
    (value) => {
      expect(
        IntegrationEventEnvelopeNormalizer.normalize(message('t', value)),
      ).toBeNull();
    },
  );
});
