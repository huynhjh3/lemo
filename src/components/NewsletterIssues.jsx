import React, { useCallback, useEffect, useState } from "react";
import { T } from "../theme.js";
import * as nl from "../lib/api/newsletter.js";

const inputStyle = { background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody };
const when = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// What a brand-new issue starts with — sample wording to overwrite each month.
const blankStory = () => ({ tag: "", title: "", body: "", link_label: "", link_url: "", image_url: "" });
const blankPulse = () => ({ title: "", body: "", link_url: "" });
const NEW_ISSUE = {
  subject: "The Recharge Report",
  content: {
    preheader: "New chairs, new partners, and what we’re reading in wellness.",
    issue_label: "Issue 01 · November 2026",
    hero_image_url: "",
    intro: "Write a few lines about the month: what happened, what you're proud of, and what's coming.",
    stats_title: "October by the numbers",
    stats: [{ value: "", label: "new chairs installed" }, { value: "", label: "new partner locations" }, { value: "", label: "free 10-minute massages redeemed" }],
    stories_title: "What we’ve been up to",
    stories: [{ ...blankStory(), tag: "New install", title: "Now open: [Partner Location]" }, { ...blankStory(), tag: "Event recap", title: "[Event] at [Venue]" }],
    pulse_title: "The wellness industry pulse",
    pulse: [blankPulse(), blankPulse(), blankPulse()],
    show_free_block: true,
    closing: "Know a space that needs a chair? Reply to this email with a name and we’ll take it from there.",
  },
};

function Label({ text, children }) {
  return <label className="flex flex-col gap-1 text-[11px]" style={{ color: T.textFaint }}>{text}{children}</label>;
}
function Box({ title, children }) {
  return (
    <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: T.surface2, border: `1px solid ${T.borderSoft}` }}>
      <div className="text-[11px] uppercase tracking-wide" style={{ color: T.textFaint }}>{title}</div>
      {children}
    </div>
  );
}

function ImageField({ url, onChange, setError }) {
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setBusy(true); setError(null);
    try { onChange(await nl.uploadNewsletterImage(file)); } catch (err) { setError(err.message || "Couldn't upload that picture."); } finally { setBusy(false); }
  };
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {url && <img src={url} alt="" style={{ width: 64, height: 44, objectFit: "cover", borderRadius: 6, border: `1px solid ${T.border}` }} />}
      <label className="text-xs px-3 py-1.5 rounded-lg cursor-pointer" style={{ border: `1px solid ${T.border}`, color: T.textDim }}>
        {busy ? "Uploading…" : url ? "Replace picture" : "Add a picture"}
        <input type="file" accept="image/*" onChange={pick} disabled={busy} style={{ display: "none" }} />
      </label>
      {url && <button type="button" onClick={() => onChange("")} className="text-xs" style={{ color: T.textFaint }}>Remove</button>}
    </div>
  );
}

function Editor({ draft, setDraft, subscribers, onSaved, onClose }) {
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(null);
  const [previewHtml, setPreviewHtml] = useState(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const c = draft.content;
  const setC = (patch) => setDraft((d) => ({ ...d, content: { ...d.content, ...patch } }));
  const setItem = (key, i, patch) => setC({ [key]: c[key].map((x, n) => (n === i ? { ...x, ...patch } : x)) });
  const input = (value, onChange, placeholder) => (
    <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
  );
  const area = (value, onChange, rows = 3) => (
    <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} rows={rows} className="text-sm rounded-lg px-3 py-2 outline-none" style={{ ...inputStyle, resize: "vertical" }} />
  );

  const run = async (label, fn) => {
    setBusy(label); setError(null); setMsg(null);
    try { await fn(); } catch (e) { setError(e.message || "Something went wrong."); } finally { setBusy(null); }
  };
  const save = () => run("Saving…", async () => {
    if (!draft.subject.trim()) throw new Error("Add a subject line first.");
    const id = await nl.saveIssue({ id: draft.id, subject: draft.subject.trim(), content: draft.content });
    setDraft((d) => ({ ...d, id })); setMsg("Draft saved."); onSaved();
    return id;
  });
  const preview = () => run("Building preview…", async () => setPreviewHtml(await nl.previewIssue(c)));
  const test = () => run("Sending test…", async () => {
    if (!draft.subject.trim()) throw new Error("Add a subject line first.");
    const r = await nl.sendTest({ subject: draft.subject.trim(), content: c });
    setMsg(`Test sent to ${r.sent_to}. Check your inbox.`);
  });
  const send = () => run("Sending…", async () => {
    if (!draft.subject.trim()) throw new Error("Add a subject line first.");
    // Always send what's saved, so what you previewed is exactly what goes out.
    const id = await nl.saveIssue({ id: draft.id, subject: draft.subject.trim(), content: c });
    const r = await nl.sendIssue(id);
    setConfirmSend(false);
    setMsg(`Sent to ${r.sent} subscriber${r.sent === 1 ? "" : "s"}.${r.warning ? ` ${r.warning}` : ""}`);
    onSaved(); onClose();
  });

  return (
    <div className="flex flex-col gap-3">
      <Box title="Subject and header">
        <Label text="Subject line">{input(draft.subject, (v) => setDraft((d) => ({ ...d, subject: v })), "The Recharge Report")}</Label>
        <Label text="Preview text (the gray line after the subject in the inbox)">{input(c.preheader, (v) => setC({ preheader: v }))}</Label>
        <Label text="Issue label">{input(c.issue_label, (v) => setC({ issue_label: v }), "Issue 01 · November 2026")}</Label>
        <Label text="Main picture"><ImageField url={c.hero_image_url} onChange={(u) => setC({ hero_image_url: u })} setError={setError} /></Label>
      </Box>

      <Box title="Note from you">
        <Label text="Intro (a blank line starts a new paragraph)">{area(c.intro, (v) => setC({ intro: v }), 5)}</Label>
      </Box>

      <Box title="By the numbers (leave a value empty to hide it)">
        <Label text="Heading">{input(c.stats_title, (v) => setC({ stats_title: v }))}</Label>
        {c.stats.map((s, i) => (
          <div key={i} className="grid gap-2" style={{ gridTemplateColumns: "90px 1fr" }}>
            {input(s.value, (v) => setItem("stats", i, { value: v }), "12")}
            {input(s.label, (v) => setItem("stats", i, { label: v }), "new chairs installed")}
          </div>
        ))}
      </Box>

      <Box title="What we’ve been up to (installs, events, partners)">
        <Label text="Heading">{input(c.stories_title, (v) => setC({ stories_title: v }))}</Label>
        {c.stories.map((s, i) => (
          <div key={i} className="rounded-lg p-3 flex flex-col gap-2" style={{ border: `1px solid ${T.borderSoft}` }}>
            <div className="grid gap-2" style={{ gridTemplateColumns: "140px 1fr" }}>
              {input(s.tag, (v) => setItem("stories", i, { tag: v }), "New install")}
              {input(s.title, (v) => setItem("stories", i, { title: v }), "Headline")}
            </div>
            {area(s.body, (v) => setItem("stories", i, { body: v }), 3)}
            <div className="grid gap-2" style={{ gridTemplateColumns: "140px 1fr" }}>
              {input(s.link_label, (v) => setItem("stories", i, { link_label: v }), "See the location")}
              {input(s.link_url, (v) => setItem("stories", i, { link_url: v }), "https://… (optional link)")}
            </div>
            <ImageField url={s.image_url} onChange={(u) => setItem("stories", i, { image_url: u })} setError={setError} />
          </div>
        ))}
        <div className="flex gap-3">
          {c.stories.length < 3 && <button type="button" onClick={() => setC({ stories: [...c.stories, blankStory()] })} className="text-xs" style={{ color: T.amber }}>+ Add a story</button>}
          {c.stories.length > 0 && <button type="button" onClick={() => setC({ stories: c.stories.slice(0, -1) })} className="text-xs" style={{ color: T.textFaint }}>Remove last</button>}
        </div>
      </Box>

      <Box title="The wellness industry pulse">
        <Label text="Heading">{input(c.pulse_title, (v) => setC({ pulse_title: v }))}</Label>
        {c.pulse.map((p, i) => (
          <div key={i} className="flex flex-col gap-2">
            {input(p.title, (v) => setItem("pulse", i, { title: v }), `Item ${i + 1} headline`)}
            {area(p.body, (v) => setItem("pulse", i, { body: v }), 2)}
            {input(p.link_url, (v) => setItem("pulse", i, { link_url: v }), "https://… link to the source (optional)")}
          </div>
        ))}
      </Box>

      <Box title="Closing">
        <label className="flex items-center gap-2 text-xs" style={{ color: T.textDim }}>
          <input type="checkbox" checked={c.show_free_block !== false} onChange={(e) => setC({ show_free_block: e.target.checked })} />
          Show the “Your free 10-minute massage is waiting” box
        </label>
        <Label text="Closing line">{area(c.closing, (v) => setC({ closing: v }), 2)}</Label>
      </Box>

      {error && <p className="text-sm" style={{ color: T.red }}>{error}</p>}
      {msg && <p className="text-sm" style={{ color: T.teal }}>{msg}</p>}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={save} disabled={!!busy} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: T.amber, color: T.bg, opacity: busy ? 0.5 : 1 }}>{busy === "Saving…" ? busy : "Save draft"}</button>
        <button onClick={preview} disabled={!!busy} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${T.border}`, color: T.textDim }}>{busy === "Building preview…" ? busy : "Preview"}</button>
        <button onClick={test} disabled={!!busy} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${T.border}`, color: T.textDim }}>{busy === "Sending test…" ? busy : "Send a test to me"}</button>
        <span className="flex-1" />
        {!confirmSend ? (
          <button onClick={() => setConfirmSend(true)} disabled={!!busy || subscribers === 0} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ border: `1px solid ${T.amber}`, color: T.amber, opacity: subscribers === 0 ? 0.5 : 1 }}>
            {subscribers === 0 ? "No subscribers yet" : `Send to ${subscribers} subscriber${subscribers === 1 ? "" : "s"}…`}
          </button>
        ) : (
          <span className="flex items-center gap-2 text-xs" style={{ color: T.text }}>
            Send to {subscribers} people now? This can’t be undone.
            <button onClick={send} disabled={!!busy} className="px-3 py-1.5 rounded-lg font-medium" style={{ background: T.red, color: "#fff" }}>{busy === "Sending…" ? busy : "Yes, send"}</button>
            <button onClick={() => setConfirmSend(false)} style={{ color: T.textFaint }}>Cancel</button>
          </span>
        )}
        <button onClick={onClose} className="text-xs" style={{ color: T.textFaint }}>Close</button>
      </div>

      {previewHtml && (
        <div className="flex flex-col gap-2">
          <div className="text-[11px] uppercase tracking-wide" style={{ color: T.textFaint }}>Preview (sample name “Alex”)</div>
          <iframe title="Newsletter preview" srcDoc={previewHtml} sandbox="" style={{ width: "100%", height: 760, border: `1px solid ${T.border}`, borderRadius: 10, background: "#fff" }} />
        </div>
      )}
    </div>
  );
}

export default function NewsletterIssues({ subscribers }) {
  const [issues, setIssues] = useState([]);
  const [draft, setDraft] = useState(null); // the issue being edited, or null
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try { setIssues(await nl.fetchIssues()); setError(null); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = async (issue) => {
    try { const full = await nl.fetchIssue(issue.id); setDraft({ id: full.id, subject: full.subject, content: { ...NEW_ISSUE.content, ...full.content } }); }
    catch (e) { setError(e.message); }
  };
  // An issue handed over as a .zip (issue.json + images) becomes a draft, opened for review.
  const [importing, setImporting] = useState(false);
  const importFile = async (e) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setImporting(true); setError(null);
    try {
      const { subject, content } = await nl.readIssueBundle(file);
      const id = await nl.saveIssue({ subject, content: { ...NEW_ISSUE.content, ...content } });
      await load();
      setDraft({ id, subject, content: { ...NEW_ISSUE.content, ...content } });
    } catch (err) { setError(err.message || "Couldn't import that file."); } finally { setImporting(false); }
  };
  const remove = async (issue) => {
    try { await nl.deleteIssue(issue.id); await load(); } catch (e) { setError(e.message); }
  };

  if (draft) return <Editor draft={draft} setDraft={setDraft} subscribers={subscribers} onSaved={load} onClose={() => { setDraft(null); load(); }} />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs" style={{ color: T.textFaint }}>Import the issue file you were given (or start from scratch), preview it, send yourself a test, then send it to everyone who’s signed up and hasn’t unsubscribed.</p>
        <div className="flex items-center gap-2">
          <label className="text-xs px-3 py-1.5 rounded-lg font-medium cursor-pointer" style={{ background: T.amber, color: T.bg, opacity: importing ? 0.5 : 1 }}>
            {importing ? "Importing…" : "Import issue file"}
            <input type="file" accept=".zip,application/zip" onChange={importFile} disabled={importing} style={{ display: "none" }} />
          </label>
          <button onClick={() => setDraft(JSON.parse(JSON.stringify(NEW_ISSUE)))} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${T.border}`, color: T.textDim }}>Start from scratch</button>
        </div>
      </div>
      {error && <p className="text-sm" style={{ color: T.red }}>{error}</p>}
      {issues.length === 0 && <p className="text-xs" style={{ color: T.textFaint }}>No issues yet.</p>}
      {issues.map((i) => (
        <div key={i.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5" style={{ background: T.surface2, border: `1px solid ${T.borderSoft}` }}>
          <div className="min-w-0">
            <div className="text-sm truncate" style={{ color: T.text }}>{i.subject}</div>
            <div className="text-[11px]" style={{ color: T.textFaint }}>
              {i.status === "sent" ? `Sent ${when(i.sent_at)} to ${i.recipients_count ?? "?"} people` : i.status === "sending" ? "Sending…" : `Draft · edited ${when(i.updated_at)}`}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {i.status === "draft" && <button onClick={() => open(i)} className="text-xs" style={{ color: T.amber }}>Edit</button>}
            {i.status === "draft" && <button onClick={() => remove(i)} className="text-xs" style={{ color: T.red }}>Delete</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
