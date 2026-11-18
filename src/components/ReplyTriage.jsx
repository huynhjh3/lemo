import React, { useEffect, useState } from "react";
import { Sparkles, Copy, Mail, RefreshCw, Check } from "lucide-react";
import { T } from "../theme.js";
import { REASONS } from "../lib/declineReasons.js";

// The shared CRM mailbox. A first email BCCs it, and a reply to a prospect is Reply All, so
// everything lands back on the company's Communications Log (see mail-intake).
export const CRM_MAILBOX = "lemowellness@gmail.com";

export const isReply = (c) => c.type === "email" && /^Reply from /.test(c.notes || "");

export const TRIAGE_LABELS = [
  { id: "interested", label: "Interested", color: T.teal },
  { id: "question", label: "Question", color: T.blue },
  { id: "objection", label: "Objection", color: T.red },
  { id: "not_now", label: "Not now", color: T.amber },
  { id: "referral", label: "Referral", color: T.blue },
  { id: "unsubscribe", label: "Unsubscribe", color: T.red },
  { id: "auto_reply", label: "Auto-reply", color: T.textFaint },
  { id: "other", label: "Other", color: T.textDim },
];
const labelInfo = (id) => TRIAGE_LABELS.find((l) => l.id === id);
const NEEDS_REASON = new Set(["objection", "not_now"]);

const inputStyle = { background: T.surface, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody };

const subjectOf = (notes) => {
  const m = (notes || "").match(/^Reply from .*? — "(.*)"/);
  return m ? m[1] : "";
};

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { /* ignore */ }
    document.body.removeChild(ta);
    return ok;
  }
}

// Sits under a prospect's reply on the company's Communications Log: the AI's label (one click
// to confirm or change), what they said in a line, and a draft reply to copy into Gmail so
// the rep's own signature goes out with it. The CRM never sends anything itself.
export default function ReplyTriage({ entry, company, isLatest, readOnly, userId, onUpdate, onTriage }) {
  const labeled = !!entry.triageLabel;
  const info = labelInfo(entry.triageLabel);
  const saved = entry.draftEdited || entry.draftBody || "";
  const [draft, setDraft] = useState(saved);
  const [open, setOpen] = useState(isLatest);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { setDraft(saved); }, [saved]);

  const contact = company.contacts.find((c) => c.id === entry.contactId);
  const firstName = (entry.contactName || contact?.name || "").split(/\s+/)[0];

  const run = async (fn) => {
    setBusy(true); setError(null); setMsg(null);
    try { await fn(); } catch (e) { setError(e.message || "That didn't work. Try again."); } finally { setBusy(false); }
  };

  const write = () => run(async () => { await onTriage(entry.id); });

  const confirm = () => run(() => onUpdate(entry.id, { triage_confirmed_at: new Date().toISOString(), triage_confirmed_by: userId }));

  // Changing the label is a person deciding, so it counts as confirmed; the draft is rewritten to fit it.
  const change = (label, reason) => run(async () => {
    let rewritten = true;
    try {
      await onTriage(entry.id, label, NEEDS_REASON.has(label) ? reason || null : null);
    } catch (e) {
      rewritten = false;
      await onUpdate(entry.id, { triage_label: label, triage_reason: NEEDS_REASON.has(label) ? reason || null : null });
      setMsg(`Label saved. The draft wasn't rewritten: ${e.message}`);
    }
    await onUpdate(entry.id, { triage_confirmed_at: new Date().toISOString(), triage_confirmed_by: userId });
    if (rewritten) setMsg("Draft rewritten for that label.");
  });

  // A fresh draft for the label as it stands. Doesn't confirm anything.
  const rewrite = () => run(async () => {
    await onTriage(entry.id, entry.triageLabel, NEEDS_REASON.has(entry.triageLabel) ? entry.triageReason || null : null);
    setMsg("Draft rewritten.");
  });

  const copy = () => run(async () => {
    const ok = await copyText(draft);
    if (!ok) throw new Error("Couldn't copy. Select the text and copy it.");
    // Keep what the rep actually used, so later drafts can learn their wording.
    if (draft.trim() && draft !== entry.draftBody && draft !== entry.draftEdited) await onUpdate(entry.id, { draft_edited: draft });
    setMsg("Copied. In Gmail, open the thread, Reply All, and paste.");
  });

  const gmail = () => {
    const subj = subjectOf(entry.notes);
    const q = new URLSearchParams({
      view: "cm", fs: "1", to: contact?.email || "", bcc: CRM_MAILBOX,
      su: /^re:/i.test(subj) ? subj : `Re: ${subj}`, body: draft,
    });
    window.open(`https://mail.google.com/mail/?${q.toString()}`, "_blank", "noopener");
  };

  if (!labeled) {
    if (!isLatest || readOnly) return null;
    return (
      <div className="mt-2">
        <button onClick={write} disabled={busy} className="text-xs flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ color: T.amber, border: `1px solid ${T.amber}55`, opacity: busy ? 0.6 : 1 }}>
          <Sparkles size={12} /> {busy ? "Reading the reply…" : "Label this reply and write a draft"}
        </button>
        {error && <p className="text-xs mt-1.5" style={{ color: T.red }}>{error}</p>}
      </div>
    );
  }

  const confirmed = !!entry.triageConfirmedAt;
  return (
    <div className="mt-2 rounded-lg p-2.5 flex flex-col gap-2" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ color: info?.color, border: `1px solid ${info?.color}66`, background: `${info?.color}14` }}>
          {info?.label || entry.triageLabel}
        </span>
        {entry.triageReason && <span className="text-[11px]" style={{ color: T.textDim }}>{REASONS.find((r) => r.id === entry.triageReason)?.label}</span>}
        {confirmed ? (
          <span className="text-[11px] flex items-center gap-1" style={{ color: T.teal }}><Check size={11} /> confirmed</span>
        ) : (
          <span className="text-[11px]" style={{ color: T.textFaint }}>AI's guess</span>
        )}
        {!readOnly && !confirmed && (
          <button onClick={confirm} disabled={busy} className="text-[11px] rounded-full px-2.5 py-0.5" style={{ color: T.teal, border: `1px solid ${T.teal}66` }}>Looks right</button>
        )}
      </div>
      {entry.triageSummary && <p className="text-xs" style={{ color: T.textDim }}>“{entry.triageSummary}”</p>}

      {!readOnly && (
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={entry.triageLabel} disabled={busy}
            onChange={(e) => change(e.target.value, entry.triageReason)}
            className="text-xs rounded-lg px-2 py-1 outline-none" style={inputStyle}
            title="Change the label (the draft is rewritten to fit)"
          >
            {TRIAGE_LABELS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          {NEEDS_REASON.has(entry.triageLabel) && (
            <select
              value={entry.triageReason || ""} disabled={busy}
              onChange={(e) => change(entry.triageLabel, e.target.value)}
              className="text-xs rounded-lg px-2 py-1 outline-none" style={inputStyle}
            >
              <option value="">Reason…</option>
              {REASONS.filter((r) => r.id !== "no_response").map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          )}
        </div>
      )}

      {saved ? (
        <>
          <button onClick={() => setOpen((o) => !o)} className="text-xs text-left" style={{ color: T.amber }}>
            {open ? "Hide the draft reply" : `Show the draft reply${firstName ? ` to ${firstName}` : ""}`}
          </button>
          {open && (
            <>
              <textarea
                value={draft} onChange={(e) => setDraft(e.target.value)} readOnly={readOnly} rows={Math.min(12, Math.max(5, draft.split("\n").length + 2))}
                className="text-sm rounded-lg px-3 py-2 outline-none resize-y" style={inputStyle}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={copy} disabled={busy} className="text-xs font-medium rounded-lg px-3 py-1.5 flex items-center gap-1.5" style={{ background: T.amber, color: T.bg }}>
                  <Copy size={12} /> Copy draft
                </button>
                <button onClick={gmail} className="text-xs rounded-lg px-3 py-1.5 flex items-center gap-1.5" style={{ color: T.textDim, border: `1px solid ${T.border}` }} title="Opens a new Gmail message with the BCC already filled in">
                  <Mail size={12} /> Open in Gmail
                </button>
                {!readOnly && (
                  <button onClick={rewrite} disabled={busy} className="text-xs flex items-center gap-1" style={{ color: T.textFaint }} title="Write a fresh draft">
                    <RefreshCw size={11} /> {busy ? "Writing…" : "Rewrite"}
                  </button>
                )}
              </div>
            </>
          )}
        </>
      ) : (
        <p className="text-[11px]" style={{ color: T.textFaint }}>
          {entry.triageLabel === "unsubscribe" ? "They asked not to be contacted. No draft written." : entry.triageLabel === "auto_reply" ? "Automatic reply. No draft needed." : "No draft yet."}
        </p>
      )}
      {msg && <p className="text-[11px]" style={{ color: T.textFaint }}>{msg}</p>}
      {error && <p className="text-xs" style={{ color: T.red }}>{error}</p>}
    </div>
  );
}
