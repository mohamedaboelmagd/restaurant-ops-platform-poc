# ADR-0002: Canonical operational model behind a connector SDK

- Status: accepted
- Date: 2026-11-10

## Context

Restaurant groups already run a POS, a staff scheduler / payroll tool, a loyalty programme, and
usually an accounting package. Each vendor has its own identifiers, tax rules and webhook shapes.
If the dashboard or the insights engine speak any vendor’s dialect, every new integration becomes
a rewrite.

## Decision

- Define a small canonical model: orders and line items, labor shifts, customers and loyalty
  events, all hanging off `tenant → brand → location`.
- Each vendor feed implements `Connector.normalize`, which is a pure function from a raw payload
  to a draft of that model (or a structured error). The ingest service then attaches the tenant,
  resolves the location, and writes through the store.
- Idempotency is a unique key on `(tenant_id, connector, external_id)`, not “best effort”
  deduplication in the adapter.
- Money is integer minor units throughout so totals are reproducible.

## Consequences

- A fourth connector (for example accounting / daily close) can land without changing the React
  dashboard or `computeInsights`.
- Adapters stay small and independently testable. Mapping mistakes show up as rejected events
  rather than corrupt KPIs.
- The canonical model is intentionally narrower than any one vendor’s API; rich vendor fields that
  we do not yet need are dropped at the edge.
