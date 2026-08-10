import React, { useState } from "react";
import { Users, ShieldAlert, UserPlus, Trash2 } from "lucide-react";
import { T, ROLE_LABELS } from "../theme.js";
import { Card, CardTitle } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useAppSettings } from "../hooks/useAppSettings.js";
import { updateAppSettings } from "../lib/api/appSettings.js";

export default function TeamPage({ profiles, companies, createUser, deleteUser }) {
  const { profile } = useAuth();
  const isMasterAdmin = !!profile?.is_master_admin;
  const [deleteError, setDeleteError] = useState(null);

  const removeUser = async (p) => {
    if (!window.confirm(`Delete ${p.name}'s account? This can't be undone — they'll be signed out immediately and lose access.`)) return;
    setDeleteError(null);
    try {
      await deleteUser(p.id);
    } catch (err) {
      setDeleteError(err.message || "Couldn't delete — try again.");
    }
  };

  return (
    <div>
      <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }} className="mb-5">Team</h1>
      <div className="flex flex-col gap-4">
        {isMasterAdmin && <MaintenanceModeCard />}
        {isMasterAdmin && <AddUserCard companies={companies} createUser={createUser} />}
        <Card>
          <CardTitle icon={Users}>Members</CardTitle>
          {deleteError && <p className="text-xs mb-3" style={{ color: T.red }}>{deleteError}</p>}
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
                    {isMasterAdmin && p.id !== profile.id && (
                      <button onClick={() => removeUser(p)} style={{ color: T.red }} title="Delete account">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!isMasterAdmin && (
            <p className="text-xs mt-4" style={{ color: T.textFaint }}>
              New members are added by Master Admin — see SETUP.md for the fallback SQL flow.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

const REGION_ROLES = ["bd_consultant", "geo_partner"];
const inputStyle = { background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody };

function AddUserCard({ companies, createUser }) {
  const [form, setForm] = useState({ email: "", name: "", role: "bd_consultant", region: "", company_id: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await createUser({
        email: form.email.trim(),
        name: form.name.trim(),
        role: form.role,
        region: REGION_ROLES.includes(form.role) ? (form.region.trim() || null) : null,
        company_id: form.role === "partner" ? form.company_id : null,
      });
      setSuccess(`Invite sent to ${form.email.trim()}.`);
      setForm({ email: "", name: "", role: "bd_consultant", region: "", company_id: "" });
    } catch (err) {
      setError(err.message || "Something went wrong — try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardTitle icon={UserPlus}>Add a team member</CardTitle>
      <p className="text-xs mb-3" style={{ color: T.textFaint }}>
        Sends them an email invite to set their own password — you never see or set it.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <input required type="email" placeholder="Email" value={form.email} onChange={set("email")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
          <input required placeholder="Name" value={form.name} onChange={set("name")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
        </div>
        <select value={form.role} onChange={set("role")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
          {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {REGION_ROLES.includes(form.role) && (
          <input placeholder="Region (e.g. Dallas)" value={form.region} onChange={set("region")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
        )}
        {form.role === "partner" && (
          <select required value={form.company_id} onChange={set("company_id")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
            <option value="">Select their company</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {error && <p className="text-xs" style={{ color: T.red }}>{error}</p>}
        {success && <p className="text-xs" style={{ color: T.teal }}>{success}</p>}
        <button type="submit" disabled={saving} className="text-sm font-medium rounded-lg py-2.5" style={{ background: T.amber, color: T.bg, opacity: saving ? 0.7 : 1 }}>
          {saving ? "Sending invite…" : "Send invite"}
        </button>
      </form>
    </Card>
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
