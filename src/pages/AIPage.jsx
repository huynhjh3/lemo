import React, { useEffect, useState } from "react";
import { Sparkles, Copy, Check, ClipboardCheck } from "lucide-react";
import { T } from "../theme.js";
import { Card, CardTitle } from "../components/ui.jsx";
import { generateAiContent, saveAiGenerationEdit } from "../lib/api/aiGenerations.js";

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

export default function AIPage({ companies, initialCompanyId }) {
  const [companyId, setCompanyId] = useState(initialCompanyId || "");
  const [type, setType] = useState("briefing");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [editedText, setEditedText] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // A click-through from Company Profile pre-fills the company — but only
  // once, so picking a different company afterward on this same page visit
  // doesn't get silently overridden if this prop is ever re-passed.
  useEffect(() => {
    if (initialCompanyId) setCompanyId(initialCompanyId);
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

  return (
    <div>
      <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }} className="mb-5">AI Assistant</h1>

      <div className="flex flex-col gap-4">
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
            {error && <p className="text-xs" style={{ color: T.red }}>{error}</p>}
            <button
              onClick={generate} disabled={!companyId || generating}
              className="text-sm font-medium rounded-lg py-2.5 self-start px-5"
              style={{ background: T.amber, color: T.bg, opacity: !companyId || generating ? 0.6 : 1 }}
            >
              {generating ? "Generating…" : "Generate"}
            </button>
          </div>
        </Card>

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
