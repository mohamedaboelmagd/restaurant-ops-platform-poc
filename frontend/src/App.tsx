import { useMemo, useState, type FormEvent } from 'react';
import { formatMoney } from '../../backend/src/domain/money';
import type { Anomaly, AskResult, HourBucket, IngestResult, Insights, LocationKpis } from '../../backend/src/domain/types';
import { demo } from './demo';

const SUGGESTED = [
  'What were sales in New Cairo?',
  'Which location has the highest labor cost?',
  'When are the peak hours?',
  'Any anomalies I should look at?',
];

export function App() {
  const tenants = useMemo(() => demo.tenants(), []);
  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? '');
  const [locationId, setLocationId] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'integrations'>('overview');
  const [question, setQuestion] = useState(SUGGESTED[0]);
  const [askResult, setAskResult] = useState<AskResult | null>(null);
  const [ingest, setIngest] = useState<IngestResult | null>(null);
  const [tick, setTick] = useState(0);

  const snap = useMemo(() => demo.snapshot(tenantId), [tenantId, tick]);
  const insights = useMemo(() => demo.insights(tenantId, locationId), [tenantId, locationId, tick]);
  const tenant = tenants.find((t) => t.id === tenantId) ?? tenants[0];

  async function onAsk(e?: FormEvent) {
    e?.preventDefault();
    setAskResult(await demo.ask(tenantId, question, locationId));
  }

  function onReplay() {
    setIngest(demo.replaySampleIngest(tenantId));
    setTick((n) => n + 1);
  }

  function onReset() {
    demo.reset();
    setIngest(null);
    setAskResult(null);
    setTick((n) => n + 1);
  }

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <h1>Restaurant operations platform</h1>
          <p>
            Independent proof of concept by Mohamed Abo Elmagd. A multi-tenant ops layer that
            normalises POS, labor and loyalty feeds into one model, then computes KPIs, anomalies
            and a deterministic “ask your data” assistant. All figures below are fictional sample data.
          </p>
        </div>
        <div className="controls">
          <label>
            <span className="label">Tenant</span>
            <select
              value={tenantId}
              onChange={(e) => {
                setTenantId(e.target.value);
                setLocationId(null);
                setAskResult(null);
              }}
              aria-label="Tenant"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn" onClick={onReplay} type="button">
            Replay sample POS ticket
          </button>
          <button className="btn" onClick={onReset} type="button">
            Reset demo
          </button>
        </div>
      </header>

      <div className="banner">
        Live site is a static browser build: the same TypeScript domain layer as the NestJS API runs in
        your browser (no backend hosting). Switch tenants, filter a location, ask a question, then click
        <strong> Replay sample POS ticket</strong> twice to see idempotent ingestion.
        {ingest ? ` Last ingest: ${ingest.accepted} accepted, ${ingest.replayed} replayed, ${ingest.rejected} rejected.` : ''}
      </div>

      <nav className="tabs">
        <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')} type="button">
          Overview
        </button>
        <button className={tab === 'integrations' ? 'active' : ''} onClick={() => setTab('integrations')} type="button">
          Integrations
        </button>
      </nav>

      <div className="chips">
        <button className={`chip ${locationId == null ? 'on' : ''}`} onClick={() => setLocationId(null)} type="button">
          All locations
        </button>
        {snap.locations.map((l) => (
          <button
            key={l.id}
            className={`chip ${locationId === l.id ? 'on' : ''}`}
            onClick={() => setLocationId(l.id)}
            type="button"
          >
            {l.name}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <Overview insights={insights} ask={{ question, setQuestion, onAsk, askResult }} />
      ) : (
        <Integrations snap={snap} tenantName={tenant.name} />
      )}

      <p className="foot">
        Sample window {insights.period.from.slice(0, 10)} – {insights.period.to.slice(0, 10)} · currency {insights.currency} ·{' '}
        {tenant.name}. Source code and the NestJS API are in the public repository.
      </p>
    </div>
  );
}

function Overview({
  insights,
  ask,
}: {
  insights: Insights;
  ask: { question: string; setQuestion: (q: string) => void; onAsk: (e?: FormEvent) => void; askResult: AskResult | null };
}) {
  const t = insights.totals;
  return (
    <>
      <section className="kpis">
        <Kpi label="Net sales" value={formatMoney(t.netSalesMinor)} sub={`${t.orderCount} closed orders`} />
        <Kpi label="Avg ticket" value={formatMoney(t.avgTicketMinor)} sub={`${t.covers} covers`} />
        <Kpi label="Labor cost" value={`${t.laborCostPct}%`} sub={`${formatMoney(t.laborCostMinor)} · ${t.laborHours.toFixed(0)} h`} />
        <Kpi label="Loyalty" value={`${t.loyaltyMembers} members`} sub={`+${t.loyaltyEarn} / −${t.loyaltyRedeem} pts`} />
        <Kpi label="Anomalies" value={String(insights.anomalies.length)} sub={t.voidedMinor ? `${formatMoney(t.voidedMinor)} voided` : 'rule-based flags'} />
      </section>

      <div className="grid">
        <article className="card">
          <div className="label">Sales by location</div>
          <SalesBars rows={insights.byLocation} />
        </article>
        <article className="card">
          <div className="label">Peak hours</div>
          <PeakHours buckets={insights.peakHours} />
        </article>
      </div>

      <div className="grid" style={{ marginTop: 14 }}>
        <article className="card">
          <div className="label">Anomalies</div>
          <AnomalyList rows={insights.anomalies} />
        </article>
        <article className="card ask">
          <div className="label">Ask your data</div>
          <p className="sub" style={{ marginTop: 8 }}>
            The live demo uses a deterministic rule engine over the KPIs you see here. The NestJS API
            can swap in an LLM behind the same interface when an API key is present.
          </p>
          <form onSubmit={ask.onAsk} style={{ marginTop: 12 }}>
            <input
              value={ask.question}
              onChange={(e) => ask.setQuestion(e.target.value)}
              placeholder="Ask about sales, labor, peak hours…"
              aria-label="Question"
            />
            <button className="btn primary" type="submit">
              Ask
            </button>
          </form>
          <div className="chips" style={{ marginTop: 10 }}>
            {SUGGESTED.map((q) => (
              <button key={q} className="chip" type="button" onClick={() => ask.setQuestion(q)}>
                {q}
              </button>
            ))}
          </div>
          {ask.askResult ? (
            <div className="answer">
              <p>{ask.askResult.answer}</p>
              {ask.askResult.bullets.length > 0 && (
                <ul>
                  {ask.askResult.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
              <div className="engine">Engine: {ask.askResult.engine === 'llm' ? 'LLM' : 'rule-based fallback'}</div>
            </div>
          ) : null}
        </article>
      </div>
    </>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <article className="card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className="sub">{sub}</div>
    </article>
  );
}

function SalesBars({ rows }: { rows: LocationKpis[] }) {
  const max = Math.max(...rows.map((r) => r.netSalesMinor), 1);
  return (
    <div className="chart">
      {rows.map((r) => (
        <div className="bar" key={r.locationId}>
          <div className="amt">{formatMoney(r.netSalesMinor)}</div>
          <div className="fill" style={{ height: `${Math.max(8, (r.netSalesMinor / max) * 160)}px` }} />
          <div className="name">{r.locationName}</div>
        </div>
      ))}
    </div>
  );
}

function PeakHours({ buckets }: { buckets: HourBucket[] }) {
  const max = Math.max(...buckets.map((b) => b.salesMinor), 1);
  const peak = buckets.reduce((a, b) => (b.salesMinor > a.salesMinor ? b : a), buckets[0]);
  return (
    <>
      <div className="hours" aria-label="Sales by hour of day">
        {buckets.map((b) => (
          <div
            key={b.hour}
            className={`h ${b.hour === peak.hour ? 'hot' : ''}`}
            style={{ height: `${Math.max(2, (b.salesMinor / max) * 170)}px` }}
            title={`${String(b.hour).padStart(2, '0')}:00 · ${b.orders} orders · ${formatMoney(b.salesMinor)}`}
          />
        ))}
      </div>
      <div className="legend">
        <span>00:00</span>
        <span>Peak {String(peak.hour).padStart(2, '0')}:00</span>
        <span>23:00</span>
      </div>
    </>
  );
}

function AnomalyList({ rows }: { rows: Anomaly[] }) {
  if (!rows.length) return <p className="sub">No anomalies flagged for this selection.</p>;
  return (
    <div className="list">
      {rows.map((a) => (
        <div className="anomaly" key={a.id}>
          <div className="meta">
            <span className={`pill ${a.severity}`}>{a.severity}</span>
            <span className="sub">{a.locationName}</span>
          </div>
          <h3>{a.title}</h3>
          <p>{a.detail}</p>
        </div>
      ))}
    </div>
  );
}

function Integrations({ snap, tenantName }: { snap: ReturnType<typeof demo.snapshot>; tenantName: string }) {
  return (
    <article className="card">
      <div className="label">Connector status · {tenantName}</div>
      <p className="sub" style={{ marginTop: 8, marginBottom: 12 }}>
        Each vendor feed implements a small adapter that maps its payload into the canonical model
        (orders, line items, labor shifts, customers). Adding an accounting connector later does not
        change the dashboard or the insights engine.
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>Feed</th>
            <th>Kind</th>
            <th>Status</th>
            <th>Last sync</th>
            <th>Canonical rows</th>
          </tr>
        </thead>
        <tbody>
          {snap.connectors.map((c) => {
            const count =
              c.kind === 'pos' ? snap.orders.length : c.kind === 'hr' ? snap.shifts.length : snap.loyaltyEvents.length;
            return (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.kind.toUpperCase()}</td>
                <td>
                  <span className="status">
                    <span className="dot" /> {c.status}
                  </span>
                </td>
                <td>{c.lastSyncAt ? c.lastSyncAt.replace('T', ' ').slice(0, 16) : '—'}</td>
                <td>{count.toLocaleString('en-US')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </article>
  );
}
