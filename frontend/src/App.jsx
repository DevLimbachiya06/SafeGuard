import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from "react-leaflet";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
const SOCKET_URL = API_BASE.replace(/\/api\/?$/, "");

const defaultDashboard = {
  summary: {
    activeIncidents: 3,
    respondersLive: 3,
    alertsActive: 2,
    telemetryStreams: 3,
    hospitalsReady: 3,
    averageRisk: 76,
    avgDispatchMinutes: 24,
    rvtsWarnings: 1,
    coveragePct: 88,
  },
  incidents: [],
  responders: [],
  telemetry: [],
  alerts: [],
  hospitals: [],
  riskZones: [],
  rvtsWarnings: [],
};

const initialLogin = {
  emiratesId: "784-1989-1111111-1",
  password: "commander-demo-2026",
};

const demoNfcLogin = {
  emiratesId: "784-1988-2222222-2",
  password: "responder-demo-2026",
};

const demoBiometricLogin = {
  emiratesId: "784-1989-1111111-1",
  password: "commander-demo-2026",
};

const mapBounds = {
  minLat: 22.6,
  maxLat: 26.5,
  minLng: 51.4,
  maxLng: 56.6,
};

const severityPalette = {
  critical: "#ff5d4f",
  high: "#ffcb5b",
  moderate: "#33d3c0",
  low: "#78a9ff",
};

const toPercent = (value, max) => Math.max(0, Math.min(100, (value / max) * 100));

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `Request failed with ${response.status}`);
  }
  return response.json();
};

function Badge({ children, tone = "neutral" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function Metric({ label, value, note }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <small>{label}</small>
      {note ? <div className="meta">{note}</div> : null}
    </div>
  );
}

function MapVisualization({ incidents, responders, hospitals, riskZones }) {
  const mapBoundsLeaflet = useMemo(
    () => [
      [mapBounds.minLat, mapBounds.minLng],
      [mapBounds.maxLat, mapBounds.maxLng],
    ],
    []
  );

  const layers = useMemo(() => {
    const toCoordinate = (latitude, longitude) => {
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return [lat, lng];
    };

    const incidentPoints = incidents.map((item) => ({
      ...item,
      position: toCoordinate(item.latitude, item.longitude),
      color: severityPalette[item.severity] || severityPalette.moderate,
    })).filter((item) => item.position);
    const responderPoints = responders.map((item) => ({
      ...item,
      position: toCoordinate(item.latitude, item.longitude),
    })).filter((item) => item.position);
    const hospitalPoints = hospitals.map((item) => ({
      ...item,
      position: toCoordinate(item.latitude, item.longitude),
    })).filter((item) => item.position);
    const zoneRings = riskZones.map((item) => ({
      ...item,
      position: toCoordinate(item.center?.latitude ?? item.latitude ?? 25, item.center?.longitude ?? item.longitude ?? 55),
      riskTone: item.riskScore > 85 ? "critical" : item.riskScore > 70 ? "high" : "moderate",
    })).filter((item) => item.position);

    return { incidentPoints, responderPoints, hospitalPoints, zoneRings };
  }, [incidents, responders, hospitals, riskZones]);

  return (
    <div className="map-surface">
      <MapContainer
        center={[24.4539, 54.3773]}
        zoom={7}
        minZoom={6}
        maxZoom={14}
        maxBounds={mapBoundsLeaflet}
        maxBoundsViscosity={0.8}
        scrollWheelZoom
        className="leaflet-live-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {layers.zoneRings.map((zone) => (
          <Circle
            key={zone.zoneId}
            center={zone.position}
            radius={Math.max(6000, (zone.radiusKm || 6) * 1000)}
            pathOptions={{
              color: severityPalette[zone.riskTone],
              fillColor: severityPalette[zone.riskTone],
              fillOpacity: 0.2,
              weight: 2,
            }}
          >
            <Tooltip sticky>
              {zone.zoneName} · Risk {zone.riskScore}%
            </Tooltip>
          </Circle>
        ))}

        {layers.incidentPoints.map((incident) => (
          <CircleMarker
            key={incident.id}
            center={incident.position}
            radius={9}
            pathOptions={{
              color: incident.color,
              fillColor: incident.color,
              fillOpacity: 0.8,
              weight: 2,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]} sticky>
              {incident.type}
            </Tooltip>
            <Popup>
              <strong>{incident.title}</strong>
              <div>{incident.zoneName} · {incident.severity}</div>
              <div>ETA {incident.etaMinutes} min</div>
            </Popup>
          </CircleMarker>
        ))}

        {layers.responderPoints.map((responder) => (
          <CircleMarker
            key={responder.unitId}
            center={responder.position}
            radius={7}
            pathOptions={{
              color: "#78a9ff",
              fillColor: "#78a9ff",
              fillOpacity: 0.85,
              weight: 2,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]} sticky>
              {responder.unitId} · {responder.status}
            </Tooltip>
          </CircleMarker>
        ))}

        {layers.hospitalPoints.map((hospital) => (
          <CircleMarker
            key={hospital.id}
            center={hospital.position}
            radius={6}
            pathOptions={{
              color: "#33d3c0",
              fillColor: "#33d3c0",
              fillOpacity: 0.85,
              weight: 2,
            }}
          >
            <Tooltip direction="right" offset={[8, 0]} sticky>
              {hospital.name}
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="map-legend">
        <span><i className="legend-dot incident" /> Incidents</span>
        <span><i className="legend-dot responder" /> Responders</span>
        <span><i className="legend-dot hospital" /> Hospitals</span>
      </div>
    </div>
  );
}

function LoginModal({ onPasswordLogin, onNfcLogin, onBiometricLogin, busy, initialValue }) {
  const [form, setForm] = useState(initialValue);
  const [rolePreset, setRolePreset] = useState("commander");

  return (
    <div className="login-overlay">
      <div className="modal">
        <div className="modal-head">
        </div>
        <form
          className="login-form"
          onSubmit={(event) => {
            event.preventDefault();
            onPasswordLogin(form);
          }}
        >
          <label className="field">
            <span>Emirates ID</span>
            <input
              value={form.emiratesId}
              onChange={(event) => setForm((current) => ({ ...current, emiratesId: event.target.value }))}
              placeholder="784-1989-1111111-1"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="demo password"
            />
          </label>
          <label className="field">
            <span>Role preset</span>
            <select value={rolePreset} onChange={(event) => setRolePreset(event.target.value)}>
              <option value="commander">Commander</option>
              <option value="responder">Responder</option>
            </select>
          </label>
          <div className="modal-actions" style={{ gridColumn: "1 / -1" }}>
            <button className="cta primary" type="submit" disabled={busy}>
              {busy ? "Signing in..." : "Sign in with password"}
            </button>
            <button
              type="button"
              className="cta"
              onClick={onNfcLogin}
              disabled={busy}
            >
              NFC Employee ID login-Demo
            </button>
            <button
              type="button"
              className="cta secondary"
              onClick={onBiometricLogin}
              disabled={busy}
            >
              Biometric login-Demo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [stage, setStage] = useState("splash");
  const [dashboard, setDashboard] = useState(defaultDashboard);
  const [predictions, setPredictions] = useState([]);
  const [health, setHealth] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("safeguard-token") || "");
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("safeguard-user");
    return saved ? JSON.parse(saved) : null;
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [incidentForm, setIncidentForm] = useState({
    title: "Flood risk spike near E611 corridor",
    type: "Flood",
    severity: "critical",
    zoneId: "z-dubai",
    zoneName: "Dubai South",
    latitude: 25.062,
    longitude: 55.231,
  });
  const [alertForm, setAlertForm] = useState({
    title: "Public evacuation notice",
    message: "Move to safe assembly points and follow lane guidance from responders.",
    severity: "high",
    zoneName: "Dubai South",
  });

  const headers = useMemo(() => {
    const base = { "Content-Type": "application/json" };
    return token ? { ...base, Authorization: `Bearer ${token}` } : base;
  }, [token]);

  const refresh = async () => {
    try {
      const [healthData, dashboardData, predictionData] = await Promise.all([
        fetchJson(`${API_BASE}/health`),
        fetchJson(`${API_BASE}/dashboard`),
        fetchJson(`${API_BASE}/predictions`),
      ]);
      setHealth(healthData);
      setDashboard(dashboardData);
      setPredictions(predictionData.matrix || []);
    } catch (error) {
      setMessage({ tone: "error", title: "API offline", text: error.message });
    }
  };

  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setStage("login");
    }, 3000);

    return () => clearTimeout(splashTimer);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (stage !== "app") {
      return undefined;
    }

    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });

    socket.on("state:sync", (nextState) => {
      if (!nextState) return;
      setDashboard((current) => ({
        ...current,
        ...nextState,
        summary: nextState.summary || current.summary,
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== "app" || !token) {
      return;
    }

    const me = async () => {
      try {
        const profile = await fetchJson(`${API_BASE}/auth/me`, { headers });
        setUser(profile);
      } catch {
        localStorage.removeItem("safeguard-token");
        localStorage.removeItem("safeguard-user");
        setToken("");
        setUser(null);
        setStage("login");
      }
    };

    void me();
  }, [headers, stage, token]);

  const completeLogin = async (payload, title = "Signed in") => {
    localStorage.setItem("safeguard-token", payload.token);
    localStorage.setItem("safeguard-user", JSON.stringify(payload.user));
    setToken(payload.token);
    setUser(payload.user);
    setStage("app");
    setMessage({ tone: "success", title, text: `Welcome back, ${payload.user.name}.` });
    await refresh();
  };

  const passwordLogin = async (form) => {
    setBusy(true);
    try {
      const payload = await fetchJson(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      await completeLogin(payload, "Signed in");
    } catch (error) {
      setMessage({ tone: "error", title: "Login failed", text: "Check your Emirates ID and password." });
    } finally {
      setBusy(false);
    }
  };

  const nfcEmployeeLogin = async () => {
    setBusy(true);
    try {
      const payload = await fetchJson(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(demoNfcLogin),
      });
      await completeLogin(payload, "NFC verified");
    } catch {
      setMessage({ tone: "error", title: "NFC login failed", text: "Demo NFC credential is not available right now." });
    } finally {
      setBusy(false);
    }
  };

  const biometricLogin = async () => {
    setBusy(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 700));

      if (token) {
        const profile = await fetchJson(`${API_BASE}/auth/me`, {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
        localStorage.setItem("safeguard-user", JSON.stringify(profile));
        setUser(profile);
        setStage("app");
        setMessage({ tone: "success", title: "Biometric verified", text: `Welcome back, ${profile.name}.` });
        await refresh();
        return;
      }

      const payload = await fetchJson(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(demoBiometricLogin),
      });
      await completeLogin(payload, "Biometric verified");
    } catch {
      setMessage({ tone: "error", title: "Biometric failed", text: "Biometric verification could not be completed." });
    } finally {
      setBusy(false);
    }
  };

  const signOut = () => {
    localStorage.removeItem("safeguard-token");
    localStorage.removeItem("safeguard-user");
    setToken("");
    setUser(null);
    setStage("login");
    setMessage({ tone: "info", title: "Signed out", text: "Please sign in again to continue." });
  };

  const dispatchIncident = async () => {
    try {
      await fetchJson(`${API_BASE}/incidents`, {
        method: "POST",
        headers,
        body: JSON.stringify(incidentForm),
      });
      setMessage({ tone: "success", title: "Incident created", text: `${incidentForm.title} is now active.` });
      await refresh();
    } catch (error) {
      setMessage({ tone: "error", title: "Incident failed", text: error.message });
    }
  };

  const sendAlert = async () => {
    try {
      await fetchJson(`${API_BASE}/alerts/send`, {
        method: "POST",
        headers,
        body: JSON.stringify(alertForm),
      });
      setMessage({ tone: "success", title: "Alert sent", text: `${alertForm.title} broadcasted successfully.` });
      await refresh();
    } catch (error) {
      setMessage({ tone: "error", title: "Alert failed", text: error.message });
    }
  };

  const sendSos = async () => {
    try {
      const location = await new Promise((resolve) => {
        if (!navigator.geolocation) {
          resolve({ latitude: 24.466, longitude: 54.36 });
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
          () => resolve({ latitude: 24.466, longitude: 54.36 }),
          { timeout: 3000 }
        );
      });

      await fetchJson(`${API_BASE}/sos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          citizenName: user?.name || "Citizen demo",
          emiratesId: user?.emiratesId || "guest",
          latitude: location.latitude,
          longitude: location.longitude,
          emergencyType: "SOS",
          message: "Immediate assistance required from the mobile app",
        }),
      });
      setMessage({ tone: "success", title: "SOS sent", text: "Responder dispatch has been triggered." });
      await refresh();
    } catch (error) {
      setMessage({ tone: "error", title: "SOS failed", text: error.message });
    }
  };

  const summary = dashboard.summary;
  const topAlert = dashboard.alerts[0];
  const topRisk = dashboard.riskZones[0];

  if (stage === "splash") {
    return (
      <div className="app-shell">
        <div className="auth-shell">
          <div className="splash-card">
            <img className="brand-logo" src="/logo.png" alt="SafeGuard" />
            <h1>SafeGuard</h1>
            <p>Responder and citizen coordination platform</p>
            <div className="mini">Loading secure command environment...</div>
          </div>
        </div>

        {message ? (
          <div className={`toast toast-${message.tone}`}>
            <strong>{message.title}</strong>
            <div className="mini">{message.text}</div>
          </div>
        ) : null}
      </div>
    );
  }

  if (stage === "login") {
    return (
      <div className="app-shell">
        <LoginModal
          onPasswordLogin={passwordLogin}
          onNfcLogin={nfcEmployeeLogin}
          onBiometricLogin={biometricLogin}
          busy={busy}
          initialValue={initialLogin}
        />

        {message ? (
          <div className={`toast toast-${message.tone}`}>
            <strong>{message.title}</strong>
            <div className="mini">{message.text}</div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="app-shell">

      <div className="page">
        <header className="topbar">
          <div className="brand">
            <img className="brand-logo" src="/logo.png" alt="SafeGuard" />
            <div>
              <h1>SafeGuard</h1>
              <p>{health ? `API ${health.status} · ${health.mode}` : "Checking platform status"}</p>
            </div>
          </div>

          <div className="dock-row">
            <span className="status-chip">Active: {summary.activeIncidents}</span>
            <span className="status-chip">RVTS: {summary.rvtsWarnings}</span>
            <span className="status-chip mobile-hide">Coverage: {summary.coveragePct}%</span>
            {user ? <span className="status-chip">{user.name}</span> : null}
            <button className="cta secondary" onClick={() => setStage("login")}>{token ? "Switch account" : "Sign in"}</button>
            {token ? <button className="cta" onClick={signOut}>Sign out</button> : null}
          </div>
        </header>

        <section className="hero">
          <div className="hero-main">
            <div className="hero-actions">
              <button className="cta primary" onClick={dispatchIncident}>Create demo incident</button>
              <button className="cta secondary" onClick={sendAlert}>Broadcast public alert</button>
              <button className="cta" onClick={refresh}>Refresh live data</button>
            </div>

            <div className="stats-grid">
              <Metric label="Average dispatch" value={`${summary.avgDispatchMinutes}m`} note="Across active incidents" />
              <Metric label="Sensor coverage" value={`${summary.coveragePct}%`} note="Microclimate nodes online" />
              <Metric label="Risk score" value={summary.averageRisk} note="Dynamic matrix average" />
              <Metric label="Hospitals ready" value={summary.hospitalsReady} />
            </div>

            <div className="live-strip">
              <div className="ticker">
                {[...(dashboard.alerts.length ? dashboard.alerts : [{ title: "No active alerts", message: "Platform is in monitoring mode" }]), ...(dashboard.alerts.length ? dashboard.alerts : [{ title: "No active alerts", message: "Platform is in monitoring mode" }])].map((alert, index) => (
                  <span key={`${alert.title}-${index}`}>{alert.title.toUpperCase()} · {alert.message}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="hero-side">
            <div className="summary-card">
              <small className="subtle">Current operational theatre</small>
              <strong>{topRisk?.zoneName || "Dubai South"}</strong>
              <div className="mini">{topRisk?.prediction || "Awaiting risk model update"}</div>
              <div className="status-row" style={{ marginTop: 14 }}>
                <span className="pill">Confidence {Math.round((topRisk?.confidence || 0.9) * 100)}%</span>
                <span className="pill">ETA {topRisk?.etaMinutes || 11}m</span>
              </div>
            </div>

            <div className="summary-card" style={{ marginTop: 14 }}>
              <small className="subtle">Latest SOS / alert</small>
              <strong>{topAlert?.title || "Citizen SOS received"}</strong>
              <div className="mini">{topAlert?.message || "Nearest responders have been notified."}</div>
            </div>

            <div className="summary-card" style={{ marginTop: 14 }}>
              <small className="subtle">Operational signal</small>
              <strong>{summary.respondersLive} responders live</strong>
              <div className="mini">{summary.telemetryStreams} telemetry streams and {summary.alertsActive} broadcast alerts are active.</div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="map-card">
            <div className="map-head">
              <div>
                <Badge tone="info">Live hazard map</Badge>
                <h3 style={{ marginTop: 10 }}>Incident, responder, and hospital overlay</h3>
              </div>
              <span className="pill">RVTS lane clearing</span>
            </div>
            <MapVisualization
              incidents={dashboard.incidents}
              responders={dashboard.responders}
              hospitals={dashboard.hospitals}
              riskZones={dashboard.riskZones}
            />
            <div className="dock-row" style={{ marginTop: 14 }}>
              <div className="dock-item"><strong>{dashboard.incidents.length}</strong><small>Incidents tracked</small></div>
              <div className="dock-item"><strong>{dashboard.responders.length}</strong><small>Responder units</small></div>
              <div className="dock-item"><strong>{dashboard.hospitals.length}</strong><small>Hospitals online</small></div>
            </div>
          </div>
        </section>

        <section className="section section-grid">
          <div className="panel">
            <div className="panel-head">
              <div>
                <Badge tone="warning">Prediction matrix</Badge>
                <h3 style={{ marginTop: 10 }}>Dynamic risk scoring</h3>
              </div>
              <span className="mini">Updated every 5 seconds</span>
            </div>

            <div className="risk-grid" style={{ marginTop: 16 }}>
              {predictions.map((zone) => (
                <div key={zone.zoneId} className="risk-card">
                  <div className="status-row">
                    <strong>{zone.zoneName}</strong>
                    <span className="badge">{zone.trend}</span>
                  </div>
                  <div className="mini">{zone.prediction}</div>
                  <div className="risk-bar"><span style={{ width: `${zone.riskScore}%` }} /></div>
                  <div className="status-row" style={{ marginTop: 12 }}>
                    <span className="mini">Risk {zone.riskScore}%</span>
                    <span className="mini">Confidence {Math.round(zone.confidence * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="alert-card" style={{ marginTop: 16 }}>
              <h4>Telemetry feed</h4>
              <div className="list" style={{ marginTop: 12 }}>
                {dashboard.telemetry.map((item) => (
                  <div className="feed-item" key={item.sourceId}>
                    <div>
                      <strong>{item.locationName}</strong>
                      <span>{item.type} · AQI {item.airQualityIndex} · Flood {item.floodLevelM}m · {item.temperatureC}°C</span>
                    </div>
                    <Badge tone={item.riskBand}>{item.riskBand}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div>
                <Badge tone="info">Hospital recommendation</Badge>
                <h3 style={{ marginTop: 10 }}>Closest readiness and bed capacity</h3>
              </div>
            </div>
            <div className="list" style={{ marginTop: 14 }}>
              {dashboard.hospitals.map((hospital) => (
                <div className="feed-item" key={hospital.id}>
                  <div>
                    <strong>{hospital.name}</strong>
                    <span>{hospital.emirate} · {hospital.availableBeds} beds free · ICU {hospital.icuAvailable}</span>
                  </div>
                  <div className="mini">Occupancy {hospital.occupancyPct}%</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section command-strip">
          <div className="command-card">
            <div className="planner-head">
              <div>
                <Badge tone="warning">Assisted response</Badge>
                <h3 style={{ marginTop: 10 }}>Dispatch a new incident</h3>
              </div>
            </div>
            <div className="login-form" style={{ marginTop: 14 }}>
              <label className="field">
                <span>Title</span>
                <input value={incidentForm.title} onChange={(event) => setIncidentForm((current) => ({ ...current, title: event.target.value }))} />
              </label>
              <label className="field">
                <span>Type</span>
                <select value={incidentForm.type} onChange={(event) => setIncidentForm((current) => ({ ...current, type: event.target.value }))}>
                  <option>Flood</option>
                  <option>Sandstorm</option>
                  <option>Heatwave</option>
                  <option>Rain</option>
                  <option>Panic</option>
                </select>
              </label>
              <label className="field">
                <span>Severity</span>
                <select value={incidentForm.severity} onChange={(event) => setIncidentForm((current) => ({ ...current, severity: event.target.value }))}>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="moderate">Moderate</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <label className="field">
                <span>Zone</span>
                <input value={incidentForm.zoneName} onChange={(event) => setIncidentForm((current) => ({ ...current, zoneName: event.target.value }))} />
              </label>
              <label className="field">
                <span>Latitude</span>
                <input type="number" step="0.0001" value={incidentForm.latitude} onChange={(event) => setIncidentForm((current) => ({ ...current, latitude: Number(event.target.value) }))} />
              </label>
              <label className="field">
                <span>Longitude</span>
                <input type="number" step="0.0001" value={incidentForm.longitude} onChange={(event) => setIncidentForm((current) => ({ ...current, longitude: Number(event.target.value) }))} />
              </label>
            </div>
            <div className="action-row" style={{ marginTop: 14 }}>
              <button className="action-btn primary" onClick={dispatchIncident}>Create incident</button>
              <button className="action-btn secondary" onClick={() => setIncidentForm((current) => ({ ...current, type: "Flood", severity: "critical" }))}>Load flood template</button>
            </div>
          </div>

          <div className="dock-card">
            <div className="planner-head">
              <div>
                <Badge tone="critical">Geofenced public alert</Badge>
                <h3 style={{ marginTop: 10 }}>Broadcast evacuation guidance</h3>
              </div>
            </div>
            <div className="login-form" style={{ marginTop: 14 }}>
              <label className="field" style={{ gridColumn: "1 / -1" }}>
                <span>Title</span>
                <input value={alertForm.title} onChange={(event) => setAlertForm((current) => ({ ...current, title: event.target.value }))} />
              </label>
              <label className="field" style={{ gridColumn: "1 / -1" }}>
                <span>Message</span>
                <textarea value={alertForm.message} onChange={(event) => setAlertForm((current) => ({ ...current, message: event.target.value }))} />
              </label>
              <label className="field">
                <span>Severity</span>
                <select value={alertForm.severity} onChange={(event) => setAlertForm((current) => ({ ...current, severity: event.target.value }))}>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="moderate">Moderate</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <label className="field">
                <span>Zone</span>
                <input value={alertForm.zoneName} onChange={(event) => setAlertForm((current) => ({ ...current, zoneName: event.target.value }))} />
              </label>
            </div>
            <div className="action-row" style={{ marginTop: 14 }}>
              <button className="action-btn primary" onClick={sendAlert}>Send alert</button>
              <button className="action-btn secondary" onClick={refresh}>Sync alerts</button>
            </div>
          </div>
        </section>

        <section className="section section-grid">
          <div className="panel">
            <div className="panel-head">
              <div>
                <Badge tone="danger">Incident queue</Badge>
                <h3 style={{ marginTop: 10 }}>Active coordination view</h3>
              </div>
            </div>
            <div className="list" style={{ marginTop: 14 }}>
              {dashboard.incidents.map((incident) => (
                <div className="feed-item" key={incident.id}>
                  <div>
                    <strong>{incident.title}</strong>
                    <span>{incident.zoneName} · {incident.source} · ETA {incident.etaMinutes}m</span>
                  </div>
                  <Badge tone={incident.severity}>{incident.status}</Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div>
                <Badge tone="info">Public alert feed</Badge>
                <h3 style={{ marginTop: 10 }}>Citizen-facing updates</h3>
              </div>
            </div>
            <div className="list" style={{ marginTop: 14 }}>
              {dashboard.alerts.map((alert) => (
                <div className="alert-item" key={alert.id}>
                  <div>
                    <strong>{alert.title}</strong>
                    <span>{alert.message}</span>
                  </div>
                  <div className="mini">{alert.zoneName}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {message ? (
        <div className={`toast toast-${message.tone}`}>
          <strong>{message.title}</strong>
          <div className="mini">{message.text}</div>
        </div>
      ) : null}
    </div>
  );
}
