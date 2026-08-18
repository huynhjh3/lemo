import React, { useState } from "react";
import { Copy, Check, Compass, UserPlus, ExternalLink, Settings2, ClipboardCheck } from "lucide-react";
import { T, INDUSTRY_OPTIONS } from "../theme.js";
import { Card, CardTitle } from "../components/ui.jsx";
import { findProspects } from "../lib/api/prospecting.js";
import { updateMyIntroTemplate } from "../lib/api/profiles.js";
import { useAuth } from "../context/AuthContext.jsx";

const inputStyle = { background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody };

// {{business_name}} and {{case_study}} are the only placeholders — kept
// deliberately small so anyone customizing their own template doesn't need
// to learn a templating language.
const DEFAULT_TEMPLATE = `Hi {{business_name}} team,

My name is [Your Name] with Lemo Inc. — we provide corporate wellness resources at no upfront cost in commercial spaces like yours.{{case_study}}

I'd love to find 15 minutes to see if it'd be a good fit for {{business_name}} as well. Would you be open to a quick call this week?

Best,
[Your Name]`;

function topN(values, n) {
  const counts = new Map();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([v]) => v);
}

// A templated intro, not AI-generated prose — there's no LLM in this flow.
// Anonymized in code, not left to any model: the real comparable company's
// name is never referenced, only its industry/region. Uses each person's
// own saved template (profiles.intro_template, migration 040) if they've
// customized one, falling back to DEFAULT_TEMPLATE otherwise.
function buildIntroTemplate(candidate, industry, installedCompanies, myTemplate) {
  const comparable = installedCompanies.find((c) => c.industry === industry);
  const caseStudy = comparable
    ? ` We recently installed our equipment with another ${comparable.industry.toLowerCase()} business${comparable.region ? ` in ${comparable.region}` : ""}, and they've been a strong, successful account since.`
    : "";
  return (myTemplate || DEFAULT_TEMPLATE)
    .replaceAll("{{business_name}}", candidate.name)
    .replaceAll("{{case_study}}", caseStudy);
}

export default function AIPage({ companies, createCompany }) {
  const { profile } = useAuth();
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [editedText, setEditedText] = useState("");
  const [copied, setCopied] = useState(false);

  // Anyone can customize their own intro template — persisted per-user via
  // profiles.intro_template (migration 040; no new RLS needed, users can
  // already update their own profile row). Edits here take effect
  // immediately for this session regardless of Save; Save just persists it
  // for next time.
  const [myTemplate, setMyTemplate] = useState(() => profile?.intro_template || DEFAULT_TEMPLATE);
  const [editingTemplate, setEditingTemplate] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);

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

  const saveTemplate = async () => {
    setSavingTemplate(true);
    setError(null);
    try {
      await updateMyIntroTemplate(profile.id, myTemplate);
      setTemplateSaved(true);
      setTimeout(() => setTemplateSaved(false), 2000);
    } catch (err) {
      setError(err.message || "Couldn't save your template — try again.");
    } finally {
      setSavingTemplate(false);
    }
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
  const addAndDraft = async (candidate, key) => {
    setAddingKey(key);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      try {
        await createCompany({
          name: candidate.name,
          city: candidate.city || null,
          industry,
          stage: "Lead",
          deal_type: "enterprise",
          deal_value: 0,
        });
      } catch (err) {
        // createCompany also triggers a full app-wide refetch afterward
        // (see withRefresh in useCrmData.js) — a hiccup in that unrelated
        // refetch surfaces here even when the actual insert went through,
        // which would otherwise silently swallow the template below too.
        // Report it, but don't let it block the template — the template
        // never depended on this succeeding in the first place.
        setError(err.message || "Couldn't confirm the company was added — check the Companies tab.");
      }
      const template = buildIntroTemplate(candidate, industry, installedCompanies, myTemplate);
      setResult(template);
      setEditedText(template);
    } finally {
      setAddingKey(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }}>AI Assistant</h1>
        <button
          onClick={() => setEditingTemplate((v) => !v)}
          className="flex items-center gap-1.5 text-xs" style={{ color: T.teal }}
        >
          <Settings2 size={13} /> {editingTemplate ? "Hide template editor" : "Customize your intro template"}
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {editingTemplate && (
          <Card>
            <CardTitle icon={Settings2}>Your Intro Template</CardTitle>
            <p className="text-xs mb-3" style={{ color: T.textFaint }}>
              This is your own version, used whenever you draft an intro — everyone can set their own. Use <code>{"{{business_name}}"}</code> for the prospect's name and <code>{"{{case_study}}"}</code> for the anonymized case-study line (blank if none applies).
            </p>
            <textarea
              value={myTemplate} onChange={(e) => setMyTemplate(e.target.value)}
              rows={10} className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-y"
              style={inputStyle}
            />
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={saveTemplate} disabled={savingTemplate}
                className="flex items-center gap-1.5 text-sm font-medium rounded-lg py-2 px-4"
                style={{ background: T.amber, color: T.bg, opacity: savingTemplate ? 0.7 : 1 }}
              >
                <ClipboardCheck size={14} /> {savingTemplate ? "Saving…" : templateSaved ? "Saved" : "Save template"}
              </button>
              <button
                onClick={() => setMyTemplate(DEFAULT_TEMPLATE)}
                className="text-sm rounded-lg py-2 px-4"
                style={{ border: `1px solid ${T.border}`, color: T.textDim }}
              >
                Reset to default
              </button>
            </div>
          </Card>
        )}

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
              {prospects.map((p, i) => {
                const key = `${p.name}-${p.city}-${i}`;
                return (
                <div key={key} className="rounded-lg p-3" style={{ background: T.surface2, border: `1px solid ${T.border}` }}>
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
                    onClick={() => addAndDraft(p, key)} disabled={addingKey === key}
                    className="flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5 mt-2"
                    style={{ background: T.amber, color: T.bg, opacity: addingKey === key ? 0.6 : 1 }}
                  >
                    <UserPlus size={12} /> {addingKey === key ? "Adding…" : "Add as Lead & Draft Intro"}
                  </button>
                </div>
                );
              })}
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
