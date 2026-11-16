import type { IntegrationMessage } from '../../shared/interfaces/events/integration-event-subscriber';

/**
 * @author LiquiLabs
 * @summary Ejemplos de los eventos de otros servicios, copiados de sus contratos:
 * - IAM: UserCreatedEvent (vankoo-iam-service)
 * - Profile: docs/contracts/profile-events.md
 * - Risk: docs/contracts/{company-verifications,green-certifications}/v1/*.json
 * - Investment: docs/contracts/auction-lifecycle/v1/examples/*.json
 * - Finance: docs/contracts/finance-contracts.md (cabeceras event-*)
 * - Invoicing: InvoiceEligibleForFundingIntegrationEvent (PascalCase)
 */
export const MYPE_USER_ID = '40000000-0000-4000-8000-000000000001';
export const INVESTOR_USER_ID = '40000000-0000-4000-8000-000000000009';

export function message(
  topic: string,
  value: unknown,
  headers: Record<string, string> = {},
): IntegrationMessage {
  return { topic, partition: 0, offset: '42', key: null, value, headers };
}

export const userCreatedEvent = {
  id: INVESTOR_USER_ID,
  email: 'inversor@vankoo.test',
  roles: ['ROLE_INVESTOR'],
};

export const investorKycVerifiedEvent = {
  eventType: 'KycVerified',
  profileType: 'INVESTOR',
  investorId: '60000000-0000-4000-8000-000000000001',
  userId: INVESTOR_USER_ID,
  email: 'inversor@vankoo.test',
  kycStatus: 'VERIFIED',
};

export const investorKycRejectedEvent = {
  ...investorKycVerifiedEvent,
  eventType: 'KycRejected',
  kycStatus: 'REJECTED',
  reason: 'La foto del DNI no es legible',
};

export const companyKycStatusChangedEvent = {
  eventId: '72000000-0000-4000-8000-000000000001',
  eventType: 'CompanyKycStatusChanged',
  schemaVersion: 1,
  occurredAt: '2026-10-29T18:00:05.000Z',
  profileType: 'COMPANY',
  companyId: '50000000-0000-4000-8000-000000000002',
  userId: MYPE_USER_ID,
  kycStatus: 'VERIFIED',
};

export const companyVerificationIssuedEvent = {
  eventId: '91000000-0000-4000-8000-000000000001',
  eventType: 'CompanyVerificationIssued',
  schemaVersion: 1,
  occurredAt: '2026-10-29T18:00:00.000Z',
  data: {
    verificationId: 'kyc-3f1b6a0e-2c4d-4e8f-9a1b-5c6d7e8f9a0b',
    requestId: '70000000-0000-4000-8000-000000000001',
    companyId: '50000000-0000-4000-8000-000000000002',
    userId: MYPE_USER_ID,
    decision: 'CORRECTION_REQUIRED',
    checks: [],
    reasonCodes: ['NAME_MISMATCH'],
    fieldErrors: [
      { field: 'businessName', code: 'NAME_MISMATCH' },
      { field: 'legalAddress', code: 'ADDRESS_MISMATCH' },
    ],
    evidence: [],
    demo: false,
    decidedAt: '2026-10-29T18:00:00.000Z',
    rulesVersion: 'kyc-v1',
  },
};

export const greenCertificationIssuedEvent = {
  eventId: '90000000-0000-4000-8000-000000000001',
  eventType: 'GreenCertificationIssued',
  schemaVersion: 1,
  occurredAt: '2026-10-16T18:00:00.000Z',
  data: {
    certificationId: 'green-0b6f1c9e-4d2a-4f7b-9a51-2e8d3c7f6a10',
    submissionId: '80000000-0000-4000-8000-000000000001',
    companyId: '50000000-0000-4000-8000-000000000001',
    mypeUserId: MYPE_USER_ID,
    decision: 'GREEN',
    standard: 'ISO_14001',
    issuer: 'SGS del Perú S.A.C.',
    validUntil: '2028-03-31',
    criteria: [],
    reasonCodes: [],
    decidedAt: '2026-10-16T18:00:00.000Z',
    rulesVersion: 'green-v1',
  },
};

export const auctionRejectedEvent = {
  eventId: '10000000-0000-4000-8000-000000000009',
  eventType: 'AuctionRejected',
  schemaVersion: 1,
  aggregateId: '20000000-0000-4000-8000-000000000004',
  sequence: 2,
  occurredAt: '2026-09-14T15:00:05Z',
  data: {
    invoiceId: '30000000-0000-4000-8000-000000000004',
    mypeId: MYPE_USER_ID,
    assessmentId: '50000000-0000-4000-8000-000000000002',
    reasonCode: 'PAYER_NOT_ACTIVE',
    reason: 'El pagador no figura como contribuyente activo en SUNAT.',
    status: 'REJECTED',
  },
};

export const auctionPublishedEvent = {
  eventId: '10000000-0000-4000-8000-000000000002',
  eventType: 'AuctionPublished',
  schemaVersion: 1,
  aggregateId: '20000000-0000-4000-8000-000000000001',
  sequence: 2,
  occurredAt: '2026-09-14T16:00:00Z',
  data: {
    invoiceId: '30000000-0000-4000-8000-000000000001',
    mypeId: MYPE_USER_ID,
    payerRuc: '20123456789',
    payerName: 'Pagador S.A.',
    dueDate: '2026-10-14',
    invoiceAmount: 10000.0,
    fundableAmount: 10000.0,
    targetAmount: 9884.0,
    currentFunding: 0.0,
    currency: 'PEN',
    riskGrade: 'B',
    status: 'PUBLISHED',
    greenCertified: true,
    publishedAt: '2026-09-14T16:00:00Z',
    expiresAt: '2026-09-21T16:00:00Z',
  },
};

export const depositSucceededEvent = {
  depositId: 'dep-0001',
  accountId: INVESTOR_USER_ID,
  amountMinor: 150050,
  currency: 'PEN',
  provider: 'STRIPE',
};

export const financeHeaders = (eventType: string) => ({
  'event-type': eventType,
  'event-version': '1',
  'event-id': 'a1000000-0000-4000-8000-000000000001',
  'aggregate-type': 'Deposit',
  'aggregate-id': 'dep-0001',
  'occurred-at': '2026-11-01T12:00:00Z',
  'correlation-id': 'corr-1',
  'content-type': 'application/json',
});

export const invoiceEligibleForFundingEvent = {
  EventId: 'b2000000-0000-4000-8000-000000000001',
  OccurredOn: '2026-11-01T12:00:00Z',
  InvoiceId: '30000000-0000-4000-8000-000000000001',
  MypeId: MYPE_USER_ID,
  PayerRuc: '20123456789',
  PayerName: 'Pagador S.A.',
  DueDate: '2026-12-01T00:00:00Z',
  Currency: 'PEN',
  TotalAmount: 10000.5,
};
