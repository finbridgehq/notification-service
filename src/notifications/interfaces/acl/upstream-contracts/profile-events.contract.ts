import { z } from 'zod';

/** Topic de Profile. Contrato: docs/contracts/profile-events.md en vankoo-profile-service. */
export const PROFILE_EVENTS_TOPIC = 'vankoo.profile.events';

/**
 * @author LiquiLabs
 * @summary `KycVerified` / `KycRejected` (sin versión): Profile los publica al decidir el KYC del inversionista.
 */
export const InvestorKycDecisionContract = z.object({
  eventType: z.enum(['KycVerified', 'KycRejected']),
  profileType: z.string(),
  investorId: z.string().optional(),
  userId: z.string().min(1),
  email: z.string().nullish(),
  kycStatus: z.string().nullish(),
  reason: z.string().nullish(),
});

/** @author LiquiLabs */
export type InvestorKycDecisionEvent = z.infer<
  typeof InvestorKycDecisionContract
>;

/**
 * @author LiquiLabs
 * @summary `CompanyKycStatusChanged` v1: el estado KYC de la empresa cambió.
 */
export const CompanyKycStatusChangedContract = z.object({
  eventId: z.string().min(1),
  schemaVersion: z.literal(1),
  companyId: z.string().min(1),
  userId: z.string().min(1),
  kycStatus: z.enum(['PENDING', 'IN_REVIEW', 'VERIFIED', 'REJECTED']),
});

/** @author LiquiLabs */
export type CompanyKycStatusChangedEvent = z.infer<
  typeof CompanyKycStatusChangedContract
>;
