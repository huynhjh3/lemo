import React, { useState } from "react";
import { Users, ShieldAlert } from "lucide-react";
import { T, ROLE_LABELS } from "../theme.js";
import { Card, CardTitle } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useAppSettings } from "../hooks/useAppSettings.js";
import { updateAppSettings } from "../lib/api/appSettings.js";

export default function TeamPage({ profiles }) {
  const { profile } = useAuth();

  return (
    <div>
      <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }} className="mb-5">Team</h1>
      <div className="flex flex-col gap-4">
        {profile?.is_master_admin && <MaintenanceModeCard />}
        <Card>
          <CardTitle icon={Users}>Members</CardTitle>
          {profiles.length === 0 ? (
            <p className="text-xs" style={{ color: T.textFaint }}>No team members found.</p>
          ) : (
            <div className="flex flex-col">
              {profiles.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm py-2.5" style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                  <span style={{ color: T.text }}>
                    {p.name}
                    {(p.role === "geo_partner" || p.role === "bd_consultant") && p.region && (
                      <span className="text-xs ml-2" style={{ color: T.textFaint }}>· {p.region}</span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    {p.is_master_admin && (
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full uppercase tracking-wide"
                        style={{ color: T.red, background: `${T.red}14`, fontFamily: T.fontMono }}
                      >
                        Master Admin
                      </span>
                    )}
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full uppercase tracking-wide"
                      style={{ color: p.role === "owner" ? T.amber : T.textDim, background: p.role === "owner" ? `${T.amber}14` : T.surface2, fontFamily: T.fontMono }}
                    >
                      {ROLE_LABELS[p.role] || p.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs mt-4" style={{ color: T.textFaint }}>
            New members are added by an owner in the Supabase dashboard — see SETUP.md.
          </p>
        </Card>
      </div>
    </div>
  );
}

function MaintenanceModeCard() {
  const { settings, loading, refresh } = useAppSettings();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    setSaving(true);
    try {
      await updateAppSettings({ maintenance_mode: !settings.maintenance_mode });
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const saveMessage = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateAppSettings({ maintenance_message: message.trim() || null });
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) return null;
  const on = settings.maintenance_mode;

  return (
    <Card style={{ border: `1px solid ${on ? T.red : T.border}` }}>
      <CardTitle icon={ShieldAlert}>Maintenance Mode</CardTitle>
      <p className="text-xs mb-3" style={{ color: T.textFaint }}>
        When on, everyone but Master Admin sees a "temporarily unavailable" screen instead of the app.
      </p>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm" style={{ color: on ? T.red : T.text }}>
          {on ? "Site is currently OFF for everyone else" : "Site is live"}
        </span>
        <button
          onClick={toggle} disabled={saving}
          className="text-xs font-medium rounded-lg px-3 py-1.5"
          style={{ background: on ? T.teal : T.red, color: T.bg, opacity: saving ? 0.7 : 1 }}
        >
          {on ? "Turn site back on" : "Turn site off"}
        </button>
      </div>
      <form onSubmit={saveMessage} className="flex gap-2">
        <input
          placeholder={settings.maintenance_message || "Custom message shown while off (optional)"}
          value={message} onChange={(e) => setMessage(e.target.value)}
          className="flex-1 text-sm rounded-lg px-3 py-2 outline-none"
          style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody }}
        />
        <button type="submit" disabled={saving} className="text-xs font-medium rounded-lg px-3 py-1.5" style={{ background: T.surface2, color: T.textDim, border: `1px solid ${T.border}` }}>
          Save message
        </button>
      </form>
    </Card>
  );
}
