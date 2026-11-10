import { parseAmountToMinor } from '../domain/money';
import { payloadHash } from '../domain/hash';
import type { CanonicalOrderDraft, Channel, NormalizeResult } from '../domain/types';
import type { Connector, PosTicketRaw } from './types';

const CHANNELS: Record<string, Channel> = {
  dine_in: 'dine_in',
  'dine-in': 'dine_in',
  indoor: 'dine_in',
  takeaway: 'takeaway',
  pickup: 'takeaway',
  take_out: 'takeaway',
  delivery: 'delivery',
  deliv: 'delivery',
};

function mapChannel(raw?: string): Channel {
  if (!raw) return 'dine_in';
  return CHANNELS[raw.trim().toLowerCase().replace(/\s+/g, '_')] ?? 'dine_in';
}

export function hashPosTicket(raw: PosTicketRaw): string {
  return payloadHash('pos', raw.ticket_id, raw.store_code, raw.closed_at, raw.totals, raw.items);
}

export const posConnector: Connector<PosTicketRaw, CanonicalOrderDraft> = {
  kind: 'pos',
  vendor: 'mock-pos',
  normalize(payload: PosTicketRaw): NormalizeResult<CanonicalOrderDraft> {
    const externalId = String(payload?.ticket_id ?? '').trim();
    if (!externalId) return { ok: false, externalId: '', message: 'ticket_id is required' };
    if (!payload.store_code) return { ok: false, externalId, message: 'store_code is required' };
    if (!payload.closed_at || Number.isNaN(Date.parse(payload.closed_at))) {
      return { ok: false, externalId, message: 'closed_at must be an ISO timestamp' };
    }
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      return { ok: false, externalId, message: 'items must be a non-empty array' };
    }
    try {
      const items = payload.items.map((item, idx) => {
        const qty = Number(item.qty);
        if (!Number.isFinite(qty) || qty <= 0) throw new Error(`item[${idx}].qty must be > 0`);
        const unit = parseAmountToMinor(item.unit_price);
        return {
          sku: item.sku?.trim() || `sku-${idx + 1}`,
          name: item.item_name?.trim() || 'Unknown item',
          quantity: qty,
          unitPriceMinor: unit,
          totalMinor: Math.round(unit * qty),
          category: item.category?.trim() || 'uncategorized',
        };
      });
      const subtotalFromItems = items.reduce((sum, i) => sum + i.totalMinor, 0);
      const subtotalMinor = payload.totals?.subtotal != null ? parseAmountToMinor(payload.totals.subtotal) : subtotalFromItems;
      const taxMinor = payload.totals?.tax != null ? parseAmountToMinor(payload.totals.tax) : Math.round(subtotalMinor * 0.14);
      const discountMinor = payload.totals?.discount != null ? parseAmountToMinor(payload.totals.discount) : 0;
      const totalMinor =
        payload.totals?.grand != null
          ? parseAmountToMinor(payload.totals.grand)
          : subtotalMinor + taxMinor - discountMinor;
      const openedAt = payload.opened_at && !Number.isNaN(Date.parse(payload.opened_at)) ? payload.opened_at : payload.closed_at;
      return {
        ok: true,
        value: {
          externalId,
          locationCode: String(payload.store_code),
          openedAt,
          closedAt: payload.closed_at,
          guestCount: Math.max(1, Number(payload.guests) || 1),
          channel: mapChannel(payload.service),
          subtotalMinor,
          taxMinor,
          discountMinor,
          totalMinor,
          currency: payload.currency ?? 'EGP',
          status: payload.voided ? 'voided' : 'closed',
          items,
        },
      };
    } catch (err) {
      return { ok: false, externalId, message: err instanceof Error ? err.message : 'invalid POS payload' };
    }
  },
};
