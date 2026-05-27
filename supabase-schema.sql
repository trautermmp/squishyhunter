-- Run this in your Supabase project:
-- Dashboard → SQL Editor → New query → paste this → Run

CREATE TABLE IF NOT EXISTS reports (
  id           TEXT        PRIMARY KEY,
  store_id     TEXT        NOT NULL,
  store_name   TEXT        NOT NULL DEFAULT 'Unknown store',
  chain        TEXT        NOT NULL DEFAULT 'unknown',
  lat          FLOAT8,
  lng          FLOAT8,
  product_id   TEXT        NOT NULL,
  qty          INTEGER     NOT NULL CHECK (qty >= 0 AND qty <= 999),
  status       TEXT        NOT NULL CHECK (status IN ('in_stock', 'low_stock', 'out_of_stock')),
  note         TEXT,
  device_id    TEXT,
  reported_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL,
  confirmed_by        INTEGER     NOT NULL DEFAULT 0,
  custom_product_name TEXT
);

CREATE INDEX IF NOT EXISTS reports_expires_at_idx  ON reports (expires_at);
CREATE INDEX IF NOT EXISTS reports_reported_at_idx ON reports (reported_at DESC);
CREATE INDEX IF NOT EXISTS reports_lat_lng_idx     ON reports (lat, lng);

-- Row Level Security
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Anyone can read reports (server filters by expires_at)
CREATE POLICY "reports_select" ON reports FOR SELECT USING (true);

-- Anyone can submit a report (rate limiting + validation handled in the API)
CREATE POLICY "reports_insert" ON reports FOR INSERT WITH CHECK (true);

-- Anyone can confirm a report (increments confirmed_by and extends expires_at)
CREATE POLICY "reports_update" ON reports FOR UPDATE USING (true) WITH CHECK (true);

-- No deletes via the API — cleanup happens via expires_at filtering

-- Migration: add custom_product_name to existing tables
-- Run this if the reports table already exists without the column:
-- ALTER TABLE reports ADD COLUMN IF NOT EXISTS custom_product_name TEXT;

-- ── Push subscriptions ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint   TEXT        NOT NULL UNIQUE,
  p256dh     TEXT        NOT NULL,
  auth       TEXT        NOT NULL,
  lat        FLOAT8,
  lng        FLOAT8,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_select" ON push_subscriptions FOR SELECT USING (true);
CREATE POLICY "push_insert" ON push_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "push_update" ON push_subscriptions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "push_delete" ON push_subscriptions FOR DELETE USING (true);

-- ── Community store submissions ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS store_submissions (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT        NOT NULL,
  chain        TEXT        NOT NULL DEFAULT 'other',
  address      TEXT,
  city         TEXT,
  state        TEXT,
  zip          TEXT,
  lat          FLOAT8,
  lng          FLOAT8,
  website      TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE store_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "submissions_select" ON store_submissions FOR SELECT USING (true);
CREATE POLICY "submissions_insert" ON store_submissions FOR INSERT WITH CHECK (true);
