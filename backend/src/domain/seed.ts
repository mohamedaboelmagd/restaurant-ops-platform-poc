import type { HrShiftRaw, LoyaltyEventRaw, PosTicketRaw } from '../connectors/types';
import { ingestHrShifts, ingestLoyaltyEvents, ingestPosTickets } from './ingest';
import { MemoryStore, emptySnapshot } from './memory-store';
import type { Brand, ConnectorAccount, Location, Tenant, TenantSnapshot } from './types';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function jitter(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

const DAY0 = '2026-10-27'; // fixed window so the demo is reproducible

function iso(dayOffset: number, hour: number, minute: number): string {
  const d = new Date(`${DAY0}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(hour, minute, Math.floor((hour * 17 + minute) % 50), 0);
  return d.toISOString();
}

interface MenuItem {
  sku: string;
  name: string;
  category: string;
  price: number;
}

const KITCHEN_MENU: MenuItem[] = [
  { sku: 'NSK-SAL', name: 'Citrus grilled salmon', category: 'mains', price: 385 },
  { sku: 'NSK-STK', name: 'Ribeye 300g', category: 'mains', price: 520 },
  { sku: 'NSK-PST', name: 'Truffle mushroom pasta', category: 'mains', price: 295 },
  { sku: 'NSK-BRG', name: 'Northshore smash burger (sample)', category: 'mains', price: 240 },
  { sku: 'NSK-SLD', name: 'Heritage grain salad', category: 'starters', price: 145 },
  { sku: 'NSK-SCP', name: 'Roasted tomato soup', category: 'starters', price: 95 },
  { sku: 'NSK-DST', name: 'Dark chocolate tart', category: 'desserts', price: 120 },
  { sku: 'NSK-SOD', name: 'Sparkling citrus', category: 'beverages', price: 45 },
];

const ESPRESSO_MENU: MenuItem[] = [
  { sku: 'NSE-LAT', name: 'Oat latte', category: 'coffee', price: 85 },
  { sku: 'NSE-CAP', name: 'Cappuccino', category: 'coffee', price: 75 },
  { sku: 'NSE-CRS', name: 'Almond croissant', category: 'bakery', price: 65 },
  { sku: 'NSE-SND', name: 'Halloumi picnic sandwich', category: 'food', price: 145 },
  { sku: 'NSE-JUC', name: 'Cold-pressed orange', category: 'beverages', price: 70 },
];

const GRILL_MENU: MenuItem[] = [
  { sku: 'AG-MIX', name: 'Mixed grill platter', category: 'mains', price: 340 },
  { sku: 'AG-KFT', name: 'Charcoal kofta', category: 'mains', price: 210 },
  { sku: 'AG-FAT', name: 'Fattoush', category: 'starters', price: 90 },
  { sku: 'AG-RCE', name: 'Vermicelli rice', category: 'sides', price: 55 },
  { sku: 'AG-BKL', name: 'Baklava trio', category: 'desserts', price: 80 },
  { sku: 'AG-AYR', name: 'Ayran', category: 'beverages', price: 35 },
];

function makeConnectors(tenantId: string): ConnectorAccount[] {
  return [
    { id: `${tenantId}-pos`, tenantId, kind: 'pos', name: 'Mock POS feed', status: 'connected', lastSyncAt: null },
    { id: `${tenantId}-hr`, tenantId, kind: 'hr', name: 'Mock HR / timesheet feed', status: 'connected', lastSyncAt: null },
    { id: `${tenantId}-loy`, tenantId, kind: 'loyalty', name: 'Mock loyalty feed', status: 'connected', lastSyncAt: null },
  ];
}

const NORTHSHORE: { tenant: Tenant; brands: Brand[]; locations: Location[] } = {
  tenant: {
    id: 'ten_northshore',
    name: 'Northshore Dining Group',
    slug: 'northshore',
    apiKey: 'demo_northshore_key',
    webhookSecret: 'whsec_demo_northshore',
  },
  brands: [
    { id: 'br_nsk', tenantId: 'ten_northshore', name: 'Northshore Kitchen' },
    { id: 'br_nse', tenantId: 'ten_northshore', name: 'Northshore Espresso' },
  ],
  locations: [
    {
      id: 'loc_nsk_nc',
      tenantId: 'ten_northshore',
      brandId: 'br_nsk',
      name: 'New Cairo',
      city: 'New Cairo',
      timezone: 'Africa/Cairo',
      externalCodes: ['NSK-NC', 'new_cairo'],
    },
    {
      id: 'loc_nsk_md',
      tenantId: 'ten_northshore',
      brandId: 'br_nsk',
      name: 'Maadi',
      city: 'Maadi',
      timezone: 'Africa/Cairo',
      externalCodes: ['NSK-MD', 'maadi'],
    },
    {
      id: 'loc_nse_dt',
      tenantId: 'ten_northshore',
      brandId: 'br_nse',
      name: 'Downtown',
      city: 'Downtown Cairo',
      timezone: 'Africa/Cairo',
      externalCodes: ['NSE-DT', 'downtown'],
    },
  ],
};

const ATLAS: { tenant: Tenant; brands: Brand[]; locations: Location[] } = {
  tenant: {
    id: 'ten_atlas',
    name: 'Atlas Hospitality',
    slug: 'atlas',
    apiKey: 'demo_atlas_key',
    webhookSecret: 'whsec_demo_atlas',
  },
  brands: [{ id: 'br_ag', tenantId: 'ten_atlas', name: 'Atlas Grill' }],
  locations: [
    {
      id: 'loc_ag_hel',
      tenantId: 'ten_atlas',
      brandId: 'br_ag',
      name: 'Heliopolis',
      city: 'Heliopolis',
      timezone: 'Africa/Cairo',
      externalCodes: ['AG-HEL', 'heliopolis'],
    },
    {
      id: 'loc_ag_sz',
      tenantId: 'ten_atlas',
      brandId: 'br_ag',
      name: 'Sheikh Zayed',
      city: 'Sheikh Zayed',
      timezone: 'Africa/Cairo',
      externalCodes: ['AG-SZ', 'sheikh_zayed'],
    },
  ],
};

const SAMPLE_NAMES = [
  'Nour El-Sayed (sample)',
  'Karim Farid (sample)',
  'Lina Haddad (sample)',
  'Omar Saeed (sample)',
  'Maya Ibrahim (sample)',
  'Youssef Nabil (sample)',
  'Hana Mostafa (sample)',
  'Tarek Aziz (sample)',
];

interface LocationPlan {
  location: Location;
  menu: MenuItem[];
  code: string;
  seed: number;
  dailyOrders: number;
  lunchWeight: number;
  dinnerWeight: number;
  laborRate: number;
  laborHeads: number;
  dropDay?: number;
  laborMultiplier?: number;
}

function buildTickets(plan: LocationPlan): PosTicketRaw[] {
  const rng = mulberry32(plan.seed);
  const tickets: PosTicketRaw[] = [];
  for (let day = 0; day < 7; day++) {
    const count = Math.round(plan.dailyOrders * (plan.dropDay === day ? 0.52 : jitter(rng, 0.85, 1.12)));
    for (let i = 0; i < count; i++) {
      const dinner = rng() < plan.dinnerWeight;
      const hour = dinner ? Math.floor(jitter(rng, 18, 23)) : Math.floor(jitter(rng, 12, 16));
      const minute = Math.floor(rng() * 60);
      const closed = iso(day, hour, minute);
      const opened = iso(day, hour, Math.max(0, minute - Math.floor(jitter(rng, 25, 75))));
      const nItems = 1 + Math.floor(rng() * 4);
      const items = Array.from({ length: nItems }, (_, idx) => {
        const item = pick(rng, plan.menu);
        const qty = rng() < 0.15 ? 2 : 1;
        return { sku: item.sku, item_name: item.name, qty, unit_price: item.price.toFixed(2), category: item.category };
      });
      const subtotal = items.reduce((s, it) => s + Number(it.unit_price) * it.qty, 0);
      const discount = rng() < 0.08 ? Math.round(subtotal * 0.1 * 100) / 100 : 0;
      const tax = Math.round((subtotal - discount) * 0.14 * 100) / 100;
      const voided = rng() < 0.015;
      const channel = rng() < 0.18 ? 'delivery' : rng() < 0.32 ? 'takeaway' : 'dine_in';
      tickets.push({
        ticket_id: `${plan.code}-${day + 1}-${String(i + 1).padStart(3, '0')}`,
        store_code: plan.code,
        opened_at: opened,
        closed_at: closed,
        guests: channel === 'dine_in' ? 1 + Math.floor(rng() * 4) : 1,
        service: channel,
        items,
        totals: {
          subtotal: subtotal.toFixed(2),
          tax: tax.toFixed(2),
          discount: discount.toFixed(2),
          grand: (subtotal + tax - discount).toFixed(2),
        },
        currency: 'EGP',
        voided,
      });
    }
  }
  return tickets;
}

function buildShifts(plan: LocationPlan): HrShiftRaw[] {
  const rng = mulberry32(plan.seed + 99);
  const shifts: HrShiftRaw[] = [];
  const roles = ['server', 'cook', 'supervisor', 'barista'];
  const heads = plan.laborHeads;
  for (let day = 0; day < 7; day++) {
    for (let h = 0; h < heads; h++) {
      const lunch = h < Math.ceil(heads / 2);
      const startH = lunch ? 11 : 17;
      const endH = lunch ? 16 : 23;
      const extra = plan.laborMultiplier && day >= 4 ? 1 : 0;
      shifts.push({
        shift_id: `${plan.code}-S${day + 1}-${h + 1}`,
        site: plan.code,
        employee_code: `${plan.code}-E${h + 1}`,
        employee_name: SAMPLE_NAMES[(h + day) % SAMPLE_NAMES.length],
        role: pick(rng, roles),
        clock_in: iso(day, startH, 0),
        clock_out: iso(day, endH + extra, 0),
        wage_per_hour: (plan.laborRate + (pick(rng, [0, 5, 10]))).toFixed(2),
      });
    }
  }
  return shifts;
}

function buildLoyalty(tickets: PosTicketRaw[], plan: LocationPlan): LoyaltyEventRaw[] {
  const rng = mulberry32(plan.seed + 7);
  const events: LoyaltyEventRaw[] = [];
  tickets.forEach((t, idx) => {
    if (t.voided || rng() > 0.28) return;
    const member = `M${1000 + (idx % 40)}`;
    const pts = Math.max(5, Math.round(Number(t.totals?.grand ?? 0) / 10));
    events.push({
      event_id: `LOY-${t.ticket_id}`,
      store: plan.code,
      member_id: member,
      member_name: SAMPLE_NAMES[idx % SAMPLE_NAMES.length],
      event: 'earn',
      pts,
      ticket_ref: t.ticket_id,
      ts: t.closed_at,
    });
    if (rng() < 0.12) {
      events.push({
        event_id: `LOY-${t.ticket_id}-R`,
        store: plan.code,
        member_id: member,
        member_name: SAMPLE_NAMES[idx % SAMPLE_NAMES.length],
        event: 'redeem',
        pts: 50,
        ticket_ref: t.ticket_id,
        ts: t.closed_at,
      });
    }
  });
  return events;
}

function populate(store: MemoryStore, tenantId: string, plans: LocationPlan[]): void {
  for (const plan of plans) {
    const tickets = buildTickets(plan);
    if (plan.location.id === 'loc_ag_hel') {
      tickets.push({
        ticket_id: 'AG-HEL-BANQUET-01',
        store_code: 'AG-HEL',
        opened_at: iso(3, 19, 0),
        closed_at: iso(3, 22, 30),
        guests: 42,
        service: 'dine_in',
        items: [{ sku: 'AG-MIX', item_name: 'Banquet package (sample)', qty: 42, unit_price: '340.00', category: 'mains' }],
        totals: { subtotal: '14280.00', tax: '1999.20', discount: '0.00', grand: '16279.20' },
        currency: 'EGP',
      });
    }
    const shifts = buildShifts(plan);
    const loyalty = buildLoyalty(tickets, plan);
    ingestPosTickets(store, tenantId, tickets);
    ingestHrShifts(store, tenantId, shifts);
    ingestLoyaltyEvents(store, tenantId, loyalty);
  }
}

export function catalogTenants(): Tenant[] {
  return [NORTHSHORE.tenant, ATLAS.tenant];
}

export function buildDemoSnapshots(): TenantSnapshot[] {
  const nsStore = new MemoryStore([
    emptySnapshot(NORTHSHORE.tenant, NORTHSHORE.brands, NORTHSHORE.locations, makeConnectors(NORTHSHORE.tenant.id)),
  ]);
  populate(nsStore, NORTHSHORE.tenant.id, [
    { location: NORTHSHORE.locations[0], menu: KITCHEN_MENU, code: 'NSK-NC', seed: 11, dailyOrders: 34, lunchWeight: 0.4, dinnerWeight: 0.6, laborRate: 48, laborHeads: 6, dropDay: 5 },
    { location: NORTHSHORE.locations[1], menu: KITCHEN_MENU, code: 'NSK-MD', seed: 29, dailyOrders: 28, lunchWeight: 0.35, dinnerWeight: 0.65, laborRate: 135, laborHeads: 11, laborMultiplier: 1.35 },
    { location: NORTHSHORE.locations[2], menu: ESPRESSO_MENU, code: 'NSE-DT', seed: 47, dailyOrders: 52, lunchWeight: 0.7, dinnerWeight: 0.3, laborRate: 42, laborHeads: 4 },
  ]);

  const atlasStore = new MemoryStore([
    emptySnapshot(ATLAS.tenant, ATLAS.brands, ATLAS.locations, makeConnectors(ATLAS.tenant.id)),
  ]);
  populate(atlasStore, ATLAS.tenant.id, [
    { location: ATLAS.locations[0], menu: GRILL_MENU, code: 'AG-HEL', seed: 67, dailyOrders: 30, lunchWeight: 0.4, dinnerWeight: 0.6, laborRate: 45, laborHeads: 6 },
    { location: ATLAS.locations[1], menu: GRILL_MENU, code: 'AG-SZ', seed: 83, dailyOrders: 24, lunchWeight: 0.38, dinnerWeight: 0.62, laborRate: 46, laborHeads: 5 },
  ]);

  return [nsStore.cloneOf(NORTHSHORE.tenant.id), atlasStore.cloneOf(ATLAS.tenant.id)];
}

export function createDemoStore(): MemoryStore {
  return new MemoryStore(buildDemoSnapshots());
}

/** Extra POS tickets used by the live demo "replay ingestion" button. The first call accepts them; the second is a no-op. */
export function sampleReplayBatch(): PosTicketRaw[] {
  return [
    {
      ticket_id: 'NSK-NC-DEMO-REPLAY',
      store_code: 'NSK-NC',
      opened_at: '2026-11-02T15:10:00.000Z',
      closed_at: '2026-11-02T15:42:00.000Z',
      guests: 2,
      service: 'dine_in',
      items: [
        { sku: 'NSK-PST', item_name: 'Truffle mushroom pasta', qty: 2, unit_price: '295.00', category: 'mains' },
        { sku: 'NSK-SOD', item_name: 'Sparkling citrus', qty: 2, unit_price: '45.00', category: 'beverages' },
      ],
      totals: { subtotal: '680.00', tax: '95.20', discount: '0.00', grand: '775.20' },
      currency: 'EGP',
    },
  ];
}
