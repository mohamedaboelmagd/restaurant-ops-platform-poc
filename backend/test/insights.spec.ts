import { RuleBasedAskAssistant } from '../src/domain/ask';
import { computeInsights } from '../src/domain/insights';
import { formatMoney } from '../src/domain/money';
import { createDemoStore } from '../src/domain/seed';

describe('insights', () => {
  const store = createDemoStore();
  const north = store.getSnapshot('ten_northshore')!;
  const atlas = store.getSnapshot('ten_atlas')!;

  it('computes KPIs only from the selected tenant', () => {
    const n = computeInsights(north);
    const a = computeInsights(atlas);
    expect(n.totals.orderCount).toBeGreaterThan(100);
    expect(a.totals.orderCount).toBeGreaterThan(50);
    expect(n.byLocation.map((l) => l.locationName).sort()).toEqual(['Downtown', 'Maadi', 'New Cairo']);
    expect(a.byLocation.map((l) => l.locationName).sort()).toEqual(['Heliopolis', 'Sheikh Zayed']);
    expect(n.totals.netSalesMinor).not.toBe(a.totals.netSalesMinor);
  });

  it('filters by location without leaking sibling sites', () => {
    const maadi = computeInsights(north, 'loc_nsk_md');
    expect(maadi.filter.locationId).toBe('loc_nsk_md');
    expect(maadi.byLocation).toHaveLength(1);
    expect(maadi.byLocation[0].locationName).toBe('Maadi');
    expect(maadi.totals.orderCount).toBe(maadi.byLocation[0].orderCount);
  });

  it('flags high labor, a sales dip, and the banquet outlier', () => {
    const n = computeInsights(north);
    const a = computeInsights(atlas);
    expect(n.anomalies.some((x) => x.locationName === 'Maadi' && x.metric === 'labor_cost_pct')).toBe(true);
    expect(n.anomalies.some((x) => x.locationName === 'New Cairo' && x.metric === 'daily_sales')).toBe(true);
    expect(a.anomalies.some((x) => x.metric === 'ticket_size' && x.locationName === 'Heliopolis')).toBe(true);
  });

  it('has a peak hour distribution', () => {
    const n = computeInsights(north);
    expect(n.peakHours).toHaveLength(24);
    expect(n.peakHours.some((h) => h.orders > 0)).toBe(true);
  });
});

describe('ask-your-data (rule engine)', () => {
  it('answers labor and anomaly questions from KPIs', async () => {
    const insights = computeInsights(createDemoStore().getSnapshot('ten_northshore')!);
    const assistant = new RuleBasedAskAssistant();
    const labor = await assistant.answer('Which location has the highest labor cost?', insights);
    expect(labor.engine).toBe('rules');
    expect(labor.answer.toLowerCase()).toContain('labor');
    expect(labor.bullets.some((b) => b.includes('Maadi'))).toBe(true);

    const flags = await assistant.answer('Any anomalies I should look at?', insights);
    expect(flags.bullets.length).toBeGreaterThan(0);
    expect(flags.answer).toMatch(/anomal/i);
  });

  it('includes money from the canonical totals in a sales question', async () => {
    const insights = computeInsights(createDemoStore().getSnapshot('ten_northshore')!);
    const sales = await new RuleBasedAskAssistant().answer('What were sales in New Cairo?', insights);
    expect(sales.answer).toContain(formatMoney(insights.byLocation.find((l) => l.locationName === 'New Cairo')!.netSalesMinor));
  });
});
