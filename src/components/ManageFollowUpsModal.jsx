import React, { useState } from "react";
import { T } from "../theme.js";
import Modal from "./Modal.jsx";
import { scoreFollowUps, fmtDealValue } from "../lib/helpers.js";

const REASON_OPTIONS = [
  ["not_pursuing", "Not pursuing"],
  ["test_data", "Test / demo data"],
  ["handled_elsewhere", "Handled outside the CRM"],
  ["other", "Other"],
];

// Same region scoping as highPriorityActions' Follow-Up items (companies
// itself isn't region-scoped by RLS for a Strategic Partner — migration
// 039 — so this check is load-bearing here too); a Consultant's companies
// prop is already scoped to just their own by RLS, so no extra check.
export default function ManageFollowUpsModal({ companies, tasks, profile, updateCompany, goToCompany, onClose }) {
  const scope = profile?.role === "geo_partner" ? companies.filter((c) => c.region === profile.region) : companies;
  const flagged = scoreFollowUps(scope, tasks);
  const [selected, setSelected] = useState(new Set());
  const [reason, setReason] = useState("");
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState(null);

  const toggle = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allIds = flagged.map(({ company }) => company.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allIds));

  const dismissSelected = async () => {
    if (selected.size === 0 || !reason) return;
    setDismissing(true);
    setError(null);
    try {
      const reasonLabel = REASON_OPTIONS.find(([v]) => v === reason)?.[1] || null;
      const now = new Date().toISOString();
      await Promise.all(
        Array.from(selected).map((id) => updateCompany(id, {
          follow_up_dismissed_at: now,
          follow_up_dismissed_by: profile.id,
          follow_up_dismissed_reason: reasonLabel,
        }))
      );
      setSelected(new Set());
    } catch (err) {
      setError(err.message || "Couldn't dismiss — try again.");
    } finally {
      setDismissing(false);
    }
  };

  return (
    <Modal title="Manage Follow-Ups" onClose={onClose}>
      <div className="flex flex-col gap-3">
        {flagged.length === 0 ? (
          <p className="text-sm" style={{ color: T.textFaint }}>Nothing flagged right now.</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <button type="button" onClick={toggleAll} className="text-xs" style={{ color: T.amber }}>
                {allSelected ? "Clear selection" : "Select all"}
              </button>
              <span className="text-xs" style={{ color: T.textFaint }}>{flagged.length} flagged</span>
            </div>

            <div className="flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: 320 }}>
              {flagged.map(({ company: c, reasons }) => (
                <div key={c.id} className="flex items-start gap-2 text-sm rounded-lg px-2 py-2" style={{ background: T.surface2 }}>
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="mt-1" />
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggle(c.id)}>
                    <div style={{ color: T.text }}>
                      {c.name} <span style={{ color: T.textFaint, fontFamily: T.fontMono }}>· {fmtDealValue(c)}</span>
                    </div>
                    <div className="text-xs" style={{ color: T.textFaint }}>{reasons[0]}</div>
                  </div>
                  <button
                    type="button" onClick={() => { goToCompany(c.id); onClose(); }}
                    className="text-xs shrink-0" style={{ color: T.amber }}
                  >
                    View
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2" style={{ borderTop: `1px solid ${T.border}` }}>
              <select
                value={reason} onChange={(e) => setReason(e.target.value)}
                className="text-sm rounded-lg px-3 py-2 outline-none flex-1"
                style={{ background: T.surface2, border: `1px solid ${T.border}`, color: reason ? T.text : T.textFaint, fontFamily: T.fontBody }}
              >
                <option value="">Reason for dismissing…</option>
                {REASON_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
              <button
                type="button" onClick={dismissSelected}
                disabled={selected.size === 0 || !reason || dismissing}
                className="text-sm font-medium rounded-lg px-3 py-2 shrink-0"
                style={{ background: T.amber, color: T.bg, opacity: selected.size === 0 || !reason || dismissing ? 0.5 : 1 }}
              >
                {dismissing ? "Dismissing…" : `Dismiss ${selected.size || ""}`.trim()}
              </button>
            </div>
            {error && <p className="text-xs" style={{ color: T.red }}>{error}</p>}
            <p className="text-xs" style={{ color: T.textFaint }}>
              Dismissing clears the flag until something changes — a new contact logged or a stage change brings it back if it's still stalled.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
