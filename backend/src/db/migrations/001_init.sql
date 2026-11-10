-- Shared-schema multi-tenant model for the restaurant operations platform.
-- Every business table carries tenant_id. Production should add Postgres RLS
-- (SET LOCAL app.tenant_id = ...) as a second line of defence — see ADR-0001.

CREATE TABLE IF NOT EXISTS tenants (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  api_key_hash  TEXT NOT NULL UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brands (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL REFERENCES tenants(id),
  name       TEXT NOT NULL,
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS locations (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL REFERENCES tenants(id),
  brand_id   TEXT NOT NULL REFERENCES brands(id),
  name       TEXT NOT NULL,
  city       TEXT NOT NULL,
  timezone   TEXT NOT NULL DEFAULT 'Africa/Cairo',
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS location_external_codes (
  tenant_id  TEXT NOT NULL REFERENCES tenants(id),
  location_id TEXT NOT NULL REFERENCES locations(id),
  code       TEXT NOT NULL,
  PRIMARY KEY (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS connector_accounts (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  kind          TEXT NOT NULL CHECK (kind IN ('pos', 'hr', 'loyalty', 'accounting')),
  name          TEXT NOT NULL,
  status        TEXT NOT NULL,
  last_sync_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ingestion_cursors (
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  connector     TEXT NOT NULL,
  external_id   TEXT NOT NULL,
  payload_hash  TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  ingested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, connector, external_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  location_id     TEXT NOT NULL REFERENCES locations(id),
  source          TEXT NOT NULL DEFAULT 'pos',
  external_id     TEXT NOT NULL,
  opened_at       TIMESTAMPTZ NOT NULL,
  closed_at       TIMESTAMPTZ NOT NULL,
  guest_count     INTEGER NOT NULL CHECK (guest_count >= 0),
  channel         TEXT NOT NULL CHECK (channel IN ('dine_in', 'takeaway', 'delivery')),
  subtotal_minor  BIGINT NOT NULL,
  tax_minor       BIGINT NOT NULL,
  discount_minor  BIGINT NOT NULL,
  total_minor     BIGINT NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'EGP',
  status          TEXT NOT NULL CHECK (status IN ('closed', 'voided')),
  UNIQUE (tenant_id, source, external_id)
);

CREATE INDEX IF NOT EXISTS orders_tenant_location_closed_idx
  ON orders (tenant_id, location_id, closed_at);

CREATE TABLE IF NOT EXISTS line_items (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL REFERENCES tenants(id),
  order_id          TEXT NOT NULL REFERENCES orders(id),
  sku               TEXT NOT NULL,
  name              TEXT NOT NULL,
  quantity          NUMERIC(10, 2) NOT NULL,
  unit_price_minor  BIGINT NOT NULL,
  total_minor       BIGINT NOT NULL,
  category          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS labor_shifts (
  id                    TEXT PRIMARY KEY,
  tenant_id             TEXT NOT NULL REFERENCES tenants(id),
  location_id           TEXT NOT NULL REFERENCES locations(id),
  source                TEXT NOT NULL DEFAULT 'hr',
  external_id           TEXT NOT NULL,
  employee_external_id  TEXT NOT NULL,
  employee_name         TEXT NOT NULL,
  role                  TEXT NOT NULL,
  started_at            TIMESTAMPTZ NOT NULL,
  ended_at              TIMESTAMPTZ NOT NULL,
  hours                 NUMERIC(6, 2) NOT NULL,
  hourly_rate_minor     BIGINT NOT NULL,
  labor_cost_minor      BIGINT NOT NULL,
  UNIQUE (tenant_id, source, external_id)
);

CREATE INDEX IF NOT EXISTS shifts_tenant_location_started_idx
  ON labor_shifts (tenant_id, location_id, started_at);

CREATE TABLE IF NOT EXISTS customers (
  id                   TEXT PRIMARY KEY,
  tenant_id            TEXT NOT NULL REFERENCES tenants(id),
  loyalty_external_id  TEXT NOT NULL,
  display_name         TEXT NOT NULL,
  visits               INTEGER NOT NULL DEFAULT 0,
  points               INTEGER NOT NULL DEFAULT 0,
  last_visit_at        TIMESTAMPTZ,
  UNIQUE (tenant_id, loyalty_external_id)
);

CREATE TABLE IF NOT EXISTS loyalty_events (
  id                 TEXT PRIMARY KEY,
  tenant_id          TEXT NOT NULL REFERENCES tenants(id),
  location_id        TEXT NOT NULL REFERENCES locations(id),
  source             TEXT NOT NULL DEFAULT 'loyalty',
  external_id        TEXT NOT NULL,
  customer_id        TEXT NOT NULL REFERENCES customers(id),
  type               TEXT NOT NULL CHECK (type IN ('earn', 'redeem')),
  points             INTEGER NOT NULL,
  order_external_id  TEXT,
  at                 TIMESTAMPTZ NOT NULL,
  UNIQUE (tenant_id, source, external_id)
);

-- Defence in depth for Postgres. The application still filters every query by tenant_id.
-- ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY orders_isolation ON orders
--   USING (tenant_id = current_setting('app.tenant_id', true));
