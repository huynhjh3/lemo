import React, { useMemo, useState } from "react";
import { Zap } from "lucide-react";
import { T } from "../theme.js";
import { Card, CardTitle } from "./ui.jsx";
import { parseQuickLog } from "../lib/quickLog.js";

const TYPE_LABELS = {
  cold_call: "Cold call", follow_up: "Follow up", meeting: "Meeting",
  email: "Email", text_message: "Text message", other: "Other",
};
const TASK_TYPE = { email: "email", meeting: "meeting" };
const inputStyle = { background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody };

const fmtShort = (isoDate) => new Date(isoDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// One line in, a reviewed log entry out: type what happened, the card reads
// it (see lib/quickLog.js), shows what it understood, and Save writes the
// communications-log entry, an optional follow-up task, and — for a Lead
// that responded — the move to Contacted, in one go.
export default function QuickLogCard({ companies, addCommunicationLogEntry, createTask, updateCompany, goToCompany, bare = false }) {
  const [text, setText] = useState("");
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  const sorted = useMemo(() => [...companies].sort((a, b) => a.name.localeCompare(b.name)), [companies]);
  const company = draft && companies.find((c) => c.id === draft.companyId);

  const review = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const p = parseQuickLog(text, companies);
    setDone(null);
    setError(null);
    setDraft({
      candidates: p.candidates,
      companyId: p.company?.id || "",
      contactId: p.contact?.id || null,
      type: p.type,
      followUp: p.followUp || "",
      responded: p.responded,
      moveStage: p.responded && p.company?.stage === "Lead",
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const notes = text.trim();
      const contact = company.contacts.find((c) => c.id === draft.contactId);
      await addCommunicationLogEntry(company.id, {
        occurred_at: new Date().toISOString(),
        contact_id: contact ? contact.id : null,
        contact_name: null,
        type: draft.type,
        notes,
        photo_urls: [],
      });
      const bits = ["Logged"];
      if (draft.followUp) {
        await createTask({ company_id: company.id, title: `Follow up with ${company.name}`, type: TASK_TYPE[draft.type] || "call", due_date: draft.followUp });
        bits.push(`reminder set for ${fmtShort(draft.followUp)}`);
      }
      if (draft.moveStage && company.stage === "Lead") {
        await updateCompany(company.id, { stage: "Contacted" });
        bits.push("moved to Contacted");
      }
      setDone({ id: company.id, name: company.name, summary: bits.join(" · ") });
      setText("");
      setDraft(null);
    } catch (err) {
      setError(err.message || "Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  };

  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const otherCompanies = sorted.filter((c) => !draft?.candidates.some((x) => x.id === c.id));

  const body = (
    <>
      <form onSubmit={review} className="flex items-center gap-2">
        <input
          value={text}
          autoFocus={bare}
          onChange={(e) => setText(e.target.value)}
          placeholder="What happened? e.g. Spoke with Dalton at LV Chamber, interested, follow up next week"
          className="flex-1 min-w-0 text-sm rounded-lg px-3 py-2 outline-none"
          style={inputStyle}
        />
        <button type="submit" disabled={!text.trim()} className="text-sm font-medium rounded-lg px-4 py-2 shrink-0" style={{ background: T.amber, color: T.bg, opacity: text.trim() ? 1 : 0.5 }}>
          Log it
        </button>
      </form>

      {done && (
        <p className="text-xs mt-3" style={{ color: T.textDim }}>
          <span style={{ color: T.teal }}>{done.summary}</span> for {done.name}.{" "}
          <button onClick={() => goToCompany(done.id)} style={{ color: T.amber }}>Open company</button>
        </p>
      )}

      {draft && (
        <div className="mt-3 rounded-lg p-3 flex flex-col gap-2.5" style={{ background: T.surface2, border: `1px solid ${T.amber}55` }}>
          <div className="text-xs" style={{ color: T.amber }}>Here's what I understood — fix anything, then save.</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select value={draft.companyId} onChange={set("companyId")} className="text-sm rounded-lg px-3 py-2 outline-none sm:col-span-2" style={{ ...inputStyle, background: T.surface }}>
              <option value="">Which company?</option>
              {draft.candidates.length > 0 && (
                <optgroup label="Best matches">
                  {draft.candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              )}
              <optgroup label="All companies">
                {otherCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            </select>
            <select value={draft.type} onChange={set("type")} className="text-sm rounded-lg px-3 py-2 outline-none" style={{ ...inputStyle, background: T.surface }}>
              {Object.entries(TYPE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3 flex-wrap text-xs" style={{ color: T.textDim }}>
            <label className="flex items-center gap-2">
              Remind me
              <input type="date" value={draft.followUp} onChange={set("followUp")} className="text-xs rounded-lg px-2 py-1 outline-none" style={{ ...inputStyle, background: T.surface }} />
            </label>
            {draft.followUp && <button onClick={() => setDraft((d) => ({ ...d, followUp: "" }))} style={{ color: T.textFaint }}>no reminder</button>}
            {company?.stage === "Lead" && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={draft.moveStage} onChange={(e) => setDraft((d) => ({ ...d, moveStage: e.target.checked }))} />
                They responded — move Lead to Contacted
              </label>
            )}
          </div>
          {error && <p className="text-xs" style={{ color: T.red }}>{error}</p>}
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={saving || !company} className="text-sm font-medium rounded-lg px-4 py-1.5" style={{ background: T.amber, color: T.bg, opacity: saving || !company ? 0.6 : 1 }}>
              {saving ? "Saving…" : "Save to CRM"}
            </button>
            <button onClick={() => setDraft(null)} className="text-xs" style={{ color: T.textFaint }}>Cancel</button>
          </div>
        </div>
      )}
    </>
  );

  return bare ? body : (
    <Card>
      <CardTitle icon={Zap}>Quick Log</CardTitle>
      {body}
    </Card>
  );
}
