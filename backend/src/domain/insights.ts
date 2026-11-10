import { formatMoney, pct } from './money';
import type {
  Anomaly,
  DailySales,
  HourBucket,
  Insights,
  Kpis,
  LaborShift,
  Location,
  LocationKpis,
  Order,
  TenantSnapshot,
} from './types';

function emptyKpis(): Kpis {
  return {
    netSalesMinor: 0,
    voidedMinor: 0,
    orderCount: 0,
    avgTicketMinor: 0,
    covers: 0,
    laborCostMinor: 0,
    laborHours: 0,
    laborCostPct: 0,
    loyaltyMembers: 0,
    loyaltyEarn: 0,
    loyaltyRedeem: 0,
  };
}

function finalize(k: Kpis): Kpis {
  k.avgTicketMinor = k.orderCount ? Math.round(k.netSalesMinor / k.orderCount) : 0;
  k.laborCostPct = pct(k.laborCostMinor, k.netSalesMinor);
  return k;
}

function addOrder(k: Kpis, order: Order): void {
  if (order.status === 'voided') {
    k.voidedMinor += order.totalMinor;
    return;
  }
  k.netSalesMinor += order.totalMinor;
  k.orderCount += 1;
  k.covers += order.guestCount;
}

function addShift(k: Kpis, shift: LaborShift): void {
  k.laborCostMinor += shift.laborCostMinor;
  k.laborHours += shift.hours;
}

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

function hourOf(iso: string): number {
  return new Date(iso).getHours();
}

export function computeInsights(snapshot: TenantSnapshot, locationId?: string | null): Insights {
  const locations = locationId
    ? snapshot.locations.filter((l) => l.id === locationId)
    : snapshot.locations;
  const locationIds = new Set(locations.map((l) => l.id));
  const orders = snapshot.orders.filter((o) => locationIds.has(o.locationId));
  const shifts = snapshot.shifts.filter((s) => locationIds.has(s.locationId));
  const loyalty = snapshot.loyaltyEvents.filter((e) => locationIds.has(e.locationId));

  const totals = emptyKpis();
  for (const o of orders) addOrder(totals, o);
  for (const s of shifts) addShift(totals, s);
  totals.loyaltyEarn = loyalty.filter((e) => e.type === 'earn').reduce((n, e) => n + e.points, 0);
  totals.loyaltyRedeem = loyalty.filter((e) => e.type === 'redeem').reduce((n, e) => n + e.points, 0);
  totals.loyaltyMembers = new Set(loyalty.map((e) => e.customerId)).size;
  finalize(totals);

  const brandName = (loc: Location) => snapshot.brands.find((b) => b.id === loc.brandId)?.name ?? loc.name;

  const byLocation: LocationKpis[] = locations.map((loc) => {
    const k = emptyKpis() as LocationKpis;
    k.locationId = loc.id;
    k.locationName = loc.name;
    k.brandName = brandName(loc);
    k.city = loc.city;
    for (const o of orders.filter((r) => r.locationId === loc.id)) addOrder(k, o);
    for (const s of shifts.filter((r) => r.locationId === loc.id)) addShift(k, s);
    const locLoyalty = loyalty.filter((e) => e.locationId === loc.id);
    k.loyaltyEarn = locLoyalty.filter((e) => e.type === 'earn').reduce((n, e) => n + e.points, 0);
    k.loyaltyRedeem = locLoyalty.filter((e) => e.type === 'redeem').reduce((n, e) => n + e.points, 0);
    k.loyaltyMembers = new Set(locLoyalty.map((e) => e.customerId)).size;
    finalize(k);
    return k;
  });

  const peakHours: HourBucket[] = Array.from({ length: 24 }, (_, hour) => ({ hour, salesMinor: 0, orders: 0 }));
  for (const o of orders) {
    if (o.status === 'voided') continue;
    const bucket = peakHours[hourOf(o.closedAt)];
    bucket.salesMinor += o.totalMinor;
    bucket.orders += 1;
  }

  const dailyMap = new Map<string, DailySales>();
  for (const o of orders) {
    const key = dateKey(o.closedAt);
    const row = dailyMap.get(key) ?? { date: key, salesMinor: 0, orders: 0, laborCostMinor: 0 };
    if (o.status !== 'voided') {
      row.salesMinor += o.totalMinor;
      row.orders += 1;
    }
    dailyMap.set(key, row);
  }
  for (const s of shifts) {
    const key = dateKey(s.startedAt);
    const row = dailyMap.get(key) ?? { date: key, salesMinor: 0, orders: 0, laborCostMinor: 0 };
    row.laborCostMinor += s.laborCostMinor;
    dailyMap.set(key, row);
  }
  const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  const dates = orders.map((o) => o.closedAt);
  const from = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : new Date().toISOString();
  const to = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : new Date().toISOString();

  return {
    generatedAt: new Date().toISOString(),
    currency: 'EGP',
    period: { from, to },
    filter: { locationId: locationId ?? null },
    totals,
    byLocation,
    peakHours,
    daily,
    anomalies: detectAnomalies(byLocation, daily, orders, snapshot.locations),
  };
}

export function detectAnomalies(
  byLocation: LocationKpis[],
  daily: DailySales[],
  orders: Order[],
  locations: Location[],
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const locName = (id: string) => locations.find((l) => l.id === id)?.name ?? id;

  for (const loc of byLocation) {
    if (loc.netSalesMinor <= 0) continue;
    if (loc.laborCostPct >= 42) {
      anomalies.push({
        id: `labor-critical-${loc.locationId}`,
        severity: 'critical',
        locationId: loc.locationId,
        locationName: loc.locationName,
        title: 'Labor cost is critically high',
        detail: `${loc.locationName} spent ${loc.laborCostPct}% of net sales on labor. Typical full-service target is 25–35%.`,
        metric: 'labor_cost_pct',
        value: `${loc.laborCostPct}%`,
      });
    } else if (loc.laborCostPct >= 35) {
      anomalies.push({
        id: `labor-warn-${loc.locationId}`,
        severity: 'warning',
        locationId: loc.locationId,
        locationName: loc.locationName,
        title: 'Labor cost above target',
        detail: `${loc.locationName} labor cost is ${loc.laborCostPct}% of sales (target < 35%).`,
        metric: 'labor_cost_pct',
        value: `${loc.laborCostPct}%`,
      });
    }
  }

  const byLocDay = new Map<string, { sales: number; n: number }>();
  for (const o of orders) {
    if (o.status === 'voided') continue;
    const key = `${o.locationId}|${o.closedAt.slice(0, 10)}`;
    const row = byLocDay.get(key) ?? { sales: 0, n: 0 };
    row.sales += o.totalMinor;
    row.n += 1;
    byLocDay.set(key, row);
  }
  const avgByLoc = new Map<string, number>();
  for (const loc of byLocation) {
    const days = [...byLocDay.entries()].filter(([k]) => k.startsWith(loc.locationId + '|'));
    const avg = days.length ? days.reduce((s, [, v]) => s + v.sales, 0) / days.length : 0;
    avgByLoc.set(loc.locationId, avg);
  }
  for (const [key, row] of byLocDay) {
    const [locationId, date] = key.split('|');
    const avg = avgByLoc.get(locationId) ?? 0;
    if (avg > 0 && row.sales < avg * 0.75) {
      const drop = Math.round((1 - row.sales / avg) * 100);
      anomalies.push({
        id: `sales-drop-${locationId}-${date}`,
        severity: drop >= 40 ? 'critical' : 'warning',
        locationId,
        locationName: locName(locationId),
        title: `Sales dip on ${date}`,
        detail: `${locName(locationId)} did ${formatMoney(row.sales)} on ${date}, ${drop}% below its daily average of ${formatMoney(Math.round(avg))}.`,
        metric: 'daily_sales',
        value: formatMoney(row.sales),
      });
    }
  }

  const closed = orders.filter((o) => o.status === 'closed');
  const avgTicket = closed.length ? closed.reduce((s, o) => s + o.totalMinor, 0) / closed.length : 0;
  for (const o of closed) {
    if (avgTicket > 0 && o.totalMinor > avgTicket * 8) {
      anomalies.push({
        id: `outlier-ticket-${o.id}`,
        severity: 'info',
        locationId: o.locationId,
        locationName: locName(o.locationId),
        title: 'Unusually large ticket',
        detail: `Order ${o.externalId} is ${formatMoney(o.totalMinor)}, more than 8× the average ticket. Could be a banquet — or a mapping error from the POS.`,
        metric: 'ticket_size',
        value: formatMoney(o.totalMinor),
      });
    }
  }

  const severityRank = { critical: 0, warning: 1, info: 2 };
  return anomalies.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.title.localeCompare(b.title));
}
