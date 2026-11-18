import { createHash } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../utils/AppError';
import document from '../legal/consent-v1.json';

export type ConsentPurpose = keyof typeof document.purposes;
export const CONSENT_VERSION = document.version;

export function consentSchema(purpose: ConsentPurpose) {
  return z.object({
    accepted: z.literal(true),
    version: z.literal(CONSENT_VERSION),
    purpose: z.literal(purpose),
  });
}

export function consentProof(purpose: ConsentPurpose) {
  // Hash the immutable source text, never client-supplied text or a client timestamp.
  const snapshot = { version: CONSENT_VERSION, operator: document.operator, common: document.common, scope: document.purposes[purpose] };
  return {
    accepted: true,
    version: CONSENT_VERSION,
    purpose,
    document: '/consent.html#' + purpose,
    sha256: createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),
  };
}

export function requireConsent(value: unknown, purpose: ConsentPurpose) {
  if (!consentSchema(purpose).safeParse(value).success) {
    throw new AppError('Обновите страницу и подтвердите отдельное согласие на обработку данных.', 422);
  }
}
