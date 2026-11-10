# ADR-0001: Shared-schema tenancy with tenant_id on every row

- Status: accepted
- Date: 2026-11-10

## Context

The product is a SaaS operations layer for many restaurant groups. Leaking one group’s sales or
labor data to another is the worst possible failure. The PoC must show the isolation pattern
without standing up one database per tenant.

## Decision

- Shared database, shared schema, `tenant_id` column on every business table.
- Unique keys are composite: `(tenant_id, source, external_id)` for ingested entities,
  `(tenant_id, code)` for location aliases.
- The tenant is resolved from the `x-api-key` header in a NestJS guard and passed explicitly into
  every store method. Clients cannot select a tenant in the body or URL.
- Location codes are resolved inside the tenant. A code that belongs to another tenant is treated
  as unknown and the event is rejected.
- Production adds Postgres Row-Level Security as a second line of defence.

## Consequences

- Simple to operate and to query internally (with care) for anonymised benchmarks.
- Noisy-neighbour risk is handled at the worker / queue level (per-tenant concurrency), not by
  separate databases.
- A regulated customer can later move onto a dedicated database with the same migrations.
