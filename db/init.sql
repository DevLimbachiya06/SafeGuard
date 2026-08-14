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

INSERT INTO agencies (id, name, type, region) VALUES
  ('agency-civil-defense', 'Civil Defense', 'civil_defense', 'National'),
  ('agency-police', 'Police', 'police', 'National'),
  ('agency-ambulance', 'Ambulance', 'medical', 'National'),
  ('agency-municipality', 'Municipality Engineering', 'municipality', 'National')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, full_name, emirates_id, password_hash, role, agency_id, mobile_pin) VALUES
  ('user-001', 'Amina Al Nuaimi', '784-1989-1111111-1', '$2a$10$jEQFFZkraa66CLfP1G3Am.5jvwx9zKKMPX.b3byIAuyiVwI2iLf0W', 'commander', 'agency-civil-defense', '2468'),
  ('user-002', 'Faisal Al Marri', '784-1988-2222222-2', '$2a$10$UBK8jNC/eVHt/waleMAV4e3Xke8Ty/hFIfEV8maxOY..VYSwaD9GW', 'responder', 'agency-civil-defense', '3691'),
  ('user-003', 'Sara Al Mazrouei', '784-1993-3333333-3', '$2a$10$xsfyNO5EISjEVLl4iu4SlOGqTacYVGYoy710Z4rXhPs3e0qBG9/Ma', 'citizen', NULL, '1234')
ON CONFLICT (id) DO NOTHING;

INSERT INTO responders (id, user_id, unit_id, type, status, latitude, longitude, heading_deg, speed_kmh, rvts_active) VALUES
  ('resp-001', 'user-002', 'R-12', 'Ambulance', 'deployed', 25.12, 55.29, 68, 54, TRUE),
  ('resp-002', 'user-001', 'F-04', 'Fire Engine', 'en route', 24.99, 55.09, 24, 47, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO risk_zones (id, zone_name, risk_score, confidence, trend, eta_minutes, prediction, center, radius_km) VALUES
  ('z-dubai', 'Dubai South', 92, 0.94, 'rising', 11, 'Likely localized flooding and traffic stalling within the next 15 minutes.', ST_SetSRID(ST_MakePoint(55.231, 25.062), 4326)::geography, 6.4),
  ('z-alain', 'Al Ain', 77, 0.88, 'steady', 24, 'Dust front may reduce visibility and increase responder travel time.', ST_SetSRID(ST_MakePoint(55.740, 24.230), 4326)::geography, 8.1),
  ('z-abudhabi', 'Abu Dhabi Coast', 61, 0.83, 'falling', 36, 'Heat stress remains elevated but is expected to ease by evening.', ST_SetSRID(ST_MakePoint(54.360, 24.466), 4326)::geography, 7.5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO incidents (id, title, incident_type, severity, status, zone_id, zone_name, latitude, longitude, source, eta_minutes, recommended_action) VALUES
  ('INC-101', 'Flash flood on Sheikh Zayed service road', 'Flood', 'critical', 'active', 'z-dubai', 'Dubai South', 25.062, 55.231, 'IoT telemetry', 11, 'Dispatch water rescue, divert traffic, and push public evacuation alert.'),
  ('INC-102', 'Sandstorm visibility collapse near Al Ain', 'Sandstorm', 'high', 'monitoring', 'z-alain', 'Al Ain', 24.230, 55.740, 'Weather ingest', 24, 'Activate RVTS lane clearing and warn motorists entering the corridor.'),
  ('INC-103', 'Extreme heat anomaly on Abu Dhabi coastline', 'Heatwave', 'moderate', 'active', 'z-abudhabi', 'Abu Dhabi Coast', 24.466, 54.360, 'AI forecast', 36, 'Open cooling shelters and accelerate EMS standby.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO telemetry (id, source_id, sensor_type, location_name, latitude, longitude, temperature_c, air_quality_index, flood_level_m, humidity_pct, risk_band) VALUES
  ('tel-001', 'AQ-110', 'Air quality', 'Dubai South', 25.056, 55.214, 39.4, 182, 0.71, 81, 'critical'),
  ('tel-002', 'WX-221', 'Microclimate', 'Abu Dhabi Corniche', 24.455, 54.380, 44.1, 73, 0.08, 57, 'moderate'),
  ('tel-003', 'FL-332', 'Flood gauge', 'Al Ain Outskirts', 24.250, 55.770, 36.3, 95, 1.33, 69, 'high')
ON CONFLICT (id) DO NOTHING;

INSERT INTO alerts (id, title, message, severity, zone_name, channel) VALUES
  ('ALT-501', 'Flood evacuation advisory', 'Dubai South residents should move to upper floors and keep roads clear for rescue vehicles.', 'critical', 'Dubai South', 'SMS + app push'),
  ('ALT-502', 'Sandstorm RVTS warning', 'Visibility is dropping across the Al Ain corridor. Slow down and follow lane-clearance messages.', 'high', 'Al Ain', 'Traffic boards')
ON CONFLICT (id) DO NOTHING;

INSERT INTO hospitals (id, name, emirate, available_beds, icu_available, occupancy_pct, latitude, longitude) VALUES
  ('H-01', 'Rashid Emergency Center', 'Dubai', 31, 4, 72, 25.219, 55.328),
  ('H-02', 'Sheikh Khalifa Medical City', 'Abu Dhabi', 27, 6, 64, 24.489, 54.359),
  ('H-03', 'Tawam Trauma Center', 'Al Ain', 18, 2, 81, 24.219, 55.744)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rvts_warnings (id, responder_unit_id, distance_m, direction, recommendation) VALUES
  ('RVTS-01', 'R-12', 126, 'north-east', 'Maintain lane discipline and clear the fast lane immediately.')
ON CONFLICT (id) DO NOTHING;

