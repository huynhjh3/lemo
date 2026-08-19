import React, { useState } from "react";
import { Users, ShieldAlert, ShieldCheck, UserPlus, Trash2, Check, X } from "lucide-react";
import { T, ROLE_LABELS } from "../theme.js";
import { Card, CardTitle, Dot } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useMasterAdminApprovals } from "../hooks/useMasterAdminApprovals.js";
import { updateAppSettings } from "../lib/api/appSettings.js";
import * as approvalsApi from "../lib/api/masterAdminApprovals.js";

// A single Master Admin can no longer unilaterally turn the site off,
// delete an account, or invite a new Owner/Strategic Partner — a second,
// different Master Admin has to approve it first (master_admin_approvals,
// migration 029). Turning the site back ON, and inviting a Consultant or
// Partner, stay unrestricted — see PendingApprovalsCard below for why.
const GATED_INVITE_ROLES = ["owner", "geo_partner"];

const APPROVAL_LABEL = {
  maintenance_on: () => "Turn the site OFF for everyone",
  delete_user: (a) => `Delete ${a.payload.user_name}'s account`,
  invite_owner: (a) => `Invite ${a.payload.name} (${a.payload.email}) as Owner`,
  invite_geo_partner: (a) => `Invite ${a.payload.name} (${a.payload.email}) as Strategic Partner${a.payload.region ? ` — ${a.payload.region}` : ""}`,
};

export default function TeamPage({ profiles, companies, createUser, deleteUser, appSettings }) {
  const { profile } = useAuth();
  const isMasterAdmin = !!profile?.is_master_admin;
  const [deleteError, setDeleteError] = useState(null);
  const approvalsState = useMasterAdminApprovals();

  const removeUser = async (p) => {
    if (!window.confirm(`Request deletion of ${p.name}'s account? A different Master Admin has to approve it before it takes effect.`)) return;
    setDeleteError(null);
    try {
      await approvalsApi.requestDeleteUser(p.id, p.name);
      await approvalsState.refresh();
    } catch (err) {
      setDeleteError(err.message || "Couldn't request deletion — try again.");
    }
  };

  return (
    <div>
      <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }} className="mb-5">Team</h1>
      <div className="flex flex-col gap-4">
        {isMasterAdmin && <MaintenanceModeCard appSettings={appSettings} approvals={approvalsState.approvals} refreshApprovals={approvalsState.refresh} />}
        {isMasterAdmin && (
          <PendingApprovalsCard
            approvalsState={approvalsState}
            createUser={createUser} deleteUser={deleteUser}
            refreshAppSettings={appSettings.refresh}
          />
        )}
        {isMasterAdmin && <AddUserCard companies={companies} createUser={createUser} refreshApprovals={approvalsState.refresh} />}
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
                      <button onClick={() => removeUser(p)} style={{ color: T.red }} title="Request account deletion">
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

function PendingApprovalsCard({ approvalsState, createUser, deleteUser, refreshAppSettings }) {
  const { profile } = useAuth();
  const { approvals, loading } = approvalsState;
  const [actingId, setActingId] = useState(null);
  const [error, setError] = useState(null);

  if (loading || approvals.length === 0) return null;

  const approve = async (a) => {
    setError(null);
    setActingId(a.id);
    try {
      await approvalsApi.approveRequest(a.id, profile.id);
      if (a.action_type === "delete_user") {
        await deleteUser(a.id);
      } else if (a.action_type === "invite_owner" || a.action_type === "invite_geo_partner") {
        await createUser({
          email: a.payload.email, name: a.payload.name,
          role: a.action_type === "invite_owner" ? "owner" : "geo_partner",
          region: a.payload.region, company_id: null,
          approval_id: a.id,
        });
      }
      await Promise.all([approvalsState.refresh(), refreshAppSettings()]);
    } catch (err) {
      setError(err.message || "Couldn't approve — try again.");
    } finally {
      setActingId(null);
    }
  };

  const reject = async (a) => {
    setError(null);
    setActingId(a.id);
    try {
      await approvalsApi.rejectRequest(a.id, profile.id);
      await approvalsState.refresh();
    } catch (err) {
      setError(err.message || "Couldn't reject — try again.");
    } finally {
      setActingId(null);
    }
  };

  return (
    <Card style={{ border: `1px solid ${T.amber}40` }}>
      <CardTitle icon={ShieldCheck}>Pending Approvals</CardTitle>
      <p className="text-xs mb-3" style={{ color: T.textFaint }}>
        Turning the site off, deleting an account, or inviting an Owner/Strategic Partner needs a second, different Master Admin to approve it here.
      </p>
      {error && <p className="text-xs mb-3" style={{ color: T.red }}>{error}</p>}
      <div className="flex flex-col">
        {approvals.map((a) => {
          const isSelf = a.requested_by === profile?.id;
          const acting = actingId === a.id;
          return (
            <div key={a.id} className="flex items-center justify-between text-sm py-2.5" style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
              <div className="flex items-center gap-2">
                {!isSelf && <Dot />}
                <div>
                  <div style={{ color: T.text }}>{APPROVAL_LABEL[a.action_type]?.(a) || a.action_type}</div>
                  <div className="text-xs" style={{ color: T.textFaint }}>Requested by {a.requestedByProfile?.name || "—"}</div>
                </div>
              </div>
              {isSelf ? (
                <span className="text-xs" style={{ color: T.textFaint }}>Waiting on another Master Admin</span>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => approve(a)} disabled={acting}
                    className="flex items-center gap-1 text-xs font-medium rounded-lg px-2.5 py-1"
                    style={{ background: T.teal, color: T.bg, opacity: acting ? 0.7 : 1 }}
                  >
                    <Check size={12} /> Approve
                  </button>
                  <button
                    onClick={() => reject(a)} disabled={acting}
                    className="flex items-center gap-1 text-xs rounded-lg px-2.5 py-1"
                    style={{ border: `1px solid ${T.border}`, color: T.textDim, opacity: acting ? 0.7 : 1 }}
                  >
                    <X size={12} /> Reject
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

const REGION_ROLES = ["bd_consultant", "geo_partner"];
const inputStyle = { background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody };

function AddUserCard({ companies, createUser, refreshApprovals }) {
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
      const email = form.email.trim();
      const name = form.name.trim();
      const region = REGION_ROLES.includes(form.role) ? (form.region.trim() || null) : null;

      if (GATED_INVITE_ROLES.includes(form.role)) {
        await approvalsApi.requestInvite(form.role, { email, name, region });
        await refreshApprovals();
        setSuccess(`Request submitted for ${email} — needs a second Master Admin's approval before the invite goes out.`);
      } else {
        await createUser({
          email, name, role: form.role,
          region, company_id: form.role === "partner" ? form.company_id : null,
        });
        setSuccess(`Invite sent to ${email}.`);
      }
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
        Sends them an email invite to set their own password — you never see or set it. Owner and Strategic Partner invites need a second Master Admin's approval first.
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
          {saving ? "Sending…" : GATED_INVITE_ROLES.includes(form.role) ? "Request approval" : "Send invite"}
        </button>
      </form>
    </Card>
  );
}

function MaintenanceModeCard({ appSettings, approvals, refreshApprovals }) {
  const { settings, loading, refresh } = appSettings;
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [requestError, setRequestError] = useState(null);

  const turnBackOn = async () => {
    setSaving(true);
    try {
      await updateAppSettings({ maintenance_mode: false });
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const requestShutdown = async () => {
    setSaving(true);
    setRequestError(null);
    try {
      await approvalsApi.requestMaintenanceOn();
      await refreshApprovals();
    } catch (err) {
      setRequestError(err.message || "Couldn't request shutdown — try again.");
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
  const shutdownPending = approvals.some((a) => a.action_type === "maintenance_on");

  return (
    <Card style={{ border: `1px solid ${on ? T.red : T.border}` }}>
      <CardTitle icon={ShieldAlert}>Maintenance Mode</CardTitle>
      <p className="text-xs mb-3" style={{ color: T.textFaint }}>
        When on, everyone but Master Admin sees a "temporarily unavailable" screen instead of the app. Turning it on needs a second Master Admin's approval — turning it back off doesn't.
      </p>
      {requestError && <p className="text-xs mb-3" style={{ color: T.red }}>{requestError}</p>}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm" style={{ color: on ? T.red : T.text }}>
          {on ? "Site is currently OFF for everyone else" : shutdownPending ? "Shutdown requested — waiting on another Master Admin" : "Site is live"}
        </span>
        {on ? (
          <button
            onClick={turnBackOn} disabled={saving}
            className="text-xs font-medium rounded-lg px-3 py-1.5"
            style={{ background: T.teal, color: T.bg, opacity: saving ? 0.7 : 1 }}
          >
            Turn site back on
          </button>
        ) : !shutdownPending && (
          <button
            onClick={requestShutdown} disabled={saving}
            className="text-xs font-medium rounded-lg px-3 py-1.5"
            style={{ background: T.red, color: T.bg, opacity: saving ? 0.7 : 1 }}
          >
            Request shutdown
          </button>
        )}
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
