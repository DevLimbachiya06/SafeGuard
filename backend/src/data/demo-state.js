import bcrypt from "bcryptjs";

const createTimestamp = (minutesAgo = 0) => new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();

const clone = (value) => structuredClone(value);

export const emiratesBounds = {
  minLat: 22.6,
  maxLat: 26.5,
  minLng: 51.4,
  maxLng: 56.6,
};

export const createDemoState = () => {
  const state = {
    users: [
      {
        id: "user-001",
        fullName: "Amina Al Nuaimi",
        emiratesId: "784-1989-1111111-1",
        passwordHash: bcrypt.hashSync("commander-demo-2026", 10),
        role: "commander",
        agency: "UAE National Emergency Coordination",
        mobilePin: "2468",
      },
      {
        id: "user-002",
        fullName: "Faisal Al Marri",
        emiratesId: "784-1988-2222222-2",
        passwordHash: bcrypt.hashSync("responder-demo-2026", 10),
        role: "responder",
        agency: "Civil Defense",
        mobilePin: "3691",
      },
      {
        id: "user-003",
        fullName: "Sara Al Mazrouei",
        emiratesId: "784-1993-3333333-3",
        passwordHash: bcrypt.hashSync("citizen-demo-2026", 10),
        role: "citizen",
        agency: "Public",
        mobilePin: "1234",
      },
    ],
    incidents: [
      {
        id: "INC-101",
        title: "Flash flood on Sheikh Zayed service road",
        type: "Flood",
        severity: "critical",
        status: "active",
        zoneId: "z-dubai",
        zoneName: "Dubai South",
        latitude: 25.062,
        longitude: 55.231,
        source: "IoT telemetry",
        etaMinutes: 11,
        recommendedAction: "Dispatch water rescue, divert traffic, and push public evacuation alert.",
        createdAt: createTimestamp(18),
      },
      {
        id: "INC-102",
        title: "Sandstorm visibility collapse near Al Ain",
        type: "Sandstorm",
        severity: "high",
        status: "monitoring",
        zoneId: "z-alain",
        zoneName: "Al Ain",
        latitude: 24.23,
        longitude: 55.74,
        source: "Weather ingest",
        etaMinutes: 24,
        recommendedAction: "Activate RVTS lane clearing and warn motorists entering the corridor.",
        createdAt: createTimestamp(42),
      },
      {
        id: "INC-103",
        title: "Extreme heat anomaly on Abu Dhabi coastline",
        type: "Heatwave",
        severity: "moderate",
        status: "active",
        zoneId: "z-abudhabi",
        zoneName: "Abu Dhabi Coast",
        latitude: 24.466,
        longitude: 54.36,
        source: "AI forecast",
        etaMinutes: 36,
        recommendedAction: "Open cooling shelters and accelerate EMS standby.",
        createdAt: createTimestamp(74),
      },
    ],
    responders: [
      {
        unitId: "R-12",
        type: "Ambulance",
        status: "deployed",
        zoneName: "Dubai South",
        latitude: 25.12,
        longitude: 55.29,
        heading: 68,
        speedKmh: 54,
        rvtsActive: true,
      },
      {
        unitId: "F-04",
        type: "Fire Engine",
        status: "en route",
        zoneName: "Jebel Ali",
        latitude: 24.99,
        longitude: 55.09,
        heading: 24,
        speedKmh: 47,
        rvtsActive: true,
      },
      {
        unitId: "P-21",
        type: "Police Patrol",
        status: "monitoring",
        zoneName: "Al Ain",
        latitude: 24.18,
        longitude: 55.72,
        heading: 310,
        speedKmh: 38,
        rvtsActive: false,
      },
    ],
    telemetry: [
      {
        sourceId: "AQ-110",
        type: "Air quality",
        locationName: "Dubai South",
        latitude: 25.056,
        longitude: 55.214,
        temperatureC: 39.4,
        airQualityIndex: 182,
        floodLevelM: 0.71,
        humidityPct: 81,
        riskBand: "critical",
        recordedAt: createTimestamp(4),
      },
      {
        sourceId: "WX-221",
        type: "Microclimate",
        locationName: "Abu Dhabi Corniche",
        latitude: 24.455,
        longitude: 54.38,
        temperatureC: 44.1,
        airQualityIndex: 73,
        floodLevelM: 0.08,
        humidityPct: 57,
        riskBand: "moderate",
        recordedAt: createTimestamp(2),
      },
      {
        sourceId: "FL-332",
        type: "Flood gauge",
        locationName: "Al Ain Outskirts",
        latitude: 24.25,
        longitude: 55.77,
        temperatureC: 36.3,
        airQualityIndex: 95,
        floodLevelM: 1.33,
        humidityPct: 69,
        riskBand: "high",
        recordedAt: createTimestamp(1),
      },
    ],
    alerts: [
      {
        id: "ALT-501",
        title: "Flood evacuation advisory",
        message: "Dubai South residents should move to upper floors and keep roads clear for rescue vehicles.",
        severity: "critical",
        zoneName: "Dubai South",
        channel: "SMS + app push",
        createdAt: createTimestamp(10),
      },
      {
        id: "ALT-502",
        title: "Sandstorm RVTS warning",
        message: "Visibility is dropping across the Al Ain corridor. Slow down and follow lane-clearance messages.",
        severity: "high",
        zoneName: "Al Ain",
        channel: "Traffic boards",
        createdAt: createTimestamp(30),
      },
    ],
    hospitals: [
      {
        id: "H-01",
        name: "Rashid Emergency Center",
        emirate: "Dubai",
        availableBeds: 31,
        icuAvailable: 4,
        occupancyPct: 72,
        latitude: 25.219,
        longitude: 55.328,
      },
      {
        id: "H-02",
        name: "Sheikh Khalifa Medical City",
        emirate: "Abu Dhabi",
        availableBeds: 27,
        icuAvailable: 6,
        occupancyPct: 64,
        latitude: 24.489,
        longitude: 54.359,
      },
      {
        id: "H-03",
        name: "Tawam Trauma Center",
        emirate: "Al Ain",
        availableBeds: 18,
        icuAvailable: 2,
        occupancyPct: 81,
        latitude: 24.219,
        longitude: 55.744,
      },
    ],
    riskZones: [
      {
        zoneId: "z-dubai",
        zoneName: "Dubai South",
        riskScore: 92,
        confidence: 0.94,
        trend: "rising",
        etaMinutes: 11,
        prediction: "Likely localized flooding and traffic stalling within the next 15 minutes.",
        center: { latitude: 25.062, longitude: 55.231 },
        radiusKm: 6.4,
      },
      {
        zoneId: "z-alain",
        zoneName: "Al Ain",
        riskScore: 77,
        confidence: 0.88,
        trend: "steady",
        etaMinutes: 24,
        prediction: "Dust front may reduce visibility and increase responder travel time.",
        center: { latitude: 24.23, longitude: 55.74 },
        radiusKm: 8.1,
      },
      {
        zoneId: "z-abudhabi",
        zoneName: "Abu Dhabi Coast",
        riskScore: 61,
        confidence: 0.83,
        trend: "falling",
        etaMinutes: 36,
        prediction: "Heat stress remains elevated but is expected to ease by evening.",
        center: { latitude: 24.466, longitude: 54.36 },
        radiusKm: 7.5,
      },
    ],
    rvtsWarnings: [
      {
        id: "RVTS-01",
        responderUnitId: "R-12",
        distanceM: 126,
        direction: "north-east",
        recommendation: "Maintain lane discipline and clear the fast lane immediately.",
        updatedAt: createTimestamp(1),
      },
    ],
    nextIncidentId: 104,
    nextAlertId: 503,
    nextTelemetryId: 333,
    nextRvtsId: 2,
  };

  return state;
};

export const snapshot = (state) => clone({
  incidents: state.incidents,
  responders: state.responders,
  telemetry: state.telemetry,
  alerts: state.alerts,
  hospitals: state.hospitals,
  riskZones: state.riskZones,
  rvtsWarnings: state.rvtsWarnings,
});

export const summarizeState = (state) => {
  const activeIncidents = state.incidents.filter((incident) => incident.status !== "resolved");
  const averageRisk = state.riskZones.length
    ? Math.round(state.riskZones.reduce((sum, zone) => sum + zone.riskScore, 0) / state.riskZones.length)
    : 0;
  const avgDispatch = activeIncidents.length
    ? Math.round(activeIncidents.reduce((sum, incident) => sum + incident.etaMinutes, 0) / activeIncidents.length)
    : 0;

  return {
    activeIncidents: activeIncidents.length,
    respondersLive: state.responders.length,
    alertsActive: state.alerts.length,
    telemetryStreams: state.telemetry.length,
    hospitalsReady: state.hospitals.filter((hospital) => hospital.availableBeds > 0).length,
    averageRisk,
    avgDispatchMinutes: avgDispatch,
    rvtsWarnings: state.rvtsWarnings.length,
    coveragePct: Math.min(99, 70 + state.telemetry.length * 6),
  };
};
