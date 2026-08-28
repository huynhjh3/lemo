import React, { useState } from "react";
import { Plus, Settings } from "lucide-react";
import { T, STAGE_ORDER, INDUSTRY_OPTIONS } from "../theme.js";
import { Card, StatusDot, StageBadge, DealTypeBadge } from "../components/ui.jsx";
import { fmtDealValue, isRevShare } from "../lib/helpers.js";
import Modal from "../components/Modal.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function CompaniesPage({ companies, profiles, goToCompany, createCompany, regionColors, upsertRegionColor, deleteRegionColor }) {
  const { profile } = useAuth();
  const isOwner = profile?.role === "owner";
  const isGeoPartner = profile?.role === "geo_partner";
  const [showModal, setShowModal] = useState(false);
  const [showRegionModal, setShowRegionModal] = useState(false);
  // Landing default: an Owner who's also a rep on real accounts (e.g.
  // Horace) sees THEIR OWN companies first, every time they arrive here —
  // not whatever was picked last. Falls back to everyone's if they aren't
  // a rep on anything (a purely managerial Owner). The dropdown below can
  // always switch to "Everyone's companies" or anyone else — this is only
  // the initial state, computed fresh each time this component mounts
  // (i.e. each time you navigate back to Companies), never persisted.
  const [filterRepId, setFilterRepId] = useState(() => (
    isOwner && companies.some((c) => c.repId === profile.id) ? profile.id : ""
  ));
  // Same landing-default idea for a Strategic Partner: their own region
  // first, every time they arrive here — not every region at once. "ALL"
  // is the sentinel for the drop-down's "every region" choice; any other
  // value is a specific region (their own, by default, or one they picked).
  const [filterRegion, setFilterRegion] = useState(() => (isGeoPartner ? profile.region : "ALL"));

  // Owner-only — every other role already only sees their own/in-region
  // companies, so a person filter on top of that would just narrow what's
  // already narrow. Every internal person is selectable (Strategic
  // Partner and Consultant included), even one with zero companies
  // currently assigned — only Partner (an external client, never a rep)
  // is excluded.
  const repOptions = profiles.filter((p) => p.role !== "partner").sort((a, b) => a.name.localeCompare(b.name));
  const otherRegionOptions = Object.keys(regionColors).filter((r) => r !== profile?.region);
  const visibleCompanies = isOwner && filterRepId
    ? companies.filter((c) => c.repId === filterRepId)
    : isGeoPartner && filterRegion !== "ALL"
      ? companies.filter((c) => c.region === filterRegion)
      : companies;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }}>Companies</h1>
        <div className="flex items-center gap-2">
          {isOwner && repOptions.length > 0 && (
            <select
              value={filterRepId} onChange={(e) => setFilterRepId(e.target.value)}
              className="text-sm rounded-lg px-3 py-2 outline-none"
              style={{ background: T.surface2, border: `1px solid ${T.border}`, color: filterRepId ? T.text : T.textFaint, fontFamily: T.fontBody }}
            >
              <option value="">Everyone's companies</option>
              {repOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          {isGeoPartner && (
            <select
              value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)}
              className="text-sm rounded-lg px-3 py-2 outline-none"
              style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody }}
            >
              <option value={profile.region}>My region — {profile.region}</option>
              <option value="ALL">All companies</option>
              {otherRegionOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-2 shrink-0"
            style={{ background: T.amber, color: T.bg, fontFamily: T.fontBody }}
          >
            <Plus size={15} /> New Company
          </button>
        </div>
      </div>
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {Object.entries(regionColors).map(([region, color]) => (
          <span key={region} className="flex items-center gap-1.5 text-xs" style={{ color: T.textFaint }}>
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: color }} />
            {region}
          </span>
        ))}
        {isGeoPartner && (
          <span className="flex items-center gap-1.5 text-xs" style={{ color: T.textFaint }}>
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: T.amber }} />
            Your region
          </span>
        )}
        {isOwner && (
          <button
            onClick={() => setShowRegionModal(true)}
            className="flex items-center gap-1 text-xs"
            style={{ color: T.textFaint }}
            title="Add or recolor regions"
          >
            <Settings size={12} /> Manage regions
          </button>
        )}
      </div>

      {visibleCompanies.length === 0 ? (
        <p className="text-sm" style={{ color: T.textFaint }}>
          {filterRepId
            ? "No companies assigned to this person."
            : isGeoPartner && filterRegion !== "ALL"
              ? "No companies in this region."
              : "No companies yet — add your first one."}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {visibleCompanies.map((c) => {
            // A Strategic Partner can now see every region's companies
            // (migration 039) — an amber edge marks which ones are
            // actually theirs (their own region) vs. read-only visibility
            // into everyone else's, overriding the region legend below.
            const isMine = isGeoPartner && c.region === profile.region;
            const edgeColor = isMine ? T.amber : regionColors[c.region];
            return (
            <button
              key={c.id}
              onClick={() => goToCompany(c.id)}
              className="text-left rounded-xl p-4 transition-transform hover:-translate-y-0.5"
              style={{ background: T.surface, border: `1px solid ${edgeColor || T.border}`, boxShadow: edgeColor ? `0 0 0 1px ${edgeColor}` : undefined }}
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
              <div className="text-xs" style={{ color: T.textDim }}>
                <span style={{ fontFamily: T.fontMono, color: T.teal }}>{fmtDealValue(c)}</span>
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

      {showRegionModal && (
        <ManageRegionColorsModal
          regionColors={regionColors}
          upsertRegionColor={upsertRegionColor}
          deleteRegionColor={deleteRegionColor}
          onClose={() => setShowRegionModal(false)}
        />
      )}
    </div>
  );
}

function ManageRegionColorsModal({ regionColors, upsertRegionColor, deleteRegionColor, onClose }) {
  const [newRegion, setNewRegion] = useState("");
  const [newColor, setNewColor] = useState("#4A6FA0");
  const [error, setError] = useState(null);
  const [busyRegion, setBusyRegion] = useState(null);
  const inputStyle = { background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody };

  const recolor = async (region, color) => {
    setBusyRegion(region);
    setError(null);
    try {
      await upsertRegionColor(region, color);
    } catch (err) {
      setError(err.message || "Couldn't save that color — try again.");
    } finally {
      setBusyRegion(null);
    }
  };

  const remove = async (region) => {
    if (!window.confirm(`Remove "${region}" from the legend? Companies already set to this region are unaffected — they'll just show a plain border until it's re-added.`)) return;
    setBusyRegion(region);
    setError(null);
    try {
      await deleteRegionColor(region);
    } catch (err) {
      setError(err.message || "Couldn't remove that region — try again.");
    } finally {
      setBusyRegion(null);
    }
  };

  const addRegion = async (e) => {
    e.preventDefault();
    const region = newRegion.trim();
    if (!region) return;
    setBusyRegion(region);
    setError(null);
    try {
      await upsertRegionColor(region, newColor);
      setNewRegion("");
      setNewColor("#4A6FA0");
    } catch (err) {
      setError(err.message || "Couldn't add that region — try again.");
    } finally {
      setBusyRegion(null);
    }
  };

  return (
    <Modal title="Manage Regions" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-xs" style={{ color: T.textFaint }}>
          Region itself is still typed freely on a company or Strategic Partner's profile — this just controls what color that region's name renders as here and on the Companies grid. Type the region exactly as it's spelled elsewhere, or the color won't match.
        </p>
        {Object.entries(regionColors).length > 0 && (
          <div className="flex flex-col gap-2">
            {Object.entries(regionColors).map(([region, color]) => (
              <div key={region} className="flex items-center gap-2">
                <input
                  type="color" value={color} disabled={busyRegion === region}
                  onChange={(e) => recolor(region, e.target.value)}
                  className="rounded cursor-pointer" style={{ width: 32, height: 32, background: "none", border: `1px solid ${T.border}`, padding: 2 }}
                />
                <span className="text-sm flex-1" style={{ color: T.text }}>{region}</span>
                <button
                  type="button" onClick={() => remove(region)} disabled={busyRegion === region}
                  className="text-xs" style={{ color: T.red, opacity: busyRegion === region ? 0.5 : 1 }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={addRegion} className="flex items-center gap-2 pt-2" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
          <input
            type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)}
            className="rounded cursor-pointer" style={{ width: 32, height: 32, background: "none", border: `1px solid ${T.border}`, padding: 2 }}
          />
          <input
            placeholder="New region name" value={newRegion} onChange={(e) => setNewRegion(e.target.value)}
            className="text-sm rounded-lg px-3 py-2 outline-none flex-1" style={inputStyle}
          />
          <button
            type="submit" disabled={!newRegion.trim() || busyRegion === newRegion.trim()}
            className="text-xs font-medium rounded-lg px-3 py-2"
            style={{ background: T.amber, color: T.bg, opacity: !newRegion.trim() ? 0.6 : 1 }}
          >
            Add
          </button>
        </form>
        {error && <p className="text-xs" style={{ color: T.red }}>{error}</p>}
      </div>
    </Modal>
  );
}

function NewCompanyModal({ profiles, onClose, onCreate }) {
  const { profile } = useAuth();
  const isOwner = profile?.role === "owner";
  const isGeoPartner = profile?.role === "geo_partner";
  const canAssignRep = isOwner || isGeoPartner;
  const [form, setForm] = useState({
    name: "", code: "", industry: "", city: "", region: isGeoPartner ? (profile.region || "") : "", rep_id: "", stage: "Lead",
    deal_type: "enterprise", deal_value: "", fixed_rent_amount: "", interest: "", next_follow_up: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const inputStyle = { background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody };
  const revShare = isRevShare({ dealType: form.deal_type });
  const hasFixedRent = form.deal_type === "fixed_rent" || form.deal_type === "fixed_plus_share";

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
        fixed_rent_amount: hasFixedRent && form.fixed_rent_amount !== "" ? Number(form.fixed_rent_amount) : null,
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
          <select
            value={form.deal_type}
            onChange={(e) => {
              // Fixed Rent is almost always "we keep everything after
              // rent" — default the share to 100% but leave it editable
              // for the rare exception. Fixed + Revenue Share has no
              // sensible default; it's whatever was actually negotiated.
              const deal_type = e.target.value;
              setForm((f) => ({ ...f, deal_type, deal_value: deal_type === "fixed_rent" ? "100" : f.deal_value }));
            }}
            className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}
          >
            <option value="enterprise">Enterprise</option>
            <option value="revenue_share">Revenue Share</option>
            <option value="fixed_rent">Fixed Rent</option>
            <option value="fixed_plus_share">Fixed + Revenue Share</option>
          </select>
        </div>
        <input
          type="number" min="0" max={revShare ? 100 : undefined} step={revShare ? 0.1 : 1}
          placeholder={revShare ? "Our revenue share (%)" : "Monthly deal value ($)"}
          value={form.deal_value} onChange={set("deal_value")}
          className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}
        />
        {hasFixedRent && (
          <input
            type="number" min="0" step="0.01"
            placeholder="Fixed rent, per month ($) — subtracted from revenue"
            value={form.fixed_rent_amount} onChange={set("fixed_rent_amount")}
            className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}
          />
        )}
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
