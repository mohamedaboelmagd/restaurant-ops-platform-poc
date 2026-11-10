import { hoursBetween } from './money';
import { stableId } from './ids';
import type { OpsStore } from './store';
import type {
  Brand,
  CanonicalLoyaltyDraft,
  CanonicalOrderDraft,
  CanonicalShiftDraft,
  ConnectorAccount,
  Customer,
  IngestResult,
  IngestionRecord,
  LaborShift,
  Location,
  LoyaltyEvent,
  Order,
  Tenant,
  TenantSnapshot,
} from './types';

interface MutableSnapshot {
  tenant: Tenant;
  brands: Brand[];
  locations: Location[];
  connectors: ConnectorAccount[];
  orders: Order[];
  shifts: LaborShift[];
  customers: Customer[];
  loyaltyEvents: LoyaltyEvent[];
  ingestions: IngestionRecord[];
}

export class MemoryStore implements OpsStore {
  private tenants = new Map<string, MutableSnapshot>();

  constructor(snapshots: TenantSnapshot[] = []) {
    for (const snap of snapshots) this.load(snap);
  }

  load(snap: TenantSnapshot): void {
    this.tenants.set(snap.tenant.id, structuredClone(snap));
  }

  listTenants(): Tenant[] {
    return [...this.tenants.values()].map((s) => s.tenant);
  }

  getTenant(id: string): Tenant | undefined {
    return this.tenants.get(id)?.tenant;
  }

  findTenantByApiKey(apiKey: string): Tenant | undefined {
    for (const s of this.tenants.values()) {
      if (s.tenant.apiKey === apiKey) return s.tenant;
    }
    return undefined;
  }

  getSnapshot(tenantId: string): TenantSnapshot | undefined {
    const s = this.tenants.get(tenantId);
    return s ? structuredClone(s) : undefined;
  }

  private require(tenantId: string): MutableSnapshot {
    const s = this.tenants.get(tenantId);
    if (!s) throw new Error(`unknown tenant`);
    return s;
  }

  listLocations(tenantId: string): Location[] {
    return [...this.require(tenantId).locations];
  }

  listBrands(tenantId: string): Brand[] {
    return [...this.require(tenantId).brands];
  }

  listConnectors(tenantId: string): ConnectorAccount[] {
    return [...this.require(tenantId).connectors];
  }

  resolveLocation = {
    byCode: (tenantId: string, code: string): Location | undefined => {
      const needle = code.trim().toLowerCase();
      return this.require(tenantId).locations.find(
        (l) => l.id === code || l.externalCodes.some((c) => c.toLowerCase() === needle),
      );
    },
    byId: (tenantId: string, id: string): Location | undefined => {
      return this.require(tenantId).locations.find((l) => l.id === id);
    },
  };

  listOrders(tenantId: string, locationId?: string): Order[] {
    const rows = this.require(tenantId).orders;
    return locationId ? rows.filter((r) => r.locationId === locationId) : [...rows];
  }

  listShifts(tenantId: string, locationId?: string): LaborShift[] {
    const rows = this.require(tenantId).shifts;
    return locationId ? rows.filter((r) => r.locationId === locationId) : [...rows];
  }

  listCustomers(tenantId: string): Customer[] {
    return [...this.require(tenantId).customers];
  }

  listLoyaltyEvents(tenantId: string, locationId?: string): LoyaltyEvent[] {
    const rows = this.require(tenantId).loyaltyEvents;
    return locationId ? rows.filter((r) => r.locationId === locationId) : [...rows];
  }

  findIngestion(tenantId: string, connector: IngestionRecord['connector'], externalId: string): IngestionRecord | undefined {
    return this.require(tenantId).ingestions.find(
      (i) => i.connector === connector && i.externalId === externalId,
    );
  }

  ingestOrders(tenantId: string, drafts: CanonicalOrderDraft[], hashes: string[]): IngestResult {
    return this.ingest(tenantId, 'pos', drafts, hashes, (s, draft, hash) => {
      const location = this.resolveLocation.byCode(tenantId, draft.locationCode);
      if (!location) return { error: `unknown location code: ${draft.locationCode}` };
      const id = stableId('ord', tenantId, draft.externalId);
      const order: Order = {
        id,
        tenantId,
        locationId: location.id,
        source: 'pos',
        externalId: draft.externalId,
        openedAt: draft.openedAt,
        closedAt: draft.closedAt,
        guestCount: draft.guestCount,
        channel: draft.channel,
        subtotalMinor: draft.subtotalMinor,
        taxMinor: draft.taxMinor,
        discountMinor: draft.discountMinor,
        totalMinor: draft.totalMinor,
        currency: draft.currency,
        status: draft.status,
        items: draft.items.map((item, idx) => ({
          ...item,
          id: stableId('li', tenantId, draft.externalId, String(idx)),
          orderId: id,
        })),
      };
      s.orders.push(order);
      return { entityId: id, hash };
    });
  }

  ingestShifts(tenantId: string, drafts: CanonicalShiftDraft[], hashes: string[]): IngestResult {
    return this.ingest(tenantId, 'hr', drafts, hashes, (s, draft, hash) => {
      const location = this.resolveLocation.byCode(tenantId, draft.locationCode);
      if (!location) return { error: `unknown location code: ${draft.locationCode}` };
      const hours = hoursBetween(draft.startedAt, draft.endedAt);
      const id = stableId('sft', tenantId, draft.externalId);
      const shift: LaborShift = {
        id,
        tenantId,
        locationId: location.id,
        source: 'hr',
        externalId: draft.externalId,
        employeeExternalId: draft.employeeExternalId,
        employeeName: draft.employeeName,
        role: draft.role,
        startedAt: draft.startedAt,
        endedAt: draft.endedAt,
        hours,
        hourlyRateMinor: draft.hourlyRateMinor,
        laborCostMinor: Math.round(hours * draft.hourlyRateMinor),
      };
      s.shifts.push(shift);
      return { entityId: id, hash };
    });
  }

  ingestLoyalty(tenantId: string, drafts: CanonicalLoyaltyDraft[], hashes: string[]): IngestResult {
    return this.ingest(tenantId, 'loyalty', drafts, hashes, (s, draft, hash) => {
      const location = this.resolveLocation.byCode(tenantId, draft.locationCode);
      if (!location) return { error: `unknown location code: ${draft.locationCode}` };
      let customer = s.customers.find((c) => c.loyaltyExternalId === draft.memberExternalId);
      if (!customer) {
        customer = {
          id: stableId('cus', tenantId, draft.memberExternalId),
          tenantId,
          loyaltyExternalId: draft.memberExternalId,
          displayName: draft.displayName,
          visits: 0,
          points: 0,
          lastVisitAt: null,
        };
        s.customers.push(customer);
      }
      customer.points += draft.type === 'earn' ? draft.points : -draft.points;
      if (draft.type === 'earn') customer.visits += 1;
      customer.lastVisitAt = draft.at;
      const id = stableId('loy', tenantId, draft.externalId);
      const event: LoyaltyEvent = {
        id,
        tenantId,
        locationId: location.id,
        source: 'loyalty',
        externalId: draft.externalId,
        customerId: customer.id,
        type: draft.type,
        points: draft.points,
        orderExternalId: draft.orderExternalId,
        at: draft.at,
      };
      s.loyaltyEvents.push(event);
      return { entityId: id, hash };
    });
  }

  markConnectorSync(tenantId: string, kind: ConnectorAccount['kind'], at: string): void {
    const row = this.require(tenantId).connectors.find((c) => c.kind === kind);
    if (row) {
      row.lastSyncAt = at;
      row.status = 'connected';
    }
  }

  resetDemo(tenantId: string): void {
    const current = this.require(tenantId);
    this.tenants.set(tenantId, current); // caller replaces via load()
  }

  cloneOf(tenantId: string): TenantSnapshot {
    return structuredClone(this.require(tenantId));
  }

  private ingest<T extends { externalId: string }>(
    tenantId: string,
    connector: IngestionRecord['connector'],
    drafts: T[],
    hashes: string[],
    apply: (s: MutableSnapshot, draft: T, hash: string) => { entityId: string; hash: string } | { error: string },
  ): IngestResult {
    const s = this.require(tenantId);
    const result: IngestResult = { accepted: 0, replayed: 0, rejected: 0, errors: [] };
    drafts.forEach((draft, i) => {
      const hash = hashes[i] ?? '';
      const prior = s.ingestions.find((row) => row.connector === connector && row.externalId === draft.externalId);
      if (prior) {
        result.replayed += 1;
        return;
      }
      const applied = apply(s, draft, hash);
      if ('error' in applied) {
        result.rejected += 1;
        result.errors.push({ externalId: draft.externalId, message: applied.error });
        return;
      }
      s.ingestions.push({
        tenantId,
        connector,
        externalId: draft.externalId,
        payloadHash: applied.hash,
        entityId: applied.entityId,
        ingestedAt: new Date().toISOString(),
      });
      result.accepted += 1;
    });
    return result;
  }
}

export function emptySnapshot(tenant: Tenant, brands: Brand[], locations: Location[], connectors: ConnectorAccount[]): TenantSnapshot {
  return {
    tenant,
    brands,
    locations,
    connectors,
    orders: [],
    shifts: [],
    customers: [],
    loyaltyEvents: [],
    ingestions: [],
  };
}

