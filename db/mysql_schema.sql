-- Compatibility schema for legacy MySQL notes.
-- The production demo uses PostgreSQL + PostGIS via remodel_schema.sql.

CREATE TABLE agencies (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(64) NOT NULL,
  region VARCHAR(128) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id VARCHAR(64) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  emirates_id VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL,
  agency_id VARCHAR(64),
  mobile_pin VARCHAR(16),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE responders (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL UNIQUE,
  unit_id VARCHAR(32) NOT NULL UNIQUE,
  type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  latitude DECIMAL(10, 6) NOT NULL,
  longitude DECIMAL(10, 6) NOT NULL,
  heading_deg DECIMAL(10, 2) NOT NULL,
  speed_kmh DECIMAL(10, 2) NOT NULL,
  rvts_active BOOLEAN NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE incidents (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  incident_type VARCHAR(64) NOT NULL,
  severity VARCHAR(16) NOT NULL,
  status VARCHAR(32) NOT NULL,
  zone_id VARCHAR(64),
  zone_name VARCHAR(255) NOT NULL,
  latitude DECIMAL(10, 6) NOT NULL,
  longitude DECIMAL(10, 6) NOT NULL,
  source VARCHAR(255) NOT NULL,
  eta_minutes INT NOT NULL,
  recommended_action TEXT NOT NULL,
  dispatch_unit_id VARCHAR(64),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE telemetry (
  id VARCHAR(64) PRIMARY KEY,
  source_id VARCHAR(64) NOT NULL UNIQUE,
  sensor_type VARCHAR(64) NOT NULL,
  location_name VARCHAR(255) NOT NULL,
  latitude DECIMAL(10, 6) NOT NULL,
  longitude DECIMAL(10, 6) NOT NULL,
  temperature_c DECIMAL(10, 2) NOT NULL,
  air_quality_index DECIMAL(10, 2) NOT NULL,
  flood_level_m DECIMAL(10, 2) NOT NULL,
  humidity_pct DECIMAL(10, 2) NOT NULL,
  risk_band VARCHAR(32) NOT NULL,
  recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE alerts (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(32) NOT NULL,
  zone_name VARCHAR(255) NOT NULL,
  channel VARCHAR(128) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
