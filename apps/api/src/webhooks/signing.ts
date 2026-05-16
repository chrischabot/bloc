import { createHmac, timingSafeEqual } from 'node:crypto';

const SIGNATURE_HEADER = 'x-notion-signature';
const VERIFICATION_HEADER = 'notion-webhook-verification';

export function signBody(signingSecret: string, rawBody: string): string {
  const hex = createHmac('sha256', signingSecret).update(rawBody, 'utf8').digest('hex');
  return `sha256=${hex}`;
}

export function verifySignature(signingSecret: string, rawBody: string, header: string): boolean {
  const expected = signBody(signingSecret, rawBody);
  if (expected.length !== header.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(header));
}

export const HEADER_SIGNATURE = SIGNATURE_HEADER;
export const HEADER_VERIFICATION = VERIFICATION_HEADER;
