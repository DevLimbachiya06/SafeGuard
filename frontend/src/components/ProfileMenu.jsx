import { useEffect, useRef, useState } from "react";

const roleLabels = {
  commander: "Command Center Operator",
  responder: "Field Operations Officer",
  officer: "Public Safety Officer",
  citizen: "Public Safety Officer",
};

const defaultNotifications = {
  criticalAlerts: true,
  telemetryWarnings: true,
  systemLogs: false,
};

const defaultPreferences = {
  density: "comfortable",
  theme: "dark",
  timezone: "GST",
};

const readJson = (key, fallback) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? { ...fallback, ...JSON.parse(stored) } : fallback;
  } catch {
    return fallback;
  }
};

function initials(name = "User") {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function Overlay({ children, onClose, className = "" }) {
  return (
    <div className={`profile-overlay ${className}`} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      {children}
    </div>
  );
}

function ProfileDrawer({ user, panel, onClose, onUpdate, onNotify }) {
  const [form, setForm] = useState({
    name: user?.name || "",
    contact: user?.contact || "",
    role: roleLabels[user?.role] || user?.role || "",
  });
  const [notifications, setNotifications] = useState(() => readJson("safeguard-notifications", defaultNotifications));
  const [preferences, setPreferences] = useState(() => readJson("safeguard-preferences", defaultPreferences));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.dataset.density = preferences.density;
    localStorage.setItem("safeguard-preferences", JSON.stringify(preferences));
  }, [preferences]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 350));
    onUpdate({ ...user, name: form.name.trim() || user.name, contact: form.contact.trim(), roleLabel: form.role });
    setSaving(false);
    onNotify("Profile updated", "Your operator profile was saved on this device.");
    onClose();
  };

  const toggleNotification = (key) => {
    const next = { ...notifications, [key]: !notifications[key] };
    setNotifications(next);
    localStorage.setItem("safeguard-notifications", JSON.stringify(next));
    onNotify("Notification preference updated", "Your alert routing preference is active.");
  };

  return (
    <aside className="profile-drawer" role="dialog" aria-modal="true" aria-labelledby="profile-drawer-title">
      <div className="drawer-head">
        <div>
          <span className="eyebrow">Operator console</span>
          <h2 id="profile-drawer-title">{panel === "profile" ? "Edit profile" : panel === "notifications" ? "Notification settings" : "System preferences"}</h2>
        </div>
        <button className="drawer-close" type="button" onClick={onClose} aria-label="Close settings">×</button>
      </div>
      {panel === "profile" ? (
        <form className="profile-form" onSubmit={saveProfile}>
          <div className="drawer-identity"><span className="profile-avatar large">{initials(form.name)}</span><div><strong>{user?.agency || "SafeGuard Emergency Operations"}</strong><span>Active clearance · Level 3</span></div></div>
          <label className="field"><span>Full name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
          <label className="field"><span>Contact number</span><input value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} placeholder="+971 50 000 0000" /></label>
          <label className="field"><span>Emergency role</span><input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} /></label>
          <div className="drawer-actions"><button className="cta secondary" type="button" onClick={onClose}>Cancel</button><button className="cta primary" type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button></div>
        </form>
      ) : panel === "notifications" ? (
        <div className="settings-list">
          <p className="drawer-copy">Choose which operational updates are routed to this command profile.</p>
          {[
            ["criticalAlerts", "Critical emergency alerts", "Immediate incident and evacuation notifications"],
            ["telemetryWarnings", "Telemetry warnings", "Sensor threshold and infrastructure anomalies"],
            ["systemLogs", "System activity logs", "Authentication and platform service events"],
          ].map(([key, label, description]) => (
            <button className="setting-row" type="button" key={key} onClick={() => toggleNotification(key)}>
              <span><strong>{label}</strong><small>{description}</small></span><span className={`toggle ${notifications[key] ? "is-on" : ""}`}><span /></span>
            </button>
          ))}
        </div>
      ) : (
        <div className="settings-list">
          <p className="drawer-copy">Tune the command interface for your workstation and operating theatre.</p>
          <div className="preference-group"><span className="setting-label">Interface density</span><div className="segmented-control">{["comfortable", "compact"].map((value) => <button className={preferences.density === value ? "active" : ""} type="button" key={value} onClick={() => setPreferences({ ...preferences, density: value })}>{value}</button>)}</div></div>
          <div className="preference-group"><span className="setting-label">Theme</span><div className="segmented-control">{["dark", "light"].map((value) => <button className={preferences.theme === value ? "active" : ""} type="button" key={value} onClick={() => setPreferences({ ...preferences, theme: value })}>{value}</button>)}</div></div>
          <label className="field"><span>Operational timezone</span><select value={preferences.timezone} onChange={(event) => setPreferences({ ...preferences, timezone: event.target.value })}><option value="GST">GST · UTC+4</option><option value="UTC">UTC</option><option value="AST">AST · UTC+3</option></select></label>
        </div>
      )}
    </aside>
  );
}

function AccountSwitcher({ user, onClose, onSelect, onAdd }) {
  const accounts = [user, ...JSON.parse(localStorage.getItem("safeguard-accounts") || "[]")].filter(Boolean).filter((account, index, list) => list.findIndex((entry) => entry.id === account.id) === index);
  return (
    <Overlay onClose={onClose} className="account-overlay">
      <div className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <div className="drawer-head"><div><span className="eyebrow">Session management</span><h2 id="account-title">Switch account</h2></div><button className="drawer-close" type="button" onClick={onClose} aria-label="Close account switcher">×</button></div>
        <p className="drawer-copy">Select a stored agency profile or add another authorized account.</p>
        <div className="account-list">{accounts.map((account) => <button className={`account-option ${account.id === user?.id ? "selected" : ""}`} key={account.id} type="button" onClick={() => onSelect(account)}><span className="profile-avatar">{initials(account.name)}</span><span><strong>{account.name}</strong><small>{account.agency || "SafeGuard agency"} · {roleLabels[account.role] || account.role}</small></span>{account.id === user?.id ? <span className="account-active">Active</span> : null}</button>)}</div>
        <button className="add-account" type="button" onClick={onAdd}>＋ Add another account</button>
      </div>
    </Overlay>
  );
}

export default function ProfileMenu({ user, onUpdate, onSwitchAccount, onSignOut, onNotify }) {
  const [open, setOpen] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const handleOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        setDrawer(null);
        setAccountsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const openDrawer = (panel) => {
    setOpen(false);
    setDrawer(panel);
  };

  return (
    <>
      <div className="profile-menu" ref={rootRef}>
        <button className={`profile-trigger ${open ? "is-open" : ""}`} type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu">
          <span className="profile-avatar">{initials(user?.name)}</span><span className="profile-trigger-copy"><strong>{user?.name || "Operator"}</strong><small>{user?.roleLabel || roleLabels[user?.role] || "Command Center Operator"}</small></span><span className="profile-chevron">⌄</span>
        </button>
        {open ? (
          <div className="profile-dropdown" role="menu">
            <div className="profile-dropdown-head"><span className="profile-avatar large">{initials(user?.name)}</span><div><strong>{user?.name}</strong><span>{user?.email || user?.emiratesId || "Registered agency account"}</span><small>{user?.agency || "SafeGuard Emergency Operations"}</small></div></div>
            <div className="clearance-row"><span>Active clearance</span><b>LEVEL 3 · OPERATIONAL</b></div>
            <div className="profile-menu-section"><button type="button" onClick={() => openDrawer("profile")}>Edit profile <span>→</span></button><button type="button" onClick={() => openDrawer("notifications")}>Notification settings <span>→</span></button><button type="button" onClick={() => openDrawer("preferences")}>System preferences <span>→</span></button></div>
            <div className="profile-menu-session"><button type="button" onClick={() => { setOpen(false); setAccountsOpen(true); }}>Switch account <span>⇄</span></button><button className="signout-action" type="button" onClick={onSignOut}>Sign out <span>↗</span></button></div>
          </div>
        ) : null}
      </div>
      {drawer ? <Overlay onClose={() => setDrawer(null)} className="drawer-overlay"><ProfileDrawer user={user} panel={drawer} onClose={() => setDrawer(null)} onUpdate={onUpdate} onNotify={onNotify} /></Overlay> : null}
      {accountsOpen ? <AccountSwitcher user={user} onClose={() => setAccountsOpen(false)} onSelect={(account) => { setAccountsOpen(false); onSwitchAccount(account); }} onAdd={() => { setAccountsOpen(false); onSwitchAccount(); }} /> : null}
    </>
  );
}
