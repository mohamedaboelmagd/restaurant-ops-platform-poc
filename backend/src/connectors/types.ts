import type { CanonicalLoyaltyDraft, CanonicalOrderDraft, CanonicalShiftDraft, ConnectorKind, NormalizeResult } from '../domain/types';

export interface Connector<TRaw, TDraft> {
  kind: ConnectorKind;
  vendor: string;
  normalize(payload: TRaw): NormalizeResult<TDraft>;
}

export interface PosTicketRaw {
  ticket_id: string;
  store_code: string;
  opened_at?: string;
  closed_at: string;
  guests?: number;
  service?: string;
  items: { sku?: string; item_name: string; qty: number; unit_price: string | number; category?: string }[];
  totals?: { subtotal?: string | number; tax?: string | number; discount?: string | number; grand?: string | number };
  currency?: string;
  voided?: boolean;
}

export interface HrShiftRaw {
  shift_id: string;
  site: string;
  employee_code: string;
  employee_name?: string;
  role: string;
  clock_in: string;
  clock_out: string;
  wage_per_hour: string | number;
}

export interface LoyaltyEventRaw {
  event_id: string;
  store: string;
  member_id: string;
  member_name?: string;
  event: string;
  pts: number;
  ticket_ref?: string;
  ts: string;
}

export type AnyDraft = CanonicalOrderDraft | CanonicalShiftDraft | CanonicalLoyaltyDraft;
