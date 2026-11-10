import { payloadHash } from '../domain/hash';
import type { CanonicalLoyaltyDraft, LoyaltyEventType, NormalizeResult } from '../domain/types';
import type { Connector, LoyaltyEventRaw } from './types';

function mapType(raw: string): LoyaltyEventType | null {
  const v = raw.trim().toLowerCase();
  if (['earn', 'accrual', 'collect', 'points_in'].includes(v)) return 'earn';
  if (['redeem', 'burn', 'spend', 'points_out'].includes(v)) return 'redeem';
  return null;
}

export function hashLoyaltyEvent(raw: LoyaltyEventRaw): string {
  return payloadHash('loyalty', raw.event_id, raw.member_id, raw.event, raw.pts, raw.ts);
}

export const loyaltyConnector: Connector<LoyaltyEventRaw, CanonicalLoyaltyDraft> = {
  kind: 'loyalty',
  vendor: 'mock-loyalty',
  normalize(payload: LoyaltyEventRaw): NormalizeResult<CanonicalLoyaltyDraft> {
    const externalId = String(payload?.event_id ?? '').trim();
    if (!externalId) return { ok: false, externalId: '', message: 'event_id is required' };
    if (!payload.store) return { ok: false, externalId, message: 'store is required' };
    if (!payload.member_id) return { ok: false, externalId, message: 'member_id is required' };
    if (!payload.ts || Number.isNaN(Date.parse(payload.ts))) {
      return { ok: false, externalId, message: 'ts must be an ISO timestamp' };
    }
    const type = mapType(String(payload.event ?? ''));
    if (!type) return { ok: false, externalId, message: `unknown loyalty event type: ${payload.event}` };
    if (!Number.isFinite(Number(payload.pts)) || Number(payload.pts) <= 0) {
      return { ok: false, externalId, message: 'pts must be a positive number' };
    }
    return {
      ok: true,
      value: {
        externalId,
        locationCode: String(payload.store),
        memberExternalId: String(payload.member_id),
        displayName: payload.member_name?.trim() || `Sample member ${payload.member_id}`,
        type,
        points: Math.round(Number(payload.pts)),
        orderExternalId: payload.ticket_ref ? String(payload.ticket_ref) : null,
        at: payload.ts,
      },
    };
  },
};
