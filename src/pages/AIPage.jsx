import React, { useState } from "react";
import { Copy, Check, Compass, UserPlus, ExternalLink } from "lucide-react";
import { T, INDUSTRY_OPTIONS } from "../theme.js";
import { Card, CardTitle } from "../components/ui.jsx";
import { findProspects } from "../lib/api/prospecting.js";

const inputStyle = { background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody };

function topN(values, n) {
  const counts = new Map();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([v]) => v);
}

// A templated intro, not AI-generated prose — there's no LLM in this flow.
// Anonymized in code, not left to any model: the real comparable
// company's name is never referenced, only its industry/region.
function buildIntroTemplate(candidate, industry, installedCompanies) {
  const comparable = installedCompanies.find((c) => c.industry === industry);
  const caseStudyLine = comparable
    ? ` We recently installed our equipment with another ${comparable.industry.toLowerCase()} business${comparable.region ? ` in ${comparable.region}` : ""}, and they've been a strong, successful account since.`
    : "";
  return `Hi ${candidate.name} team,

My name is [Your Name] with Lemo — we install wellness and relaxation equipment (massage chairs and similar) in commercial spaces like yours.${caseStudyLine}

I'd love to find 15 minutes to see if it'd be a good fit for ${candidate.name} as well. Would you be open to a quick call this week?

Best,
[Your Name]`;
}

export default function AIPage({ companies, createCompany }) {
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [editedText, setEditedText] = useState("");
  const [copied, setCopied] = useState(false);

  // The "installed profile" is computed client-side from data already
  // loaded (stage='Installed' companies), so it's naturally scoped to
  // whatever this user can already see, no new fetch needed.
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

  const copy = async () => {
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
      const list = await findProspects({ industry, location: location.trim() });
      setProspects(list);
    } catch (err) {
      setError(err.message || "Couldn't search — try again.");
    } finally {
      setSearching(false);
    }
  };

  // One click takes a discovered prospect all the way to a real Lead in
  // the pipeline AND a ready-to-edit templated intro — no separate
  // "create company, then go find it, then write a message" round trip.
  // Region is deliberately left unset (same as the New Company form) since
  // assigning it is its own role-gated workflow elsewhere.
  const addAndDraft = async (candidate) => {
    setAddingKey(candidate.name);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      await createCompany({
        name: candidate.name,
        city: candidate.city || null,
        industry,
        stage: "Lead",
        deal_type: "enterprise",
        deal_value: 0,
      });
      const template = buildIntroTemplate(candidate, industry, installedCompanies);
      setResult(template);
      setEditedText(template);
    } catch (err) {
      setError(err.message || "Couldn't add company — try again.");
    } finally {
      setAddingKey(null);
    }
  };

  return (
    <div>
      <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }} className="mb-5">AI Assistant</h1>

      <div className="flex flex-col gap-4">
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

        {error && <p className="text-sm" style={{ color: T.red }}>{error}</p>}

        {result && (
          <Card>
            <CardTitle icon={Compass}>Intro Template</CardTitle>
            <textarea
              value={editedText} onChange={(e) => setEditedText(e.target.value)}
              rows={10} className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-y"
              style={inputStyle}
            />
            <button
              onClick={copy}
              className="flex items-center gap-1.5 text-sm font-medium rounded-lg py-2 px-4 mt-3"
              style={{ background: T.amber, color: T.bg }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
            </button>
            <p className="text-[11px] mt-2" style={{ color: T.textFaint }}>
              Fill in the bracketed placeholders before sending.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
