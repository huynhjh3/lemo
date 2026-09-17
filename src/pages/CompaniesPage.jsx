import React, { useState } from "react";
import { Plus, Settings } from "lucide-react";
import { T } from "../theme.js";
import { Card, StatusDot, StageBadge, DealTypeBadge } from "../components/ui.jsx";
import { fmtDealValue } from "../lib/helpers.js";
import Modal from "../components/Modal.jsx";
import NewCompanyModal from "../components/NewCompanyModal.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function CompaniesPage({
  companies, profiles, goToCompany, goToCompanyAndEditOverview, createCompany, regionColors, upsertRegionColor, deleteRegionColor,
}) {
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

      {showModal && (
        <NewCompanyModal
          onClose={() => setShowModal(false)}
          onCreate={async (fields) => {
            const created = await createCompany(fields);
            setShowModal(false);
            goToCompanyAndEditOverview(created.id);
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

