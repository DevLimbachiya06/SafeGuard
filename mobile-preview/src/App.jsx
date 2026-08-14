import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
const SOCKET_URL = API_BASE.replace(/\/api\/?$/, "");
const DEFAULT_LOCATION = { latitude: 24.466, longitude: 54.36 };
const SOS_HOLD_MS = 3000;

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
  alerts: [],
  hospitals: [],
  riskZones: [],
  telemetry: [],
  rvtsWarnings: [],
};

const defaultLogin = {
  emiratesId: "784-1993-3333333-3",
  password: "citizen-demo-2026",
};

const reportTypes = ["Anomaly", "Road hazard", "Utility issue", "Suspicious activity", "Medical concern", "Fire risk"];
const reportSeverities = ["low", "moderate", "high", "critical"];
const mapBounds = {
  minLat: 22.6,
  maxLat: 26.5,
  minLng: 51.4,
  maxLng: 56.6,
};
const severityPalette = {
  critical: "#ff4f6d",
  high: "#ff8a3d",
  moderate: "#ffc64d",
  low: "#6cb7ff",
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
  }
  return response.json();
};

function Badge({ children, tone = "neutral" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function getStoredJson(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function formatIncidentLine(incident) {
  if (!incident?.latitude || !incident?.longitude) return "Near you";
  return `${incident.zoneName || "Nearby"} · ${incident.etaMinutes || 0} min`;
}

function MiniMap({ dashboard, currentLocation }) {
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

    const incidents = (dashboard.incidents || []).map((incident) => ({
      ...incident,
      position: toCoordinate(incident.latitude, incident.longitude),
      color: severityPalette[incident.severity] || severityPalette.moderate,
    })).filter((incident) => incident.position);

    const hospitals = (dashboard.hospitals || []).map((hospital) => ({
      ...hospital,
      position: toCoordinate(hospital.latitude, hospital.longitude),
    })).filter((hospital) => hospital.position);

    const zones = (dashboard.riskZones || []).map((zone) => ({
      ...zone,
      position: toCoordinate(zone.center?.latitude ?? zone.latitude ?? 25, zone.center?.longitude ?? zone.longitude ?? 55),
      tone: zone.riskScore > 85 ? "critical" : zone.riskScore > 70 ? "high" : "moderate",
    })).filter((zone) => zone.position);

    return { incidents, hospitals, zones };
  }, [dashboard]);

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
        className="leaflet-mobile-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {layers.zones.map((zone) => (
          <Circle
            key={zone.zoneId}
            center={zone.position}
            radius={Math.max(5000, (zone.radiusKm || 6) * 1000)}
            pathOptions={{
              color: severityPalette[zone.tone],
              fillColor: severityPalette[zone.tone],
              fillOpacity: 0.18,
              weight: 2,
            }}
          >
            <Tooltip sticky>
              {zone.zoneName} · Risk {zone.riskScore}%
            </Tooltip>
          </Circle>
        ))}

        {layers.incidents.map((incident) => (
          <CircleMarker
            key={incident.id}
            center={incident.position}
            radius={7}
            pathOptions={{
              color: incident.color,
              fillColor: incident.color,
              fillOpacity: 0.85,
              weight: 2,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]} sticky>
              {incident.type} · {incident.zoneName}
            </Tooltip>
          </CircleMarker>
        ))}

        {layers.hospitals.map((hospital) => (
          <CircleMarker
            key={hospital.id}
            center={hospital.position}
            radius={5}
            pathOptions={{
              color: "#33d3c0",
              fillColor: "#33d3c0",
              fillOpacity: 0.9,
              weight: 2,
            }}
          >
            <Tooltip direction="right" offset={[8, 0]} sticky>
              {hospital.name}
            </Tooltip>
          </CircleMarker>
        ))}

        {currentLocation ? (
          <>
            <Circle
              center={[currentLocation.latitude, currentLocation.longitude]}
              radius={Math.max(35, currentLocation.accuracy || 35)}
              pathOptions={{
                color: "#6cb7ff",
                fillColor: "#6cb7ff",
                fillOpacity: 0.18,
                weight: 1,
              }}
            />
            <CircleMarker
              center={[currentLocation.latitude, currentLocation.longitude]}
              radius={6}
              pathOptions={{
                color: "#f3f7ff",
                fillColor: "#6cb7ff",
                fillOpacity: 1,
                weight: 2,
              }}
            >
              <Tooltip direction="top" offset={[0, -6]} sticky>
                You are here
              </Tooltip>
            </CircleMarker>
          </>
        ) : null}
      </MapContainer>
      <div className="map-legend mobile">
        <span><i className="legend-dot incident" /> Incidents</span>
        <span><i className="legend-dot hospital" /> Hospitals</span>
        <span><i className="legend-dot self" /> You</span>
      </div>
    </div>
  );
}

function formatCoordinates(location) {
  if (!location) return "Detecting location...";
  return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
}

function SplashScreen() {
  return (
    <div className="stage splash-stage">
      <div className="splash-card">
        <div className="splash-logo-wrap">
          <img className="splash-logo" src="/logo.png" alt="SafeGuard logo" />
        </div>
        <h1 className="splash-title">SafeGuard</h1>
        <p className="splash-subtitle">Citizen safety network</p>
      </div>
    </div>
  );
}

function LoginScreen({ busy, loginForm, setLoginForm, onLogin, onBiometricUnlock }) {
  return (
    <div className="stage auth-stage">
      <div className="auth-card">
        <div className="splash-logo-wrap">
          <img className="splash-logo" src="/logo.png" alt="SafeGuard logo" />
        </div>
        <h2 className="auth-title">Welcome back</h2>
        <p className="auth-subtitle">Sign in to stay connected.</p>

        <div className="auth-pills">
        </div>

        <form className="auth-form" onSubmit={onLogin}>
          <label className="field">
            <span>Emirates ID</span>
            <input
              value={loginForm.emiratesId}
              onChange={(event) => setLoginForm((current) => ({ ...current, emiratesId: event.target.value }))}
              autoComplete="username"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={loginForm.password}
              onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
              autoComplete="current-password"
            />
          </label>

          <button className="primary-btn auth-submit" type="submit" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="biometric-grid">
          <button className="secondary-btn" type="button" onClick={() => onBiometricUnlock("Fingerprint")} disabled={busy}>
            Fingerprint
          </button>
          <button className="secondary-btn" type="button" onClick={() => onBiometricUnlock("Face ID")} disabled={busy}>
            Face ID
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [dashboard, setDashboard] = useState(defaultDashboard);
  const [token, setToken] = useState(() => localStorage.getItem("safeguard-token") || "");
  const [user, setUser] = useState(() => getStoredJson("safeguard-user"));
  const [stage, setStage] = useState("splash");
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("Finding your location...");
  const [loginForm, setLoginForm] = useState(defaultLogin);
  const [sosBusy, setSosBusy] = useState(false);
  const [sosHolding, setSosHolding] = useState(false);
  const [sosProgress, setSosProgress] = useState(0);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportForm, setReportForm] = useState({
    title: "Smoke detected in a parking area",
    type: "Anomaly",
    severity: "moderate",
    details: "A citizen noticed unusual smoke and asked for a quick safety check.",
  });

  const holdTimeoutRef = useRef(null);
  const holdIntervalRef = useRef(null);
  const holdStartedRef = useRef(0);
  const holdTriggeredRef = useRef(false);
  const mapSectionRef = useRef(null);
  const reportSectionRef = useRef(null);
  useEffect(() => {
    if (stage !== "app") return undefined;

    if (!navigator.geolocation) {
      setLocationStatus("Live location unavailable on this device");
      return undefined;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLocationStatus("Live location active");
      },
      () => {
        setLocationStatus("Location permission denied or unavailable");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1500,
        timeout: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [stage]);


  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  const refresh = async () => {
    try {
      const dashboardData = await fetchJson(`${API_BASE}/dashboard`);
      setDashboard(dashboardData);
    } catch (error) {
      setToast({ tone: "error", title: "Offline preview", text: error.message });
    }
  };

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
    const splashTimer = setTimeout(() => {
      setStage("login");
    }, 1800);

    return () => clearTimeout(splashTimer);
  }, []);

  useEffect(() => {
    if (!token) return;

    const checkProfile = async () => {
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

    void checkProfile();
  }, [headers, token]);

  useEffect(() => () => {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
  }, []);

  const scrollToSection = (sectionRef) => {
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const logout = () => {
    localStorage.removeItem("safeguard-token");
    localStorage.removeItem("safeguard-user");
    setToken("");
    setUser(null);
    setStage("splash");
  };

  const biometricUnlock = (method) => {
    const authenticate = async () => {
      setBiometricBusy(true);
      try {
        const payload = await fetchJson(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(loginForm),
        });

        localStorage.setItem("safeguard-token", payload.token);
        localStorage.setItem("safeguard-user", JSON.stringify(payload.user));
        setToken(payload.token);
        setUser(payload.user);
        setStage("app");
        setToast({ tone: "success", title: `${method} verified`, text: `${payload.user.name} is active on the mobile simulator.` });
        await refresh();
      } catch {
        setToast({ tone: "error", title: `${method} failed`, text: "Biometric approval could not be verified." });
      } finally {
        setBiometricBusy(false);
      }
    };

    void authenticate();
  };

  const login = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = await fetchJson(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });

      localStorage.setItem("safeguard-token", payload.token);
      localStorage.setItem("safeguard-user", JSON.stringify(payload.user));
      setToken(payload.token);
      setUser(payload.user);
      setStage("app");
      setToast({ tone: "success", title: "Signed in", text: `${payload.user.name} is active on the mobile simulator.` });
      await refresh();
    } catch {
      setToast({ tone: "error", title: "Login failed", text: "Check Emirates ID and password." });
    } finally {
      setBusy(false);
    }
  };

  const getLocation = async () =>
    new Promise((resolve) => {
      if (currentLocation?.latitude != null && currentLocation?.longitude != null) {
        resolve({ latitude: currentLocation.latitude, longitude: currentLocation.longitude });
        return;
      }

      if (!navigator.geolocation) {
        resolve(DEFAULT_LOCATION);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        () => resolve(DEFAULT_LOCATION),
        { timeout: 3000 }
      );
    });

  const sendSos = async () => {
    setSosBusy(true);
    try {
      const location = await getLocation();

      await fetchJson(`${API_BASE}/sos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          citizenName: user?.name || "Mobile demo user",
          emiratesId: user?.emiratesId || "guest",
          latitude: location.latitude,
          longitude: location.longitude,
          emergencyType: "SOS",
          message: "Immediate assistance needed from the mobile app",
        }),
      });

      setToast({ tone: "success", title: "SOS sent", text: "Nearest responder dispatch is active." });
      await refresh();
    } catch (error) {
      setToast({ tone: "error", title: "SOS failed", text: error.message });
    } finally {
      setSosBusy(false);
    }
  };

  const resetSosHold = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }

    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }

    setSosHolding(false);
    if (!holdTriggeredRef.current) {
      setSosProgress(0);
    }
  };

  const startSosHold = () => {
    if (sosBusy) return;
    resetSosHold();
    holdTriggeredRef.current = false;
    setSosHolding(true);
    setSosProgress(0);
    holdStartedRef.current = performance.now();

    holdIntervalRef.current = setInterval(() => {
      const elapsed = performance.now() - holdStartedRef.current;
      setSosProgress(Math.min(100, Math.round((elapsed / SOS_HOLD_MS) * 100)));
    }, 40);

    holdTimeoutRef.current = setTimeout(async () => {
      holdTriggeredRef.current = true;
      resetSosHold();
      setSosProgress(100);
      await sendSos();
      setTimeout(() => setSosProgress(0), 650);
    }, SOS_HOLD_MS);
  };

  const stopSosHold = () => {
    if (holdTriggeredRef.current) return;
    resetSosHold();
  };

  const reportIncident = async (event) => {
    event.preventDefault();
    if (!token) {
      setToast({ tone: "warning", title: "Sign in required", text: "Please sign in before sending a citizen report." });
      return;
    }

    setReportBusy(true);
    try {
      const location = await getLocation();
      await fetchJson(`${API_BASE}/incidents`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: reportForm.title.trim(),
          type: reportForm.type,
          severity: reportForm.severity,
          latitude: location.latitude,
          longitude: location.longitude,
          zoneId: "z-citizen-report",
          zoneName: "Citizen report",
          source: reportForm.details.trim() || "Citizen report",
          etaMinutes: 18,
        }),
      });

      setToast({ tone: "success", title: "Report submitted", text: "The incident has been added to the live feed." });
      await refresh();
    } catch (error) {
      setToast({ tone: "error", title: "Report failed", text: error.message });
    } finally {
      setReportBusy(false);
    }
  };

  const topAlert = dashboard.alerts[0];
  const routeHint = dashboard.riskZones[0];
  const routeLineWidth = Math.max(42, Math.min(100, routeHint?.riskScore || 76));

  const reportCard = (
    <form className="panel report-card" onSubmit={reportIncident}>
      <div className="card-head">
        <div>
          <div className="eyebrow">Citizen reporting</div>
        </div>
        <Badge tone={token ? "success" : "warning"}>{token ? "Ready" : "Sign in first"}</Badge>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>Title</span>
          <input
            value={reportForm.title}
            onChange={(event) => setReportForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="What did you notice?"
          />
        </label>

        <label className="field">
          <span>Type</span>
          <select value={reportForm.type} onChange={(event) => setReportForm((current) => ({ ...current, type: event.target.value }))}>
            {reportTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Severity</span>
          <select value={reportForm.severity} onChange={(event) => setReportForm((current) => ({ ...current, severity: event.target.value }))}>
            {reportSeverities.map((severity) => (
              <option key={severity} value={severity}>
                {severity}
              </option>
            ))}
          </select>
        </label>

        <label className="field field-wide">
          <span>Details</span>
          <textarea
            value={reportForm.details}
            onChange={(event) => setReportForm((current) => ({ ...current, details: event.target.value }))}
            placeholder="Add short context for the coordination desk"
          />
        </label>
      </div>

      <div className="report-actions">
        <button className="primary-btn" type="submit" disabled={reportBusy || !token}>
          {reportBusy ? "Submitting..." : "Submit report"}
        </button>
        <button className="secondary-btn" type="button" onClick={() => scrollToSection(mapSectionRef)}>
          View map
        </button>
      </div>

      <div className="mini-note">The report will use your current location when available.</div>
    </form>
  );

  if (stage === "splash") {
    return (
      <div className="screen">
        <div className="phone phone-splash">
          <SplashScreen />
        </div>
      </div>
    );
  }

  if (stage === "login") {
    return (
      <div className="screen">
        <div className="phone phone-auth">
          <LoginScreen
            busy={busy || biometricBusy}
            loginForm={loginForm}
            setLoginForm={setLoginForm}
            onLogin={login}
            onBiometricUnlock={biometricUnlock}
          />
        </div>
        {toast ? (
          <div className="toast toast-fixed toast-tone-neutral">
            <strong>{toast.title}</strong>
            <div className="muted">{toast.text}</div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="phone phone-app">
        <div className="content">
          <div className="status-strip">
            <span>9:41</span>
            <span className="status-icons">▮▮▮  ▮</span>
          </div>

          <div className="hero-banner">
            <div className="brand-row">
              <div>
                <div className="eyebrow">Citizen safety mode</div>
                <div className="hero-name">{user ? user.name : "Demo citizen"}</div>
              </div>
              <div className="hero-actions">
                <button className="icon-btn" type="button" onClick={() => scrollToSection(mapSectionRef)}>🗺️</button>
                <button className="icon-btn" type="button" onClick={() => scrollToSection(reportSectionRef)}>📣</button>
              </div>
            </div>
          </div>

          {topAlert ? (
            <div className="alert-banner">
              <div className="eyebrow danger">Active alert nearby</div>
              <div className="alert-title">{topAlert.title}</div>
              <div className="alert-copy">{formatIncidentLine(topAlert)}</div>
              <Badge tone={topAlert.severity || "info"}>{String(topAlert.severity || "info")}</Badge>
            </div>
          ) : null}

          <div className="sos-section panel">
            <div className="section-head">
              <div>
                <div className="eyebrow">Emergency panic button</div>
                <strong>Hold 3 seconds to activate</strong>
              </div>
              <Badge tone="critical">SOS</Badge>
            </div>

            <button
              type="button"
              className={`sos-core ${sosHolding ? "holding" : ""}`}
              onPointerDown={startSosHold}
              onPointerUp={stopSosHold}
              onPointerLeave={stopSosHold}
              onPointerCancel={stopSosHold}
              disabled={sosBusy}
              style={{ background: `conic-gradient(var(--accent) ${sosProgress}%, rgba(255,255,255,0.08) ${sosProgress}% 100%)` }}
            >
              <span className="sos-core-inner"><span className="sos-core-chip">SOS</span></span>
            </button>

            <div className="sos-hint">{sosBusy ? "Sending emergency request..." : "Hold and release only after the ring fills."}</div>
          </div>

          <div className="section panel" ref={mapSectionRef}>
            <div className="section-head">
              <div>
                <div className="eyebrow">Live map</div>
                <strong>Your location, nearby hazards, and hospitals</strong>
              </div>
              <button className="chip-button" type="button" onClick={refresh}>Sync</button>
            </div>
            <MiniMap dashboard={dashboard} currentLocation={currentLocation} />
            <div className="location-readout">
              <strong>Current location:</strong> {formatCoordinates(currentLocation)}
              <span>{locationStatus}</span>
            </div>
            <div className="mini-grid">
              <div className="mini-card"><strong>{routeHint?.zoneName || "Central corridor"}</strong><span>{routeHint?.etaMinutes || 11} min risk window</span></div>
              <div className="mini-card"><strong>{dashboard.hospitals[0]?.name || "Nearest care center"}</strong><span>Fastest recommended support</span></div>
            </div>
          </div>

          <div className="section panel">
            <div className="section-head">
              <div>
                <div className="eyebrow">Priority guidance</div>
                <strong>Safe route guidance</strong>
              </div>
              <Badge tone={routeHint?.riskScore > 85 ? "critical" : "warning"}>{routeHint?.zoneName || "Local zone"}</Badge>
            </div>
            <div className="route-copy">Avoid the highest risk corridor and keep open lanes for responders.</div>
            <div className="route-line"><span style={{ width: `${routeLineWidth}%` }} /></div>
          </div>

          <div className="section panel">
            <div className="section-head">
              <div>
                <div className="eyebrow">Recent incidents</div>
                <strong>Nearby incidents</strong>
              </div>
              <Badge tone="neutral">{dashboard.summary.activeIncidents} active</Badge>
            </div>
            <div className="incident-list">
              {(dashboard.incidents.length ? dashboard.incidents : [{ id: "empty", title: "No reported incidents", zoneName: "Monitoring only", severity: "info" }]).slice(0, 4).map((incident) => (
                <div className="incident-card" key={incident.id || incident.title}>
                  <div className="incident-card-top">
                    <strong>{incident.title}</strong>
                    <Badge tone={incident.severity || "info"}>{String(incident.severity || "info")}</Badge>
                  </div>
                  <div className="incident-meta">{formatIncidentLine(incident)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="section panel mode-panel" ref={reportSectionRef}>
            <div className="section-head">
              <div>
                <div className="eyebrow">Citizen report</div>
                <strong>Report an incident or anomaly</strong>
              </div>
              <Badge tone={token ? "success" : "warning"}>{token ? "Signed in" : "Sign in required"}</Badge>
            </div>
            {reportCard}
          </div>

          <div className="section panel profile-panel">
            <div className="section-head">
              <div>
                <div className="eyebrow">Account</div>
                <strong>{user ? user.name : "Guest"}</strong>
              </div>
              <Badge tone={token ? "success" : "warning"}>{token ? "Signed in" : "Signed out"}</Badge>
            </div>
            <div className="profile-meta">
              <span>{user?.role || "Citizen"}</span>
              <span>{user?.emiratesId || loginForm.emiratesId}</span>
            </div>
            <button className="danger-btn" type="button" onClick={logout}>Logout</button>
          </div>
        </div>

        {toast ? (
          <div className={`toast toast-fixed toast-tone-${toast.tone || "neutral"}`}>
            <strong>{toast.title}</strong>
            <div className="muted">{toast.text}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
