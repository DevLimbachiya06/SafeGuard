CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS agencies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  region TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  emirates_id TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('citizen', 'responder', 'commander', 'admin')),
  agency_id TEXT REFERENCES agencies(id),
  mobile_pin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS responders (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL REFERENCES users(id),
  unit_id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  heading_deg NUMERIC NOT NULL DEFAULT 0,
  speed_kmh NUMERIC NOT NULL DEFAULT 0,
  rvts_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk_zones (
  id TEXT PRIMARY KEY,
  zone_name TEXT NOT NULL UNIQUE,
  risk_score INT NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  confidence NUMERIC(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  trend TEXT NOT NULL,
  eta_minutes INT NOT NULL,
  prediction TEXT NOT NULL,
  center GEOGRAPHY(POINT, 4326) NOT NULL,
  radius_km NUMERIC(5,2) NOT NULL,
  boundary GEOGRAPHY(POLYGON, 4326),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  incident_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'moderate', 'high', 'critical')),
  status TEXT NOT NULL,
  zone_id TEXT REFERENCES risk_zones(id),
  zone_name TEXT NOT NULL,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  source TEXT NOT NULL,
  eta_minutes INT NOT NULL,
  recommended_action TEXT NOT NULL,
  dispatch_unit_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telemetry (
  id TEXT PRIMARY KEY,
  source_id TEXT UNIQUE NOT NULL,
  sensor_type TEXT NOT NULL,
  location_name TEXT NOT NULL,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  temperature_c NUMERIC NOT NULL,
  air_quality_index NUMERIC NOT NULL,
  flood_level_m NUMERIC NOT NULL,
  humidity_pct NUMERIC NOT NULL,
  risk_band TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL,
  zone_name TEXT NOT NULL,
  channel TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hospitals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emirate TEXT NOT NULL,
  available_beds INT NOT NULL,
  icu_available INT NOT NULL,
  occupancy_pct INT NOT NULL,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rvts_warnings (
  id TEXT PRIMARY KEY,
  responder_unit_id TEXT NOT NULL,
  distance_m INT NOT NULL,
  direction TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
