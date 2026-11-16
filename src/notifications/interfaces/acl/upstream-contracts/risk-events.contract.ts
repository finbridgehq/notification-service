import { z } from 'zod';

/** Contratos en vankoo-risk-service/docs/contracts/{company-verifications,green-certifications}/v1. */
export const COMPANY_VERIFICATIONS_TOPIC = 'risk.company-verifications.v1';
export const GREEN_CERTIFICATIONS_TOPIC = 'risk.green-certifications.v1';

/**
 * @author LiquiLabs
 * @summary `data` de `CompanyVerificationIssued` v1: la decisión del KYC de la empresa.
 */
export const CompanyVerificationIssuedContract = z.object({
  verificationId: z.string().min(1),
  companyId: z.string().min(1),
  userId: z.string().min(1),
  decision: z.enum(['VERIFIED', 'REJECTED', 'CORRECTION_REQUIRED']),
  fieldErrors: z
    .array(z.object({ field: z.string(), code: z.string() }))
    .default([]),
});

/** @author LiquiLabs */
export type CompanyVerificationIssuedEvent = z.infer<
  typeof CompanyVerificationIssuedContract
>;

/**
 * @author LiquiLabs
 * @summary `data` de `GreenCertificationIssued` v1: la decisión sobre el certificado verde.
 */
export const GreenCertificationIssuedContract = z.object({
  certificationId: z.string().min(1),
  companyId: z.string().min(1),
  mypeUserId: z.string().min(1),
  decision: z.enum(['GREEN', 'NOT_GREEN']),
  standard: z.string().nullish(),
  validUntil: z.string().nullish(),
});

/** @author LiquiLabs */
export type GreenCertificationIssuedEvent = z.infer<
  typeof GreenCertificationIssuedContract
>;
