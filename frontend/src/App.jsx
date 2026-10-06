import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from "react-leaflet";
import ProfileMenu from "./components/ProfileMenu";

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

const riskTone = (score) => score >= 85 ? "critical" : score >= 75 ? "high" : score >= 60 ? "moderate" : "low";
const trendTone = (trend) => trend === "rising" ? "critical" : trend === "steady" ? "normal" : "low";
const telemetryIcon = (zoneName) => zoneName.includes("Dubai") ? "≋" : zoneName.includes("Al Ain") ? "✦" : "☼";
const readinessTone = (occupancy) => occupancy >= 85 ? "critical" : occupancy >= 75 ? "high" : "low";

function TelemetryMetric({ label, value, tone }) {
  return <span className={`telemetry-metric ${tone || ""}`}>{label} <strong>{value}</strong></span>;
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

const roleLabels = {
  commander: "Command Center / Admin",
  responder: "First Responder / Field Operator",
  officer: "Public Safety Officer",
  citizen: "Public Safety Officer",
};

function LoginModal({ onPasswordLogin, onLoginComplete, onNfcLogin, onBiometricLogin, busy, initialValue }) {
  const [form, setForm] = useState(initialValue);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [step, setStep] = useState("credentials");
  const [otp, setOtp] = useState("");
  const [pendingLogin, setPendingLogin] = useState(null);
  const [error, setError] = useState("");

  const submitCredentials = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.emiratesId.trim() || form.password.length < 8) {
      setError("Enter a valid Government ID and password.");
      return;
    }
    try {
      const payload = await onPasswordLogin(form);
      setPendingLogin(payload);
      setStep("mfa");
    } catch {
      setError("Invalid agency credentials. Verify your ID and password.");
    }
  };

  const verifyOtp = (event) => {
    event.preventDefault();
    if (otp !== "246810") {
      setError("The verification code is incorrect. Try 246810 for this demo.");
      return;
    }
    onLoginComplete(pendingLogin, rememberDevice ? "Secure device verified" : "Signed in", rememberDevice);
  };

  return (
    <div className="login-screen">
      <div className="login-visual">
        <div className="login-grid" />
        <div className="login-visual-content">
          <div className="eyebrow"><span className="signal-dot" /> Secure operations network</div>
          <h1>Coordinating a safer, more resilient UAE.</h1>
          <p>One trusted operational picture for command teams, responders, and public safety leaders.</p>
          <div className="login-visual-footer">
            <span>24/7 monitored platform</span>
            <span>Encrypted agency access</span>
          </div>
        </div>
      </div>
      <div className="login-panel">
        <div className="login-agency">
          <img className="brand-logo" src="/logo.png" alt="SafeGuard" />
          <div>
            <strong>SafeGuard</strong>
            <span>Emergency &amp; Disaster Management Portal</span>
          </div>
        </div>
        <div className="official-badge"><span>✓</span> Official Government Portal <b>·</b> Unauthorized Access Prohibited</div>
        {step === "credentials" ? (
        <form
          className="login-form"
          onSubmit={submitCredentials}
        >
          <div className="login-heading">
            <span className="step-kicker">Secure sign-in · Step 1 of 2</span>
            <h2>Access the command environment</h2>
            <p>Use your registered agency credentials to continue.</p>
          </div>
          <label className="field">
            <span>Government ID or agency email</span>
            <input
              autoComplete="username"
              value={form.emiratesId}
              onChange={(event) => setForm((current) => ({ ...current, emiratesId: event.target.value }))}
              placeholder="784-1989-1111111-1"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="Enter your secure password"
            />
            <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)}>
              {showPassword ? "Hide" : "Show"}
            </button>
          </label>
          <div className="login-options">
            <label className="check-option"><input type="checkbox" checked={rememberDevice} onChange={(event) => setRememberDevice(event.target.checked)} /> <span>Remember this device</span></label>
            <a href="#clearance" onClick={(event) => { event.preventDefault(); setError("Contact your agency administrator to request clearance."); }}>Forgot credentials?</a>
          </div>
          {error ? <div className="form-error" role="alert">{error}</div> : null}
          <div className="modal-actions">
            <button className="cta primary login-submit" type="submit" disabled={busy}>
              {busy ? <><span className="spinner" /> Verifying credentials</> : <>Continue securely <span>→</span></>}
            </button>
          </div>
          <div className="login-divider"><span>or use a registered device</span></div>
          <div className="login-alt-actions">
            <button type="button" className="cta secondary" onClick={onNfcLogin} disabled={busy}>NFC agency ID</button>
            <button type="button" className="cta secondary" onClick={onBiometricLogin} disabled={busy}>Biometric sign-in</button>
          </div>
        </form>
        ) : (
          <form className="login-form mfa-form" onSubmit={verifyOtp}>
            <div className="login-heading">
              <span className="step-kicker">Secure sign-in · Step 2 of 2</span>
              <h2>Verify your identity</h2>
              <p>Enter the six-digit code sent to your registered agency device.</p>
            </div>
            <div className="mfa-icon">⌁</div>
            <label className="field">
              <span>One-time verification code</span>
              <input autoFocus inputMode="numeric" maxLength={6} value={otp} onChange={(event) => { setOtp(event.target.value.replace(/\D/g, "")); setError(""); }} placeholder="000000" />
            </label>
            {error ? <div className="form-error" role="alert">{error}</div> : null}
            <div className="modal-actions">
              <button className="cta primary login-submit" type="submit" disabled={busy || otp.length !== 6}>Verify and enter <span>→</span></button>
              <button type="button" className="text-button" onClick={() => { setStep("credentials"); setOtp(""); setError(""); }}>← Use different credentials</button>
            </div>
            <p className="demo-hint">Demo verification code: <strong>246810</strong></p>
          </form>
        )}
        <div className="login-footer"><span>Session protected by agency-grade encryption</span><span>v2.4.1</span></div>
      </div>
    </div>
  );
}

export default function App() {
  const [stage, setStage] = useState("splash");
  const [dashboard, setDashboard] = useState(defaultDashboard);
  const [predictions, setPredictions] = useState([]);
  const [health, setHealth] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("safeguard-token") || sessionStorage.getItem("safeguard-token") || "");
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("safeguard-user") || sessionStorage.getItem("safeguard-user");
    return saved ? JSON.parse(saved) : null;
  });
  const [busy, setBusy] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
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
    const clock = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clock);
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
        sessionStorage.removeItem("safeguard-token");
        sessionStorage.removeItem("safeguard-user");
        setToken("");
        setUser(null);
        setStage("login");
      }
    };

    void me();
  }, [headers, stage, token]);

  const completeLogin = async (payload, title = "Signed in", rememberDevice = true) => {
    const storage = rememberDevice ? localStorage : sessionStorage;
    localStorage.removeItem("safeguard-token");
    localStorage.removeItem("safeguard-user");
    sessionStorage.removeItem("safeguard-token");
    sessionStorage.removeItem("safeguard-user");
    storage.setItem("safeguard-token", payload.token);
    storage.setItem("safeguard-user", JSON.stringify(payload.user));
    const storedAccounts = JSON.parse(localStorage.getItem("safeguard-accounts") || "[]");
    localStorage.setItem("safeguard-accounts", JSON.stringify([
      payload.user,
      ...storedAccounts.filter((account) => account.id !== payload.user.id),
    ]));
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
      return payload;
    } catch (error) {
      throw error;
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
    sessionStorage.removeItem("safeguard-token");
    sessionStorage.removeItem("safeguard-user");
    setToken("");
    setUser(null);
    setStage("login");
    setMessage({ tone: "info", title: "Signed out", text: "Please sign in again to continue." });
  };

  const updateProfile = (nextUser) => {
    setUser(nextUser);
    localStorage.setItem("safeguard-user", JSON.stringify(nextUser));
    if (nextUser.id) {
      const stored = JSON.parse(localStorage.getItem("safeguard-accounts") || "[]");
      localStorage.setItem("safeguard-accounts", JSON.stringify([
        nextUser,
        ...stored.filter((account) => account.id !== nextUser.id),
      ]));
    }
  };

  const switchAccount = (account) => {
    if (account && account.id === user?.id) {
      setMessage({ tone: "info", title: "Account already active", text: "This operator profile is currently in use." });
      return;
    }
    setStage("login");
    setMessage({ tone: "info", title: "Account switch requested", text: account ? `Sign in to continue as ${account.name}.` : "Enter credentials for another authorized account." });
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
          onLoginComplete={completeLogin}
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
            <span className="status-chip clock-chip"><span className="signal-dot" /> {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} GST</span>
            <span className="status-chip risk-status">Threat level: <b>{summary.averageRisk > 80 ? "HIGH" : summary.averageRisk > 60 ? "ADVISORY" : "NORMAL"}</b></span>
            <span className="status-chip">Active: {summary.activeIncidents}</span>
            <span className="status-chip">RVTS: {summary.rvtsWarnings}</span>
            <span className="status-chip mobile-hide">Coverage: {summary.coveragePct}%</span>
            {user ? <ProfileMenu user={user} onUpdate={updateProfile} onSwitchAccount={switchAccount} onSignOut={signOut} onNotify={(title, text) => setMessage({ tone: "success", title, text })} /> : <button className="cta secondary" onClick={() => setStage("login")}>Sign in</button>}
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
                <div key={zone.zoneId} className={`risk-card risk-card-${riskTone(zone.riskScore)}`}>
                  <div className="risk-card-head">
                    <div className="risk-name"><span className="telemetry-icon" aria-hidden="true">{telemetryIcon(zone.zoneName)}</span><strong>{zone.zoneName}</strong></div>
                    <span className={`risk-badge risk-${trendTone(zone.trend)}`}>{zone.trend}</span>
                  </div>
                  <div className="mini">{zone.prediction}</div>
                  <div className="risk-progress"><span className={`risk-fill risk-fill-${riskTone(zone.riskScore)}`} style={{ width: `${zone.riskScore}%` }} /></div>
                  <div className="risk-card-meta">
                    <span className="mini">Risk {zone.riskScore}%</span>
                    <span className="mini">Confidence {Math.round(zone.confidence * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="alert-card telemetry-card" style={{ marginTop: 16 }}>
              <div className="panel-head compact-head"><h4>Telemetry feed</h4><span className="mini">Live streams</span></div>
              <div className="list" style={{ marginTop: 12 }}>
                {dashboard.telemetry.map((item) => (
                  <div className="feed-item telemetry-item" key={item.sourceId}>
                    <div>
                      <div className="feed-title"><span className={`telemetry-signal signal-${item.riskBand}`} /> <strong>{item.locationName}</strong></div>
                      <span>{item.type} · <TelemetryMetric label="AQI" value={item.airQualityIndex} tone={item.airQualityIndex >= 150 ? "critical" : ""} /> · <TelemetryMetric label="Flood" value={`${item.floodLevelM}m`} tone={item.floodLevelM >= 1.1 || item.floodLevelM >= 0.7 && item.riskBand === "critical" ? "critical" : ""} /> · <TelemetryMetric label="Temp" value={`${item.temperatureC}°C`} tone={item.temperatureC >= 43 ? "high" : ""} /></span>
                    </div>
                    <span className={`risk-badge risk-${item.riskBand}`}>{item.riskBand}</span>
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
                <div className="feed-item hospital-item" key={hospital.id}>
                  <div>
                    <div className="feed-title"><span className={`readiness-dot readiness-${readinessTone(hospital.occupancyPct)}`} /><strong>{hospital.name}</strong></div>
                    <span>{hospital.emirate} · {hospital.availableBeds} beds free · ICU {hospital.icuAvailable}</span>
                  </div>
                  <div className="hospital-occupancy"><span className={`readiness-dot readiness-${readinessTone(hospital.occupancyPct)}`} />Occupancy {hospital.occupancyPct}%</div>
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
