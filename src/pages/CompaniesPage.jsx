import React, { useState } from "react";
import { CalendarPlus, Settings } from "lucide-react";
import { T } from "../theme.js";
import { Card, StatusDot, StageBadge, DealTypeBadge } from "../components/ui.jsx";
import { fmtDealValue } from "../lib/helpers.js";
import { reasonLabel } from "../lib/declineReasons.js";
import Modal from "../components/Modal.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
// 30-minute slots, 8:00 AM through the 7:30 PM slot (ends 8:00 PM).
const SLOTS = Array.from({ length: 24 }, (_, i) => { const m = 8 * 60 + i * 30; return { h: Math.floor(m / 60), m: m % 60 }; });
const slotLabel = ({ h, m }) => `${h % 12 || 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
const selectStyle = { background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody };

// Compact "book the showroom" row for the Companies header. A slot is taken once
// ANY booking overlaps it (the database also refuses overlaps, so two people
// can't grab the same slot even in the same second).
function QuickBook({ companies, showroomBookings, createShowroomBooking, deleteShowroomBooking, profile }) {
  const [companyId, setCompanyId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [slot, setSlot] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }

  const slots = SLOTS.map((s) => {
    const [y, mo, d] = date ? date.split("-").map(Number) : [0, 0, 0];
    const start = new Date(y, mo - 1, d, s.h, s.m);
    const end = new Date(start.getTime() + 30 * 60000);
    const taken = showroomBookings.some((b) => new Date(b.startAt) < end && new Date(b.endAt) > start);
    return { key: `${s.h}:${s.m}`, label: slotLabel(s), start, end, taken, past: start < new Date() };
  });
  const free = slots.filter((s) => !s.taken && !s.past);
  // Everything already booked on the picked date, each with Remove (yours, or any if you're an Owner).
  const ymd = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const dayBookings = showroomBookings.filter((b) => ymd(b.startAt) === date).sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  const fmtT = (iso) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const remove = async (b) => {
    if (!window.confirm(`Remove the ${fmtT(b.startAt)} showroom booking for ${b.companyName || b.prospectName || "this booking"}?`)) return;
    setMsg(null);
    try { await deleteShowroomBooking(b.id); setMsg({ ok: true, text: "Booking removed. That time is open again." }); }
    catch (err) { setMsg({ ok: false, text: err.message || "Couldn't remove that booking. Try again." }); }
  };

  const book = async () => {
    const chosen = slots.find((s) => s.key === slot);
    if (!companyId || !date || !chosen) { setMsg({ ok: false, text: "Pick a company, a date and a time." }); return; }
    setSaving(true); setMsg(null);
    try {
      await createShowroomBooking({ start_at: chosen.start.toISOString(), end_at: chosen.end.toISOString(), company_id: companyId });
      const name = companies.find((c) => c.id === companyId)?.name;
      setMsg({ ok: true, text: `Booked ${name}, ${chosen.start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at ${chosen.label}.` });
      setSlot("");
    } catch (err) {
      setMsg({ ok: false, text: err.message || "Couldn't book that slot. Try again." });
    } finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col gap-1 flex-1 min-w-0 items-end">
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <span className="flex items-center gap-1.5 text-xs" style={{ color: T.textFaint }}><CalendarPlus size={14} /> Schedule showroom</span>
        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="text-sm rounded-lg px-2 py-2 outline-none" style={{ ...selectStyle, color: companyId ? T.text : T.textFaint, maxWidth: 180 }}>
          <option value="">Company…</option>
          {[...companies].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" value={date} min={todayStr()} onChange={(e) => { setDate(e.target.value); setSlot(""); setMsg(null); }} className="text-sm rounded-lg px-2 py-2 outline-none" style={selectStyle} />
        <select value={slot} onChange={(e) => setSlot(e.target.value)} disabled={!date} className="text-sm rounded-lg px-2 py-2 outline-none" style={{ ...selectStyle, color: slot ? T.text : T.textFaint }}>
          <option value="">{date && free.length === 0 ? "Fully booked" : "Time…"}</option>
          {slots.map((s) => <option key={s.key} value={s.key} disabled={s.taken || s.past}>{s.label}{s.taken ? " (booked)" : ""}</option>)}
        </select>
        <button onClick={book} disabled={saving} className="text-sm font-medium rounded-lg px-3 py-2 shrink-0" style={{ background: T.amber, color: T.bg, fontFamily: T.fontBody, opacity: saving ? 0.6 : 1 }}>
          {saving ? "Booking…" : "Book"}
        </button>
      </div>
      {msg && <span className="text-xs" style={{ color: msg.ok ? T.teal : T.red }}>{msg.text}</span>}
      {dayBookings.map((b) => {
        const canRemove = deleteShowroomBooking && (b.bookedById === profile?.id || profile?.role === "owner");
        return (
          <span key={b.id} className="flex items-center gap-2 text-xs" style={{ color: T.textFaint }}>
            <span style={{ fontFamily: T.fontMono, color: T.textDim }}>{fmtT(b.startAt)}</span>
            {b.companyName || b.prospectName || "Booked"} · {b.bookedByName}
            {canRemove && <button onClick={() => remove(b)} style={{ color: T.red }}>Remove</button>}
          </span>
        );
      })}
    </div>
  );
}

export default function CompaniesPage({
  companies, profiles, goToCompany, regionColors, upsertRegionColor, deleteRegionColor, showroomBookings = [], createShowroomBooking, deleteShowroomBooking,
}) {
  const { profile } = useAuth();
  const isOwner = profile?.role === "owner";
  const isGeoPartner = profile?.role === "geo_partner";
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
  // Every region that exists: the legend's regions plus any a company is actually set to.
  const regionOptions = [...new Set([...Object.keys(regionColors), ...companies.map((c) => c.region).filter(Boolean), ...(isGeoPartner && profile.region ? [profile.region] : [])])].sort((a, b) => a.localeCompare(b));
  // The rep filter (Owners) and the region filter (everyone) narrow together.
  const visibleCompanies = companies.filter((c) => (
    (!(isOwner && filterRepId) || c.repId === filterRepId)
    && (filterRegion === "ALL" || c.region === filterRegion)
  ));

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
        <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }}>Companies</h1>
        {createShowroomBooking && <QuickBook companies={companies} showroomBookings={showroomBookings} createShowroomBooking={createShowroomBooking} deleteShowroomBooking={deleteShowroomBooking} profile={profile} />}
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
          {regionOptions.length > 0 && (
            <select
              value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)}
              className="text-sm rounded-lg px-3 py-2 outline-none"
              style={{ background: T.surface2, border: `1px solid ${T.border}`, color: filterRegion === "ALL" ? T.textFaint : T.text, fontFamily: T.fontBody }}
              title="Show one region"
            >
              <option value="ALL">All regions</option>
              {regionOptions.map((r) => <option key={r} value={r}>{r}{isGeoPartner && r === profile.region ? " (yours)" : ""}</option>)}
            </select>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {Object.entries(regionColors).map(([region, color]) => (
          // Click a region to show only it; click it again to show every region.
          <button
            key={region} type="button" onClick={() => setFilterRegion(filterRegion === region ? "ALL" : region)}
            className="flex items-center gap-1.5 text-xs" style={{ color: filterRegion === region ? T.text : T.textFaint, fontWeight: filterRegion === region ? 600 : 400 }}
            title={filterRegion === region ? "Show every region" : `Show only ${region}`}
          >
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: color }} />
            {region}
          </button>
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
          {filterRepId || filterRegion !== "ALL"
            ? `No companies${filterRepId ? " for this person" : ""}${filterRegion !== "ALL" ? ` in ${filterRegion}` : ""}.`
            : "No companies yet. Use New Company in the sidebar to add your first one."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  {/* Deal terms hide from non-owners once Installed —
                      matches CompanyProfile.jsx's dealFiguresHidden. */}
                  {!(!isOwner && c.stage === "Installed") && <DealTypeBadge dealType={c.dealType} />}
                  <StageBadge stage={c.stage} />
                </div>
              </div>
              <div className="text-xs mb-3" style={{ color: T.textFaint }}>
                {c.industry} · {c.city} · Rep: {c.rep}{c.code ? ` (${c.code})` : ""}
                {c.stage === "Stay in Contact" && c.declineReason && <span style={{ color: T.amber }}> · Why: {reasonLabel(c.declineReason)}</span>}
              </div>
              {!(!isOwner && c.stage === "Installed") && (
                <div className="text-xs" style={{ color: T.textDim }}>
                  <span style={{ fontFamily: T.fontMono, color: T.teal }}>{fmtDealValue(c)}</span>
                </div>
              )}
            </button>
            );
          })}
        </div>
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

