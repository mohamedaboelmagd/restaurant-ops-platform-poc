import { hashHrShift, hrConnector } from '../connectors/hr';
import { hashLoyaltyEvent, loyaltyConnector } from '../connectors/loyalty';
import { hashPosTicket, posConnector } from '../connectors/pos';
import type { HrShiftRaw, LoyaltyEventRaw, PosTicketRaw } from '../connectors/types';
import type { OpsStore } from './store';
import type { ConnectorKind, IngestResult, NormalizeResult } from './types';

function partition<T>(results: NormalizeResult<T>[]): { drafts: T[]; hashes: string[]; rejected: IngestResult } {
  const drafts: T[] = [];
  const rejected: IngestResult = { accepted: 0, replayed: 0, rejected: 0, errors: [] };
  for (const row of results) {
    if (row.ok) drafts.push(row.value);
    else {
      rejected.rejected += 1;
      rejected.errors.push({ externalId: row.externalId, message: row.message });
    }
  }
  return { drafts, hashes: [], rejected };
}

function merge(a: IngestResult, b: IngestResult): IngestResult {
  return {
    accepted: a.accepted + b.accepted,
    replayed: a.replayed + b.replayed,
    rejected: a.rejected + b.rejected,
    errors: [...a.errors, ...b.errors],
  };
}

export function ingestPosTickets(store: OpsStore, tenantId: string, payloads: PosTicketRaw[]): IngestResult {
  const parsed = payloads.map((p) => posConnector.normalize(p));
  const { drafts, rejected } = partition(parsed);
  const hashes = payloads
    .map((p, i) => (parsed[i].ok ? hashPosTicket(p) : null))
    .filter((h): h is string => h != null);
  const saved = store.ingestOrders(tenantId, drafts, hashes);
  if (saved.accepted + saved.replayed > 0) store.markConnectorSync(tenantId, 'pos', new Date().toISOString());
  return merge(rejected, saved);
}

export function ingestHrShifts(store: OpsStore, tenantId: string, payloads: HrShiftRaw[]): IngestResult {
  const parsed = payloads.map((p) => hrConnector.normalize(p));
  const { drafts, rejected } = partition(parsed);
  const hashes = payloads
    .map((p, i) => (parsed[i].ok ? hashHrShift(p) : null))
    .filter((h): h is string => h != null);
  const saved = store.ingestShifts(tenantId, drafts, hashes);
  if (saved.accepted + saved.replayed > 0) store.markConnectorSync(tenantId, 'hr', new Date().toISOString());
  return merge(rejected, saved);
}

export function ingestLoyaltyEvents(store: OpsStore, tenantId: string, payloads: LoyaltyEventRaw[]): IngestResult {
  const parsed = payloads.map((p) => loyaltyConnector.normalize(p));
  const { drafts, rejected } = partition(parsed);
  const hashes = payloads
    .map((p, i) => (parsed[i].ok ? hashLoyaltyEvent(p) : null))
    .filter((h): h is string => h != null);
  const saved = store.ingestLoyalty(tenantId, drafts, hashes);
  if (saved.accepted + saved.replayed > 0) store.markConnectorSync(tenantId, 'loyalty', new Date().toISOString());
  return merge(rejected, saved);
}

export function ingestByKind(
  store: OpsStore,
  tenantId: string,
  kind: ConnectorKind,
  payloads: unknown[],
): IngestResult {
  if (kind === 'pos') return ingestPosTickets(store, tenantId, payloads as PosTicketRaw[]);
  if (kind === 'hr') return ingestHrShifts(store, tenantId, payloads as HrShiftRaw[]);
  return ingestLoyaltyEvents(store, tenantId, payloads as LoyaltyEventRaw[]);
}
