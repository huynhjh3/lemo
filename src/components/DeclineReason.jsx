import React, { useMemo, useState } from "react";
import { HelpCircle } from "lucide-react";
import { T } from "../theme.js";
import { Card, CardTitle } from "./ui.jsx";
import { REASONS, reasonLabel, suggestReason, declineStats } from "../lib/declineReasons.js";

const inputStyle = { background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody };

// Pick why a company stopped (one click), add an optional one-line note, Save. The reason
// the communications log points to is pre-selected, so confirming it is a single click.
export function DeclineReasonPicker({ company, onSave, onClose }) {
  const suggestion = useMemo(() => suggestReason(company), [company]);
  const [reason, setReason] = useState(company.declineReason || suggestion?.id || "");
  const [note, setNote] = useState(company.declineNote || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    if (!reason) { setError("Pick a reason first."); return; }
    setSaving(true); setError(null);
    try { await onSave(reason, note.trim()); } catch (e) { setError(e.message || "Couldn't save. Try again."); setSaving(false); }
  };

  return (
    <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: T.surface, border: `1px solid ${T.amber}55` }}>
      <div className="text-xs" style={{ color: T.text }}>
        Why did <span style={{ fontWeight: 600 }}>{company.name}</span> stop? <span style={{ color: T.textFaint }}>This feeds the Why we lose chart on Pipeline.</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {REASONS.map((r) => {
          const on = reason === r.id;
          return (
            <button
              key={r.id} type="button" onClick={() => setReason(r.id)}
              className="text-xs rounded-full px-3 py-1"
              style={{ border: `1px solid ${on ? T.amber : T.border}`, background: on ? `${T.amber}22` : "transparent", color: on ? T.amber : T.textDim }}
            >
              {r.label}{suggestion?.id === r.id && !company.declineReason ? " ✦" : ""}
            </button>
          );
        })}
      </div>
      {suggestion && !company.declineReason && (
        <div className="text-[11px]" style={{ color: T.textFaint }}>✦ Suggested from the communications log, which mentions “{suggestion.phrase}”. Change it if that's wrong.</div>
      )}
      <input
        value={note} onChange={(e) => setNote(e.target.value)} maxLength={200}
        placeholder="One line on what they said (optional), e.g. “wants a cleaner look in the corridor”"
        className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}
      />
      {error && <p className="text-xs" style={{ color: T.red }}>{error}</p>}
      <div className="flex items-center gap-3 text-xs">
        <button onClick={save} disabled={saving} className="px-3 py-1.5 rounded-lg font-medium" style={{ background: T.amber, color: T.bg, opacity: saving ? 0.6 : 1 }}>{saving ? "Saving…" : "Save reason"}</button>
        <button onClick={onClose} style={{ color: T.textFaint }}>{company.declineReason ? "Cancel" : "Skip for now"}</button>
      </div>
    </div>
  );
}

// Pipeline card: how often each reason comes up, filterable by industry, click a reason to
// see the companies and what they said.
export function WhyWeLoseCard({ companies, goToCompany }) {
  const [industry, setIndustry] = useState("");
  const [open, setOpen] = useState(null);
  const industries = useMemo(() => [...new Set(companies.filter((c) => c.stage === "Stay in Contact" && c.industry).map((c) => c.industry))].sort(), [companies]);
  const stats = useMemo(() => declineStats(companies, industry), [companies, industry]);
  const max = Math.max(1, ...stats.byReason.map((r) => r.companies.length));
  const openReason = stats.byReason.find((r) => r.id === open);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <CardTitle icon={HelpCircle}>Why we lose</CardTitle>
        {industries.length > 1 && (
          <select value={industry} onChange={(e) => { setIndustry(e.target.value); setOpen(null); }} className="text-xs rounded-lg px-2 py-1.5 outline-none" style={inputStyle}>
            <option value="">All industries</option>
            {industries.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        )}
      </div>
      {stats.total === 0 ? (
        <p className="text-xs" style={{ color: T.textFaint }}>Nothing in Stay in Contact{industry ? ` for ${industry}` : ""} yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {stats.byReason.map((r) => {
            const n = r.companies.length;
            return (
              <button key={r.id} onClick={() => setOpen(open === r.id ? null : r.id)} className="text-left">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span style={{ color: open === r.id ? T.amber : T.text }}>{r.label}</span>
                  <span style={{ fontFamily: T.fontMono, color: T.textDim }}>{n} <span style={{ color: T.textFaint }}>· {Math.round((n / stats.total) * 100)}%</span></span>
                </div>
                <div className="rounded-full" style={{ height: 6, background: T.surface2 }}>
                  <div className="rounded-full" style={{ height: 6, width: `${(n / max) * 100}%`, background: r.id === "aesthetics" ? T.amber : T.teal }} />
                </div>
              </button>
            );
          })}
          {stats.unlabeled.length > 0 && (
            <div className="text-xs" style={{ color: T.textFaint }}>
              {stats.unlabeled.length} more {stats.unlabeled.length === 1 ? "company has" : "companies have"} no reason yet. Open one and tap “Why did this stop?”.
            </div>
          )}
          {openReason && (
            <div className="flex flex-col pt-2" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
              {openReason.companies.map((c) => (
                <button key={c.id} onClick={() => goToCompany(c.id)} className="text-left text-xs py-1.5" style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                  <span style={{ color: T.text }}>{c.name}</span>
                  <span style={{ color: T.textFaint }}> · {c.industry}{c.city ? ` · ${c.city}` : ""}</span>
                  {c.declineNote && <span className="block" style={{ color: T.textDim }}>“{c.declineNote}”</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export { reasonLabel };
