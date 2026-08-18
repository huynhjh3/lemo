import React, { useState } from "react";
import { Plus } from "lucide-react";
import { T, STAGE_ORDER, INDUSTRY_OPTIONS } from "../theme.js";
import { Card, StatusDot, StageBadge, DealTypeBadge } from "../components/ui.jsx";
import { fmtDealValue, fmtDate } from "../lib/helpers.js";
import Modal from "../components/Modal.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function CompaniesPage({ companies, profiles, goToCompany, createCompany }) {
  const { profile } = useAuth();
  const isGeoPartner = profile?.role === "geo_partner";
  const [showModal, setShowModal] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }}>Companies</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-2 shrink-0"
          style={{ background: T.amber, color: T.bg, fontFamily: T.fontBody }}
        >
          <Plus size={15} /> New Company
        </button>
      </div>

      {companies.length === 0 ? (
        <p className="text-sm" style={{ color: T.textFaint }}>No companies yet — add your first one.</p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {companies.map((c) => {
            // A Strategic Partner can now see every region's companies
            // (migration 039) — an amber edge marks which ones are
            // actually theirs (their own region) vs. read-only visibility
            // into everyone else's.
            const isMine = isGeoPartner && c.region === profile.region;
            return (
            <button
              key={c.id}
              onClick={() => goToCompany(c.id)}
              className="text-left rounded-xl p-4 transition-transform hover:-translate-y-0.5"
              style={{ background: T.surface, border: `1px solid ${isMine ? T.amber : T.border}`, boxShadow: isMine ? `0 0 0 1px ${T.amber}` : undefined }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <StatusDot status={c.status} />
                  <span className="text-sm font-semibold truncate" style={{ color: T.text, fontFamily: T.fontDisplay }}>
                    {c.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <DealTypeBadge dealType={c.dealType} />
                  <StageBadge stage={c.stage} />
                </div>
              </div>
              <div className="text-xs mb-3" style={{ color: T.textFaint }}>
                {c.industry} · {c.city} · Rep: {c.rep}{c.code ? ` (${c.code})` : ""}
              </div>
              <div className="flex items-center justify-between text-xs" style={{ color: T.textDim }}>
                <span style={{ fontFamily: T.fontMono, color: T.teal }}>{fmtDealValue(c)}</span>
                <span>{c.lastContact ? `Last contact ${fmtDate(c.lastContact)}` : "No contact yet"}</span>
              </div>
            </button>
            );
          })}
        </div>
      )}

      {showModal && (
        <NewCompanyModal
          profiles={profiles}
          onClose={() => setShowModal(false)}
          onCreate={async (fields) => {
            await createCompany(fields);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}

function NewCompanyModal({ profiles, onClose, onCreate }) {
  const { profile } = useAuth();
  const isOwner = profile?.role === "owner";
  const isGeoPartner = profile?.role === "geo_partner";
  const canAssignRep = isOwner || isGeoPartner;
  const [form, setForm] = useState({
    name: "", code: "", industry: "", city: "", region: isGeoPartner ? (profile.region || "") : "", rep_id: "", stage: "Lead",
    deal_type: "enterprise", deal_value: "", interest: "", next_follow_up: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const inputStyle = { background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody };
  const revShare = form.deal_type === "revenue_share";

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        name: form.name,
        code: form.code.trim() || null,
        industry: form.industry || null,
        city: form.city || null,
        region: form.region || null,
        rep_id: form.rep_id || null,
        stage: form.stage,
        deal_type: form.deal_type,
        deal_value: form.deal_value ? Number(form.deal_value) : 0,
        interest: form.interest || null,
        next_follow_up: form.next_follow_up || null,
      });
    } catch (err) {
      setError(err.message || "Something went wrong — try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="New Company" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input required placeholder="Company name" value={form.name} onChange={set("name")} className="w-full text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
        <div className={isOwner ? "grid grid-cols-3 gap-3" : "grid grid-cols-2 gap-3"}>
          <select value={form.industry} onChange={set("industry")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
            <option value="">Select industry</option>
            {INDUSTRY_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
          <input placeholder="City" value={form.city} onChange={set("city")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
          {isOwner && (
            <input placeholder="Code" value={form.code} onChange={set("code")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
          )}
        </div>
        {(isOwner || isGeoPartner) && (
          <input
            placeholder="Region" value={form.region} onChange={set("region")} disabled={isGeoPartner}
            className="text-sm rounded-lg px-3 py-2 outline-none" style={{ ...inputStyle, opacity: isGeoPartner ? 0.6 : 1 }}
          />
        )}
        {canAssignRep && (
          <select value={form.rep_id} onChange={set("rep_id")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
            <option value="">Unassigned rep</option>
            {profiles.filter((p) => p.role !== "partner").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <div className="grid grid-cols-2 gap-3">
          <select value={form.stage} onChange={set("stage")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
            {/* A brand-new company can never have an approved/bypassed
                Pre-Install Checklist yet (migration 037), so Installed
                isn't offered here — it's only reachable once that's done. */}
            {STAGE_ORDER.filter((s) => s !== "Installed").map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={form.deal_type} onChange={set("deal_type")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
            <option value="enterprise">Enterprise</option>
            <option value="revenue_share">Revenue Share</option>
          </select>
        </div>
        <input
          type="number" min="0" max={revShare ? 100 : undefined} step={revShare ? 0.1 : 1}
          placeholder={revShare ? "Our revenue share (%)" : "Monthly deal value ($)"}
          value={form.deal_value} onChange={set("deal_value")}
          className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}
        />
        <textarea placeholder="Interest / context" value={form.interest} onChange={set("interest")} rows={3} className="text-sm rounded-lg px-3 py-2 outline-none resize-none" style={inputStyle} />
        <div>
          <label className="text-xs mb-1 block" style={{ color: T.textFaint }}>Next follow-up</label>
          <input type="date" value={form.next_follow_up} onChange={set("next_follow_up")} className="text-sm rounded-lg px-3 py-2 outline-none w-full" style={inputStyle} />
        </div>
        {error && <p className="text-xs" style={{ color: T.red }}>{error}</p>}
        <button type="submit" disabled={saving} className="text-sm font-medium rounded-lg py-2.5 mt-1" style={{ background: T.amber, color: T.bg, fontFamily: T.fontBody, opacity: saving ? 0.7 : 1 }}>
          {saving ? "Creating…" : "Create company"}
        </button>
      </form>
    </Modal>
  );
}
