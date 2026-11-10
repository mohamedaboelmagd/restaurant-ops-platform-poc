export type Channel = 'dine_in' | 'takeaway' | 'delivery';
export type OrderStatus = 'closed' | 'voided';
export type ConnectorKind = 'pos' | 'hr' | 'loyalty';
export type ConnectorStatus = 'connected' | 'idle' | 'error';
export type LoyaltyEventType = 'earn' | 'redeem';
export type AnomalySeverity = 'info' | 'warning' | 'critical';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  apiKey: string;
  webhookSecret: string;
}

export interface Brand {
  id: string;
  tenantId: string;
  name: string;
}

export interface Location {
  id: string;
  tenantId: string;
  brandId: string;
  name: string;
  city: string;
  timezone: string;
  externalCodes: string[];
}

export interface ConnectorAccount {
  id: string;
  tenantId: string;
  kind: ConnectorKind;
  name: string;
  status: ConnectorStatus;
  lastSyncAt: string | null;
}

export interface LineItem {
  id: string;
  orderId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  totalMinor: number;
  category: string;
}

export interface Order {
  id: string;
  tenantId: string;
  locationId: string;
  source: 'pos';
  externalId: string;
  openedAt: string;
  closedAt: string;
  guestCount: number;
  channel: Channel;
  subtotalMinor: number;
  taxMinor: number;
  discountMinor: number;
  totalMinor: number;
  currency: string;
  status: OrderStatus;
  items: LineItem[];
}

export interface LaborShift {
  id: string;
  tenantId: string;
  locationId: string;
  source: 'hr';
  externalId: string;
  employeeExternalId: string;
  employeeName: string;
  role: string;
  startedAt: string;
  endedAt: string;
  hours: number;
  hourlyRateMinor: number;
  laborCostMinor: number;
}

export interface Customer {
  id: string;
  tenantId: string;
  loyaltyExternalId: string;
  displayName: string;
  visits: number;
  points: number;
  lastVisitAt: string | null;
}

export interface LoyaltyEvent {
  id: string;
  tenantId: string;
  locationId: string;
  source: 'loyalty';
  externalId: string;
  customerId: string;
  type: LoyaltyEventType;
  points: number;
  orderExternalId: string | null;
  at: string;
}

export interface IngestionRecord {
  tenantId: string;
  connector: ConnectorKind;
  externalId: string;
  payloadHash: string;
  entityId: string;
  ingestedAt: string;
}

export interface IngestResult {
  accepted: number;
  replayed: number;
  rejected: number;
  errors: { externalId: string; message: string }[];
}

export interface Kpis {
  netSalesMinor: number;
  voidedMinor: number;
  orderCount: number;
  avgTicketMinor: number;
  covers: number;
  laborCostMinor: number;
  laborHours: number;
  laborCostPct: number;
  loyaltyMembers: number;
  loyaltyEarn: number;
  loyaltyRedeem: number;
}

export interface LocationKpis extends Kpis {
  locationId: string;
  locationName: string;
  brandName: string;
  city: string;
}

export interface HourBucket {
  hour: number;
  salesMinor: number;
  orders: number;
}

export interface DailySales {
  date: string;
  salesMinor: number;
  orders: number;
  laborCostMinor: number;
}

export interface Anomaly {
  id: string;
  severity: AnomalySeverity;
  locationId: string;
  locationName: string;
  title: string;
  detail: string;
  metric: string;
  value: string;
}

export interface Insights {
  generatedAt: string;
  currency: string;
  period: { from: string; to: string };
  filter: { locationId: string | null };
  totals: Kpis;
  byLocation: LocationKpis[];
  peakHours: HourBucket[];
  daily: DailySales[];
  anomalies: Anomaly[];
}

export interface AskResult {
  question: string;
  answer: string;
  bullets: string[];
  engine: 'rules' | 'llm';
}

export interface TenantSnapshot {
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

export interface CanonicalOrderDraft {
  externalId: string;
  locationCode: string;
  openedAt: string;
  closedAt: string;
  guestCount: number;
  channel: Channel;
  subtotalMinor: number;
  taxMinor: number;
  discountMinor: number;
  totalMinor: number;
  currency: string;
  status: OrderStatus;
  items: Omit<LineItem, 'id' | 'orderId'>[];
}

export interface CanonicalShiftDraft {
  externalId: string;
  locationCode: string;
  employeeExternalId: string;
  employeeName: string;
  role: string;
  startedAt: string;
  endedAt: string;
  hourlyRateMinor: number;
}

export interface CanonicalLoyaltyDraft {
  externalId: string;
  locationCode: string;
  memberExternalId: string;
  displayName: string;
  type: LoyaltyEventType;
  points: number;
  orderExternalId: string | null;
  at: string;
}

export type NormalizeOk<T> = { ok: true; value: T };
export type NormalizeErr = { ok: false; externalId: string; message: string };
export type NormalizeResult<T> = NormalizeOk<T> | NormalizeErr;
