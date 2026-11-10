import { ingestPosTickets } from '../src/domain/ingest';
import { createDemoStore, sampleReplayBatch } from '../src/domain/seed';

describe('idempotent ingestion', () => {
  it('accepts a new POS ticket once and replays the second copy', () => {
    const store = createDemoStore();
    const batch = sampleReplayBatch();
    const first = ingestPosTickets(store, 'ten_northshore', batch);
    const second = ingestPosTickets(store, 'ten_northshore', batch);
    expect(first.accepted).toBe(1);
    expect(first.replayed).toBe(0);
    expect(second.accepted).toBe(0);
    expect(second.replayed).toBe(1);
    const copies = store.listOrders('ten_northshore').filter((o) => o.externalId === batch[0].ticket_id);
    expect(copies).toHaveLength(1);
  });
});
