import { RuleBasedAskAssistant } from '../../backend/src/domain/ask';
import { ingestPosTickets } from '../../backend/src/domain/ingest';
import { computeInsights } from '../../backend/src/domain/insights';
import { createDemoStore, sampleReplayBatch } from '../../backend/src/domain/seed';
import type { AskResult, Insights, IngestResult, Tenant } from '../../backend/src/domain/types';

const assistant = new RuleBasedAskAssistant();

export class BrowserDemo {
  private store = createDemoStore();

  tenants(): Tenant[] {
    return this.store.listTenants();
  }

  snapshot(tenantId: string) {
    const snap = this.store.getSnapshot(tenantId);
    if (!snap) throw new Error('unknown tenant');
    return snap;
  }

  insights(tenantId: string, locationId?: string | null): Insights {
    return computeInsights(this.snapshot(tenantId), locationId ?? undefined);
  }

  ask(tenantId: string, question: string, locationId?: string | null): Promise<AskResult> {
    return assistant.answer(question, this.insights(tenantId, locationId));
  }

  replaySampleIngest(tenantId: string): IngestResult {
    return ingestPosTickets(this.store, tenantId, sampleReplayBatch());
  }

  reset(): void {
    this.store = createDemoStore();
  }
}

export const demo = new BrowserDemo();
