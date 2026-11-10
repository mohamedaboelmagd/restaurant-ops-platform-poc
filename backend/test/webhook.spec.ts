import { signWebhook, verifyWebhookSignature } from '../src/connectors/webhook';

describe('webhook signatures', () => {
  const secret = 'whsec_demo_northshore';
  const body = JSON.stringify({ ticket_id: 'T-1' });

  it('accepts a matching HMAC-SHA256 signature', () => {
    const sig = signWebhook(body, secret, '1700000000');
    expect(verifyWebhookSignature(body, sig, secret, '1700000000')).toBe(true);
  });

  it('rejects a tampered body, a wrong secret, or a missing header', () => {
    const sig = signWebhook(body, secret);
    expect(verifyWebhookSignature('{"ticket_id":"NOPE"}', sig, secret)).toBe(false);
    expect(verifyWebhookSignature(body, sig, 'other-secret')).toBe(false);
    expect(verifyWebhookSignature(body, undefined, secret)).toBe(false);
    expect(verifyWebhookSignature(body, 'sha256=00', secret)).toBe(false);
  });
});
