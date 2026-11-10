import { ingestPosTickets } from '../src/domain/ingest';
import { createDemoStore } from '../src/domain/seed';

describe('tenant isolation', () => {
  const store = createDemoStore();
  const north = 'ten_northshore';
  const atlas = 'ten_atlas';

  it('never returns another tenant from an api key lookup', () => {
    expect(store.findTenantByApiKey('demo_northshore_key')?.id).toBe(north);
    expect(store.findTenantByApiKey('demo_atlas_key')?.id).toBe(atlas);
    expect(store.findTenantByApiKey('demo_northshore_key')?.id).not.toBe(atlas);
  });

  it('scopes reads by tenant_id so Northshore cannot see Atlas orders', () => {
    const northIds = new Set(store.listOrders(north).map((o) => o.tenantId));
    const atlasIds = new Set(store.listOrders(atlas).map((o) => o.tenantId));
    expect([...northIds]).toEqual([north]);
    expect([...atlasIds]).toEqual([atlas]);
    expect(store.listOrders(north).some((o) => o.tenantId === atlas)).toBe(false);
    expect(store.listShifts(atlas).every((s) => s.tenantId === atlas)).toBe(true);
    expect(store.listCustomers(north).every((c) => c.tenantId === north)).toBe(true);
  });

  it('does not resolve another tenant\'s location codes', () => {
    expect(store.resolveLocation.byCode(north, 'AG-HEL')).toBeUndefined();
    expect(store.resolveLocation.byCode(atlas, 'NSK-NC')).toBeUndefined();
    expect(store.resolveLocation.byId(north, 'loc_ag_hel')).toBeUndefined();
  });

  it('rejects ingestion that points at a foreign location code', () => {
    const result = ingestPosTickets(store, north, [
      {
        ticket_id: 'CROSS-1',
        store_code: 'AG-HEL',
        closed_at: '2026-10-28T16:00:00.000Z',
        items: [{ item_name: 'Should not land', qty: 1, unit_price: '10.00' }],
      },
    ]);
    expect(result.accepted).toBe(0);
    expect(result.rejected).toBe(1);
    expect(store.listOrders(atlas).some((o) => o.externalId === 'CROSS-1')).toBe(false);
    expect(store.listOrders(north).some((o) => o.externalId === 'CROSS-1')).toBe(false);
  });
});
