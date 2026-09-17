import React, { useState } from "react";
import { T, INDUSTRY_OPTIONS } from "../theme.js";
import Modal from "./Modal.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const FIXED_RENT_INDUSTRIES = ["Shopping Center", "Airport", "Transit"];

// Trimmed to the bare minimum needed to get a Lead into the pipeline —
// everything else (city, code, rep, deal terms, notes) is filled in right
// after creation on the company's own Overview page, which opens straight
// into edit mode (see goToCompanyAndEditOverview in App.jsx) instead of
// asking for it all up front in a modal. A new company is always a Lead
// (rep/stage can both change later — no reason to ask either here) and
// always starts Enterprise/$0, except the same Fixed-Rent industry
// auto-suggest the old form had (Shopping Center/Airport/Transit are
// almost always a landlord relationship) — applied silently at creation
// since deal type itself isn't asked here anymore.
//
// Shared by CompaniesPage's own "+ New Company" button and the sidebar's
// persistent quick-add (App.jsx) — one modal, two entry points, so a
// company can be started from anywhere instead of only from the
// Companies tab.
export default function NewCompanyModal({ onClose, onCreate }) {
  const { profile } = useAuth();
  const isOwner = profile?.role === "owner";
  const isGeoPartner = profile?.role === "geo_partner";
  const [form, setForm] = useState({ name: "", industry: "", region: isGeoPartner ? (profile.region || "") : "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const inputStyle = { background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const isFixedRentIndustry = FIXED_RENT_INDUSTRIES.includes(form.industry);
      await onCreate({
        name: form.name,
        industry: form.industry || null,
        region: form.region || null,
        stage: "Lead",
        deal_type: isFixedRentIndustry ? "fixed_rent" : "enterprise",
        deal_value: isFixedRentIndustry ? 100 : 0,
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
        <select value={form.industry} onChange={set("industry")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
          <option value="">Select industry</option>
          {INDUSTRY_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
        {(isOwner || isGeoPartner) && (
          <input
            placeholder="Region" value={form.region} onChange={set("region")} disabled={isGeoPartner}
            className="text-sm rounded-lg px-3 py-2 outline-none" style={{ ...inputStyle, opacity: isGeoPartner ? 0.6 : 1 }}
          />
        )}
        {error && <p className="text-xs" style={{ color: T.red }}>{error}</p>}
        <button type="submit" disabled={saving} className="text-sm font-medium rounded-lg py-2.5 mt-1" style={{ background: T.amber, color: T.bg, fontFamily: T.fontBody, opacity: saving ? 0.7 : 1 }}>
          {saving ? "Creating…" : "Create company"}
        </button>
      </form>
    </Modal>
  );
}
