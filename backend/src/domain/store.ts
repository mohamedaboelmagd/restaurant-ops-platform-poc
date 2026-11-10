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

export interface ResolveLocation {
  byCode(tenantId: string, code: string): Location | undefined;
  byId(tenantId: string, id: string): Location | undefined;
}

export interface OpsStore {
  listTenants(): Tenant[];
  getTenant(id: string): Tenant | undefined;
  findTenantByApiKey(apiKey: string): Tenant | undefined;
  getSnapshot(tenantId: string): TenantSnapshot | undefined;
  listLocations(tenantId: string): Location[];
  listBrands(tenantId: string): Brand[];
  listConnectors(tenantId: string): ConnectorAccount[];
  resolveLocation: ResolveLocation;
  listOrders(tenantId: string, locationId?: string): Order[];
  listShifts(tenantId: string, locationId?: string): LaborShift[];
  listCustomers(tenantId: string): Customer[];
  listLoyaltyEvents(tenantId: string, locationId?: string): LoyaltyEvent[];
  findIngestion(tenantId: string, connector: IngestionRecord['connector'], externalId: string): IngestionRecord | undefined;
  ingestOrders(tenantId: string, drafts: CanonicalOrderDraft[], hashes: string[]): IngestResult;
  ingestShifts(tenantId: string, drafts: CanonicalShiftDraft[], hashes: string[]): IngestResult;
  ingestLoyalty(tenantId: string, drafts: CanonicalLoyaltyDraft[], hashes: string[]): IngestResult;
  markConnectorSync(tenantId: string, kind: ConnectorAccount['kind'], at: string): void;
  resetDemo(tenantId: string): void;
}
