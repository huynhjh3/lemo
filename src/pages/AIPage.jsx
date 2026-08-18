import React, { useEffect, useState } from "react";
import { Sparkles, Copy, Check, ClipboardCheck, Compass, UserPlus, ExternalLink } from "lucide-react";
import { T, INDUSTRY_OPTIONS } from "../theme.js";
import { Card, CardTitle } from "../components/ui.jsx";
import { generateAiContent, saveAiGenerationEdit } from "../lib/api/aiGenerations.js";
import { findProspects } from "../lib/api/prospecting.js";

const inputStyle = { background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody };

const TYPES = [
  ["briefing", "Account Briefing"],
  ["cold_call", "Cold Call"],
  ["follow_up", "Follow Up"],
  ["meeting", "Meeting"],
  ["email", "Email"],
  ["text_message", "Text Message"],
  ["other", "Other"],
];

function topN(values, n) {
  const counts = new Map();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([v]) => v);
}

export default function AIPage({ companies, createCompany, initialCompanyId }) {
  const [mode, setMode] = useState("draft");

  // Draft mode
  const [companyId, setCompanyId] = useState(initialCompanyId || "");
  const [type, setType] = useState("briefing");
  const [generating, setGenerating] = useState(false);

  // Shared result — both Draft and Prospect modes populate this the same
  // way (an ai_generations row), so the Result card below is mode-agnostic.
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [editedText, setEditedText] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Prospect mode — the "installed profile" is computed client-side from
  // data already loaded (stage='Installed' companies), so it's naturally
  // scoped to whatever this user can already see, no new fetch needed.
  const installedCompanies = companies.filter((c) => c.stage === "Installed");
  const installedProfile = {
    industries: topN(installedCompanies.map((c) => c.industry), 3),
    regions: topN(installedCompanies.map((c) => c.region), 3),
  };
  const [industry, setIndustry] = useState(() => installedProfile.industries[0] || "");
  const [location, setLocation] = useState("");
  const [searching, setSearching] = useState(false);
  const [prospects, setProspects] = useState([]);
  const [addingKey, setAddingKey] = useState(null);

  // A click-through from Company Profile pre-fills the company — but only
  // once, so picking a different company afterward on this same page visit
  // doesn't get silently overridden if this prop is ever re-passed.
  useEffect(() => {
    if (initialCompanyId) { setCompanyId(initialCompanyId); setMode("draft"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCompanyId]);

  const generate = async () => {
    if (!companyId) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      const row = await generateAiContent({ company_id: companyId, type });
      setResult(row);
      setEditedText(row.generated_text);
    } catch (err) {
      setError(err.message || "Couldn't generate — try again.");
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (!result) return;
    setSaving(true);
    setError(null);
    try {
      await saveAiGenerationEdit(result.id, editedText);
      setResult((r) => ({ ...r, edited_text: editedText }));
    } catch (err) {
      setError(err.message || "Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    await save();
    await navigator.clipboard.writeText(editedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const search = async () => {
    if (!industry || !location.trim()) return;
    setSearching(true);
    setError(null);
    setProspects([]);
    try {
      const list = await findProspects({ industry, location: location.trim(), installedProfile });
      setProspects(list);
    } catch (err) {
      setError(err.message || "Couldn't search — try again.");
    } finally {
      setSearching(false);
    }
  };

  // One click takes a discovered prospect all the way to a real Lead in
  // the pipeline AND a ready-to-edit intro email — no separate "create
  // company, then go find it, then draft a message" round trip. Region is
  // deliberately left unset (same as the New Company form) since assigning
  // it is its own role-gated workflow elsewhere.
  const addAndDraft = async (candidate) => {
    setAddingKey(candidate.name);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      const newCompany = await createCompany({
        name: candidate.name,
        city: candidate.city || null,
        industry,
        stage: "Lead",
        deal_type: "enterprise",
        deal_value: 0,
      });
      const row = await generateAiContent({ company_id: newCompany.id, type: "cold_call" });
      setResult(row);
      setEditedText(row.generated_text);
    } catch (err) {
      setError(err.message || "Couldn't add and draft — try again.");
    } finally {
      setAddingKey(null);
    }
  };

  return (
    <div>
      <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }} className="mb-5">AI Assistant</h1>

      <div className="flex flex-col gap-4">
        <div className="flex rounded-lg p-0.5 w-fit" style={{ background: T.surface2, border: `1px solid ${T.border}` }}>
          {[["draft", "Draft a Message", Sparkles], ["prospect", "Find Prospects", Compass]].map(([id, label, Icon]) => (
            <button
              key={id} type="button" onClick={() => { setMode(id); setError(null); }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md"
              style={{
                background: mode === id ? T.surface : "transparent",
                color: mode === id ? T.amber : T.textDim,
                fontFamily: T.fontBody, fontWeight: mode === id ? 600 : 500,
              }}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>

        {mode === "draft" && (
          <Card>
            <CardTitle icon={Sparkles}>Generate</CardTitle>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
                  <option value="">Select a company</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={type} onChange={(e) => setType(e.target.value)} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
                  {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <button
                onClick={generate} disabled={!companyId || generating}
                className="text-sm font-medium rounded-lg py-2.5 self-start px-5"
                style={{ background: T.amber, color: T.bg, opacity: !companyId || generating ? 0.6 : 1 }}
              >
                {generating ? "Generating…" : "Generate"}
              </button>
            </div>
          </Card>
        )}

        {mode === "prospect" && (
          <Card>
            <CardTitle icon={Compass}>Find Prospects</CardTitle>
            <p className="text-xs mb-3" style={{ color: T.textFaint }}>
              {installedProfile.industries.length
                ? `Your installed customers are mostly ${installedProfile.industries.join(", ")}${installedProfile.regions.length ? `, concentrated in ${installedProfile.regions.join(", ")}` : ""}.`
                : "No installed companies yet to build a profile from — pick any industry and location to search anyway."}
            </p>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
                  <option value="">Select industry</option>
                  {INDUSTRY_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
                <input
                  value={location} onChange={(e) => setLocation(e.target.value)}
                  placeholder="City or region, e.g. Dallas, TX"
                  className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}
                />
              </div>
              <button
                onClick={search} disabled={!industry || !location.trim() || searching}
                className="text-sm font-medium rounded-lg py-2.5 self-start px-5"
                style={{ background: T.amber, color: T.bg, opacity: !industry || !location.trim() || searching ? 0.6 : 1 }}
              >
                {searching ? "Searching…" : "Search for Prospects"}
              </button>
            </div>

            {prospects.length > 0 && (
              <div className="flex flex-col gap-2 mt-4">
                {prospects.map((p) => (
                  <div key={p.name} className="rounded-lg p-3" style={{ background: T.surface2, border: `1px solid ${T.border}` }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium" style={{ color: T.text }}>{p.name}</div>
                        <div className="text-xs" style={{ color: T.textFaint }}>{p.city}</div>
                      </div>
                      {p.website && (
                        <a href={p.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] shrink-0" style={{ color: T.teal }}>
                          <ExternalLink size={11} /> Site
                        </a>
                      )}
                    </div>
                    <p className="text-xs mt-1.5" style={{ color: T.textDim }}>{p.rationale}</p>
                    <button
                      onClick={() => addAndDraft(p)} disabled={addingKey === p.name}
                      className="flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5 mt-2"
                      style={{ background: T.amber, color: T.bg, opacity: addingKey === p.name ? 0.6 : 1 }}
                    >
                      <UserPlus size={12} /> {addingKey === p.name ? "Adding…" : "Add as Lead & Draft Intro"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {error && <p className="text-sm" style={{ color: T.red }}>{error}</p>}

        {result && (
          <Card>
            <CardTitle icon={Sparkles}>Result</CardTitle>
            <textarea
              value={editedText} onChange={(e) => setEditedText(e.target.value)}
              rows={10} className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-y"
              style={inputStyle}
            />
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={copy} disabled={saving}
                className="flex items-center gap-1.5 text-sm font-medium rounded-lg py-2 px-4"
                style={{ background: T.amber, color: T.bg, opacity: saving ? 0.7 : 1 }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={save} disabled={saving}
                className="flex items-center gap-1.5 text-sm rounded-lg py-2 px-4"
                style={{ border: `1px solid ${T.border}`, color: T.textDim, opacity: saving ? 0.7 : 1 }}
              >
                <ClipboardCheck size={14} /> {saving ? "Saving…" : "Save edits"}
              </button>
            </div>
            <p className="text-[11px] mt-2" style={{ color: T.textFaint }}>
              Copying or saving your edits helps the assistant learn your writing style for next time.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
