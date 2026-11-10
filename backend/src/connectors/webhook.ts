import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * HMAC-SHA256 webhook signature.
 * Header format: `x-webhook-signature: sha256=<hex>`
 * Signed payload is `${timestamp}.${rawBody}` when a timestamp is provided, otherwise the raw body.
 */
export function signWebhook(rawBody: string, secret: string, timestamp?: string): string {
  const payload = timestamp ? `${timestamp}.${rawBody}` : rawBody;
  return `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
}

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
  timestamp?: string,
): boolean {
  if (!signatureHeader || !secret) return false;
  const expected = signWebhook(rawBody, secret, timestamp);
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
