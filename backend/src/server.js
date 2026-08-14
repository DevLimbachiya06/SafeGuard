import http from "http";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Server } from "socket.io";
import bcrypt from "bcryptjs";
import { authMiddleware, signToken } from "./services/auth.js";
import { createDemoState, snapshot, summarizeState } from "./data/demo-state.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const io = new Server(server, {
  cors: { origin: allowedOrigins },
});

const state = createDemoState();

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "2mb" }));

const distanceMeters = (a, b) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const haversine =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const ensureNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const nextIncidentId = () => `INC-${state.nextIncidentId++}`;
const nextAlertId = () => `ALT-${state.nextAlertId++}`;
const nextTelemetryId = () => `TEL-${state.nextTelemetryId++}`;
const nextRvtsId = () => `RVTS-${state.nextRvtsId++}`;

const buildAlertMessage = (incident) => {
  if (incident.type === "Flood") return "Move to higher ground, clear access lanes, and activate rescue routing.";
  if (incident.type === "Sandstorm") return "Reduce speed, keep headlights on, and avoid exposed highway sections.";
  if (incident.type === "Heatwave") return "Open cooling points, hydrate often, and monitor vulnerable residents.";
  return "Follow official guidance and keep evacuation channels open.";
};

const createRiskPrediction = (type) => {
  const catalog = {
    Flood: { score: 92, confidence: 0.94, etaMinutes: 11, trend: "rising" },
    Sandstorm: { score: 77, confidence: 0.88, etaMinutes: 24, trend: "steady" },
    Heatwave: { score: 61, confidence: 0.83, etaMinutes: 36, trend: "falling" },
    Rain: { score: 68, confidence: 0.86, etaMinutes: 19, trend: "rising" },
  };
  return catalog[type] || { score: 55, confidence: 0.8, etaMinutes: 30, trend: "steady" };
};

const syncRVTS = () => {
  state.rvtsWarnings = state.responders.flatMap((responder) => {
    const nearest = state.incidents
      .filter((incident) => incident.status !== "resolved")
      .map((incident) => ({ incident, distance: distanceMeters(responder, incident) }))
      .sort((left, right) => left.distance - right.distance)[0];

    if (!nearest || nearest.distance > 1000) return [];

    const distanceRounded = Math.round(nearest.distance);
    return [{
      id: nextRvtsId(),
      responderUnitId: responder.unitId,
      distanceM: distanceRounded,
      direction: responder.latitude > nearest.incident.latitude ? "south-west" : "north-east",
      recommendation: distanceRounded < 200
        ? "Yield immediately and clear the fast lane."
        : "Maintain speed discipline and prepare to clear the lane.",
      updatedAt: new Date().toISOString(),
    }];
  });
};

const updateAlertFeed = (alert) => {
  state.alerts.unshift(alert);
  state.alerts = state.alerts.slice(0, 12);
};

const broadcastState = () => {
  io.emit("state:sync", {
    ...snapshot(state),
    summary: summarizeState(state),
  });
};

const addIncident = (incident) => {
  state.incidents.unshift(incident);
  state.incidents = state.incidents.slice(0, 20);
  const risk = createRiskPrediction(incident.type);
  const alert = {
    id: nextAlertId(),
    title: `${incident.type} response activated`,
    message: buildAlertMessage(incident),
    severity: incident.severity,
    zoneName: incident.zoneName,
    channel: "App push + SMS",
    createdAt: new Date().toISOString(),
  };
  updateAlertFeed(alert);
  const zone = state.riskZones.find((entry) => entry.zoneId === incident.zoneId);
  if (zone) {
    zone.riskScore = risk.score;
    zone.confidence = risk.confidence;
    zone.etaMinutes = risk.etaMinutes;
    zone.trend = risk.trend;
    zone.prediction = `${incident.type} confidence elevated across ${incident.zoneName}.`;
  }
  syncRVTS();
  broadcastState();
  io.emit("incident:new", incident);
  io.emit("alert:broadcast", alert);
  return incident;
};

const updateTelemetryDerivedRisk = () => {
  state.telemetry.forEach((entry) => {
    const targetZone = state.riskZones.find((zone) => zone.zoneName === entry.locationName || zone.zoneName.includes(entry.locationName));
    if (!targetZone) return;
    if (entry.floodLevelM >= 1.1) {
      targetZone.riskScore = Math.max(targetZone.riskScore, 89);
      targetZone.trend = "rising";
    }
    if (entry.temperatureC >= 43) targetZone.riskScore = Math.max(targetZone.riskScore, 72);
    if ((entry.airQualityIndex || 0) >= 150) targetZone.riskScore = Math.max(targetZone.riskScore, 80);
  });
};

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    mode: "demo",
    timestamp: new Date().toISOString(),
    services: { postgres: "schema-ready", redis: "optional", socket: "online" },
    counts: summarizeState(state),
  });
});

app.post("/api/auth/login", async (req, res) => {
  const { emiratesId, password } = req.body || {};
  if (!emiratesId || !password) return res.status(400).json({ error: "missing fields" });

  const user = state.users.find((entry) => entry.emiratesId === emiratesId.trim());
  if (!user) return res.status(401).json({ error: "invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid credentials" });

  const token = signToken({
    sub: user.id,
    name: user.fullName,
    role: user.role,
    emiratesId: user.emiratesId,
    agency: user.agency,
  });

  res.json({
    token,
    user: {
      id: user.id,
      name: user.fullName,
      role: user.role,
      agency: user.agency,
      emiratesId: user.emiratesId,
      mobilePin: user.mobilePin,
    },
  });
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  const user = state.users.find((entry) => entry.id === req.user.sub);
  if (!user) return res.status(404).json({ error: "not found" });
  res.json({ id: user.id, name: user.fullName, role: user.role, agency: user.agency, emiratesId: user.emiratesId });
});

app.get("/api/dashboard", (_req, res) => {
  res.json({
    summary: summarizeState(state),
    incidents: state.incidents,
    responders: state.responders,
    telemetry: state.telemetry,
    alerts: state.alerts,
    hospitals: state.hospitals,
    riskZones: state.riskZones,
    rvtsWarnings: state.rvtsWarnings,
  });
});

app.get("/api/predictions", (_req, res) => {
  res.json({
    matrix: state.riskZones.map((zone) => ({
      zoneId: zone.zoneId,
      zoneName: zone.zoneName,
      riskScore: zone.riskScore,
      confidence: zone.confidence,
      trend: zone.trend,
      etaMinutes: zone.etaMinutes,
      prediction: zone.prediction,
    })),
    headline: "AI-assisted disaster prediction matrix",
  });
});

app.get("/api/incidents", (req, res) => {
  const { status } = req.query;
  const incidents = status ? state.incidents.filter((incident) => incident.status === status) : state.incidents;
  res.json({ incidents });
});

app.post("/api/incidents", authMiddleware, (req, res) => {
  const { title, type, severity = "moderate", latitude, longitude, zoneId, zoneName, source = "manual", etaMinutes = 18 } = req.body || {};
  if (!title || !type || latitude == null || longitude == null) return res.status(400).json({ error: "missing fields" });

  const incident = {
    id: nextIncidentId(),
    title,
    type,
    severity,
    status: "active",
    zoneId: zoneId || "z-manual",
    zoneName: zoneName || "Manual zone",
    latitude: ensureNumber(latitude),
    longitude: ensureNumber(longitude),
    source,
    etaMinutes: ensureNumber(etaMinutes, 18),
    recommendedAction: buildAlertMessage({ type, zoneName }),
    createdAt: new Date().toISOString(),
  };

  addIncident(incident);
  res.status(201).json({ incident });
});

app.get("/api/responders", (_req, res) => {
  res.json(state.responders);
});

app.patch("/api/responders/location", authMiddleware, (req, res) => {
  const { unitId, latitude, longitude, heading, status } = req.body || {};
  const responder = state.responders.find((entry) => entry.unitId === unitId);
  if (!responder) return res.status(404).json({ error: "not found" });

  if (latitude != null) responder.latitude = ensureNumber(latitude);
  if (longitude != null) responder.longitude = ensureNumber(longitude);
  if (heading != null) responder.heading = ensureNumber(heading);
  if (status) responder.status = status;
  responder.updatedAt = new Date().toISOString();

  syncRVTS();
  broadcastState();
  io.emit("responder:location_update", responder);
  res.json({ responder });
});

app.post("/api/responders/dispatch", authMiddleware, (req, res) => {
  const { unitId, incidentId } = req.body || {};
  const responder = state.responders.find((entry) => entry.unitId === unitId);
  const incident = state.incidents.find((entry) => entry.id === incidentId);
  if (!responder || !incident) return res.status(404).json({ error: "not found" });

  responder.status = "deployed";
  responder.assignedIncidentId = incident.id;
  incident.status = "active";
  incident.dispatchUnitId = responder.unitId;
  incident.etaMinutes = Math.max(6, incident.etaMinutes - 4);

  syncRVTS();
  broadcastState();
  io.emit("responder:dispatched", { unitId: responder.unitId, incidentId: incident.id });
  res.json({ responder, incident });
});

app.get("/api/risk-zones", (_req, res) => {
  res.json(state.riskZones);
});

app.get("/api/telemetry/live", (_req, res) => {
  res.json(state.telemetry);
});

app.post("/api/telemetry/ingest", (req, res) => {
  const { sourceId, type, locationName, latitude, longitude, temperatureC, airQualityIndex, floodLevelM, humidityPct } = req.body || {};
  if (!sourceId || !type || latitude == null || longitude == null) return res.status(400).json({ error: "missing fields" });

  const telemetry = {
    id: nextTelemetryId(),
    sourceId,
    type,
    locationName: locationName || "Unknown zone",
    latitude: ensureNumber(latitude),
    longitude: ensureNumber(longitude),
    temperatureC: ensureNumber(temperatureC),
    airQualityIndex: ensureNumber(airQualityIndex),
    floodLevelM: ensureNumber(floodLevelM),
    humidityPct: ensureNumber(humidityPct),
    riskBand: floodLevelM >= 1 ? "critical" : airQualityIndex >= 150 ? "high" : "moderate",
    recordedAt: new Date().toISOString(),
  };

  state.telemetry.unshift(telemetry);
  state.telemetry = state.telemetry.slice(0, 15);
  updateTelemetryDerivedRisk();
  syncRVTS();
  broadcastState();
  io.emit("sensor:update", telemetry);
  io.emit("weather:update", telemetry);
  res.status(201).json({ telemetry });
});

app.get("/api/alerts/active", (_req, res) => {
  res.json(state.alerts);
});

app.post("/api/alerts/send", authMiddleware, (req, res) => {
  const { title, message, severity = "moderate", zoneName = "All zones", channel = "App push" } = req.body || {};
  if (!title || !message) return res.status(400).json({ error: "missing fields" });

  const alert = {
    id: nextAlertId(),
    title,
    message,
    severity,
    zoneName,
    channel,
    createdAt: new Date().toISOString(),
  };

  updateAlertFeed(alert);
  broadcastState();
  io.emit("alert:broadcast", alert);
  res.status(201).json({ alert });
});

app.get("/api/hospitals", (_req, res) => {
  res.json(state.hospitals);
});

app.get("/api/rvts/lanes", (_req, res) => {
  syncRVTS();
  res.json({ warnings: state.rvtsWarnings, activeCount: state.rvtsWarnings.length });
});

app.post("/api/sos", (req, res) => {
  const { citizenName = "Anonymous", emiratesId = "guest", latitude, longitude, emergencyType = "SOS", message = "Emergency assistance requested" } = req.body || {};
  if (latitude == null || longitude == null) return res.status(400).json({ error: "missing fields" });

  const incident = {
    id: nextIncidentId(),
    title: `${emergencyType} from ${citizenName}`,
    type: emergencyType === "SOS" ? "Panic" : emergencyType,
    severity: "critical",
    status: "active",
    zoneId: "z-sos",
    zoneName: "Citizen emergency zone",
    latitude: ensureNumber(latitude),
    longitude: ensureNumber(longitude),
    source: `SOS by ${emiratesId}`,
    etaMinutes: 8,
    recommendedAction: message,
    createdAt: new Date().toISOString(),
  };

  addIncident(incident);
  const alert = {
    id: nextAlertId(),
    title: "Citizen SOS received",
    message: `${citizenName} requested immediate support. Dispatching nearest responders now.`,
    severity: "critical",
    zoneName: incident.zoneName,
    channel: "Mobile emergency button",
    createdAt: new Date().toISOString(),
  };

  updateAlertFeed(alert);
  syncRVTS();
  broadcastState();
  io.emit("panic:incoming", incident);
  io.emit("alert:broadcast", alert);
  res.status(201).json({ incident, alert });
});

io.on("connection", (socket) => {
  socket.emit("state:sync", {
    ...snapshot(state),
    summary: summarizeState(state),
  });

  socket.on("responder:location", (payload) => {
    const { unitId, latitude, longitude, heading } = payload || {};
    const responder = state.responders.find((entry) => entry.unitId === unitId);
    if (!responder) return;
    if (latitude != null) responder.latitude = ensureNumber(latitude);
    if (longitude != null) responder.longitude = ensureNumber(longitude);
    if (heading != null) responder.heading = ensureNumber(heading);
    responder.updatedAt = new Date().toISOString();
    syncRVTS();
    broadcastState();
    socket.broadcast.emit("responder:location_update", responder);
  });
});

const port = Number(process.env.PORT || 8080);

broadcastState();

server.listen(port, () => {
  console.log(`SafeGuard API listening on ${port}`);
});
