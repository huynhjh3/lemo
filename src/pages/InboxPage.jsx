import React, { useCallback, useEffect, useMemo, useState } from "react";
import { T, INDUSTRY_OPTIONS } from "../theme.js";
import { Card, CardTitle } from "../components/ui.jsx";
import { Inbox as InboxIcon, Users, Mail, BarChart3, Reply, Send, Megaphone } from "lucide-react";
import { similarCompanies } from "../components/NewCompanyModal.jsx";
import { computeLandingStats } from "../lib/landingStats.js";
import * as inboxApi from "../lib/api/inbox.js";
import NewsletterIssues from "../components/NewsletterIssues.jsx";
import InfluencersTab from "../components/InfluencersTab.jsx";
import * as influencerApi from "../lib/api/influencers.js";

const inputStyle = { background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody };
const fmtWhen = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const pct = (n) => (n == null ? "–" : `${Math.round(n * 100)}%`);
const BD_STATUSES = [["new", "New"], ["reviewing", "Reviewing"], ["interview", "Interview"], ["accepted", "Accepted"], ["declined", "Declined"]];

function Field({ label, children }) {
  if (!children) return null;
  return <div className="text-xs" style={{ color: T.textFaint }}>{label}: <span style={{ color: T.textDim }}>{children}</span></div>;
}

// ---- Talk-to-us requests -> pipeline ---------------------------------------
function WebLeadsTab({ companies, createCompany, createContact, goToCompany, profile, onChanged }) {
  const [leads, setLeads] = useState([]);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(null); // lead being added to the pipeline
  const [form, setForm] = useState({ name: "", industry: "", region: "" });
  const [busy, setBusy] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [influencers, setInfluencers] = useState({}); // id -> name, for the "via" label

  const load = useCallback(async () => {
    try {
      setLeads(await inboxApi.fetchWebLeads()); setError(null);
      setInfluencers(Object.fromEntries((await influencerApi.fetchInfluencers()).map((i) => [i.id, i.name])));
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = leads.filter((l) => (showDone ? true : l.status === "new"));
  const startAdd = (l) => { setAdding(l); setForm({ name: l.company || "", industry: "", region: "" }); setError(null); };
  const similar = adding ? similarCompanies(form.name, companies) : [];

  const confirm = async () => {
    setBusy(true); setError(null);
    try {
      const company = await createCompany({
        name: form.name.trim(), industry: form.industry || null, region: form.region.trim() || null,
        stage: "Lead", deal_type: "enterprise", deal_value: 0,
      });
      await createContact(company.id, { name: adding.name, role: adding.title || null, email: adding.email, phone: adding.phone || null, is_primary: true });
      if (adding.influencer_id) {
        await influencerApi.addReferralIfNone({ companyId: company.id, influencerId: adding.influencer_id, how: adding.promo_code ? "promo" : "link" });
      }
      await inboxApi.updateWebLead(adding.id, { status: "confirmed", company_id: company.id, reviewed_by: profile.id, reviewed_at: new Date().toISOString() });
      setAdding(null);
      await load(); onChanged();
    } catch (e) { setError(e.message || "Couldn't add that to the pipeline."); } finally { setBusy(false); }
  };
  const dismiss = async (l) => {
    try { await inboxApi.updateWebLead(l.id, { status: "dismissed", reviewed_by: profile.id, reviewed_at: new Date().toISOString() }); await load(); onChanged(); }
    catch (e) { setError(e.message); }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs" style={{ color: T.textFaint }}>People who asked to talk. Confirm one to create the company (as a Lead) and its contact — nothing enters the pipeline until you do.</p>
        <label className="text-xs flex items-center gap-2" style={{ color: T.textDim }}>
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show reviewed
        </label>
      </div>
      {error && <p className="text-xs" style={{ color: T.red }}>{error}</p>}
      {shown.length === 0 && <p className="text-sm" style={{ color: T.textFaint }}>Nothing waiting.</p>}
      {shown.map((l) => (
        <div key={l.id} className="rounded-lg p-3 flex flex-col gap-2" style={{ background: T.surface2, border: `1px solid ${T.borderSoft}` }}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-medium" style={{ color: T.text }}>{l.name}{l.company ? ` · ${l.company}` : ""}{l.title ? ` (${l.title})` : ""}</div>
              <div className="text-xs" style={{ color: T.textFaint }}>{l.email}{l.phone ? ` · ${l.phone}` : ""} · {fmtWhen(l.created_at)}{l.source ? ` · via ${l.source}` : ""}{l.promo_code ? ` · code ${l.promo_code}` : ""}{l.influencer_id && influencers[l.influencer_id] ? ` · referred by ${influencers[l.influencer_id]}` : ""}</div>
            </div>
            {l.status === "new" ? (
              <div className="flex items-center gap-2 text-xs shrink-0">
                <button onClick={() => startAdd(l)} className="px-3 py-1.5 rounded-lg font-medium" style={{ background: T.amber, color: T.bg }}>Add to pipeline</button>
                <button onClick={() => dismiss(l)} style={{ color: T.textFaint }}>Dismiss</button>
              </div>
            ) : (
              <span className="text-xs shrink-0" style={{ color: l.status === "confirmed" ? T.teal : T.textFaint }}>
                {l.status === "confirmed" ? "Added to pipeline" : "Dismissed"}
                {l.status === "confirmed" && l.company_id && <button onClick={() => goToCompany(l.company_id)} className="ml-2" style={{ color: T.amber }}>Open</button>}
              </span>
            )}
          </div>
          {l.message && <p className="text-sm" style={{ color: T.textDim, lineHeight: 1.5 }}>{l.message}</p>}
          {adding?.id === l.id && (
            <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: T.surface, border: `1px solid ${T.amber}55` }}>
              <div className="text-xs" style={{ color: T.amber }}>Create this company as a Lead — check the name (it becomes the company's name in the CRM).</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Company name" className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
                <select value={form.industry} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
                  <option value="">Industry (optional)</option>
                  {INDUSTRY_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
                <input value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} placeholder="Region (optional)" className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
              </div>
              {similar.length > 0 && (
                <div className="text-xs" style={{ color: T.textDim }}>
                  Already in the CRM: {similar.map((c) => (
                    <button key={c.id} onClick={() => goToCompany(c.id)} className="mr-3 underline" style={{ color: T.amber }}>{c.name}</button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3">
                <button onClick={confirm} disabled={busy || !form.name.trim()} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: T.amber, color: T.bg, opacity: busy || !form.name.trim() ? 0.5 : 1 }}>
                  {busy ? "Adding…" : "Create Lead"}
                </button>
                <button onClick={() => setAdding(null)} className="text-xs" style={{ color: T.textFaint }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---- BD consultant applications --------------------------------------------
function BdTab({ onChanged }) {
  const [apps, setApps] = useState([]);
  const [notes, setNotes] = useState({});
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    try { const rows = await inboxApi.fetchBdApplications(); setApps(rows); setNotes(Object.fromEntries(rows.map((r) => [r.id, r.notes || ""]))); setError(null); }
    catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const patch = async (id, fields) => {
    try { await inboxApi.updateBdApplication(id, fields); await load(); onChanged(); } catch (e) { setError(e.message); }
  };
  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-xs" style={{ color: T.red }}>{error}</p>}
      {apps.length === 0 && <p className="text-sm" style={{ color: T.textFaint }}>No applications yet.</p>}
      {apps.map((a) => (
        <div key={a.id} className="rounded-lg p-3 flex flex-col gap-2" style={{ background: T.surface2, border: `1px solid ${T.borderSoft}` }}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-medium" style={{ color: T.text }}>{a.name}{a.city ? ` · ${a.city}` : ""}</div>
              <div className="text-xs" style={{ color: T.textFaint }}>{a.email}{a.phone ? ` · ${a.phone}` : ""} · {fmtWhen(a.created_at)}{a.source ? ` · via ${a.source}` : ""}</div>
            </div>
            <select value={a.status} onChange={(e) => patch(a.id, { status: e.target.value })} className="text-xs rounded-lg px-2 py-1 outline-none" style={inputStyle}>
              {BD_STATUSES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>
          <Field label="Experience">{a.experience}</Field>
          <Field label="Why Lemo">{a.why}</Field>
          {a.linkedin && <Field label="LinkedIn"><a href={a.linkedin.startsWith("http") ? a.linkedin : `https://${a.linkedin}`} target="_blank" rel="noreferrer" style={{ color: T.amber }}>{a.linkedin}</a></Field>}
          <textarea
            value={notes[a.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
            onBlur={() => (notes[a.id] ?? "") !== (a.notes || "") && patch(a.id, { notes: notes[a.id] })}
            rows={2} placeholder="Notes (saved when you click away)" className="text-sm rounded-lg px-3 py-2 outline-none w-full" style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>
      ))}
    </div>
  );
}

// ---- Newsletter subscribers + the coupon-code pool ----------------------------
function NewsletterTab() {
  const [subs, setSubs] = useState([]);
  const [counts, setCounts] = useState({ total: 0, unused: 0 });
  const [pasted, setPasted] = useState("");
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    try { const [s, c] = await Promise.all([inboxApi.fetchSubscribers(), inboxApi.fetchCouponCounts()]); setSubs(s); setCounts(c); setError(null); }
    catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const addCodes = async () => {
    const codes = Array.from(new Set(pasted.split(/[\s,;]+/).map((c) => c.trim()).filter(Boolean)));
    if (!codes.length) return;
    setError(null); setMsg(null);
    try { await inboxApi.addCouponCodes(codes); setPasted(""); setMsg(`Added ${codes.length} code${codes.length === 1 ? "" : "s"} (duplicates skipped).`); await load(); }
    catch (e) { setError(e.message); }
  };
  const active = subs.filter((s) => !s.unsubscribed_at).length;
  const low = counts.unused < 10;
  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-xs" style={{ color: T.red }}>{error}</p>}
      <div className="flex items-center gap-8 flex-wrap">
        <div><div style={{ fontFamily: T.fontMono, fontSize: 24, color: T.teal }}>{active}</div><div className="text-xs" style={{ color: T.textFaint }}>subscribers</div></div>
        <div><div style={{ fontFamily: T.fontMono, fontSize: 24, color: low ? T.red : T.text }}>{counts.unused}</div><div className="text-xs" style={{ color: T.textFaint }}>codes left of {counts.total}{low ? " — running low" : ""}</div></div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-[11px] uppercase tracking-wide" style={{ color: T.textFaint }}>Add one-time codes</div>
        <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={3} placeholder="Paste codes — one per line, or separated by commas" className="text-sm rounded-lg px-3 py-2 outline-none" style={{ ...inputStyle, resize: "vertical" }} />
        <div className="flex items-center gap-3">
          <button onClick={addCodes} disabled={!pasted.trim()} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: T.amber, color: T.bg, opacity: pasted.trim() ? 1 : 0.5 }}>Add codes</button>
          {msg && <span className="text-xs" style={{ color: T.teal }}>{msg}</span>}
        </div>
      </div>
      <div className="flex flex-col">
        <div className="text-[11px] uppercase tracking-wide pb-2" style={{ color: T.textFaint, borderBottom: `1px solid ${T.border}` }}>Recent sign-ups</div>
        {subs.length === 0 && <p className="text-sm pt-3" style={{ color: T.textFaint }}>No sign-ups yet.</p>}
        {subs.slice(0, 50).map((s) => (
          <div key={s.id} className="grid items-baseline gap-3 py-2 text-xs" style={{ gridTemplateColumns: "1.4fr 1fr 1fr 90px", borderBottom: `1px solid ${T.borderSoft}` }}>
            <span style={{ color: T.text }}>{s.name ? `${s.name} · ` : ""}{s.email}</span>
            <span style={{ color: T.textFaint }}>{s.source || "—"}</span>
            <span style={{ color: T.textFaint }}>{fmtWhen(s.created_at)}</span>
            <span style={{ fontFamily: T.fontMono, color: s.coupon_code ? T.teal : T.red }}>{s.unsubscribed_at ? "unsubscribed" : s.coupon_code || "no code"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Landing page funnel -------------------------------------------------------
const RANGES = [["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["all", "All time"]];
function StatsTab() {
  const [events, setEvents] = useState([]);
  const [range, setRange] = useState("30");
  const [source, setSource] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    inboxApi.fetchLandingEvents(null).then((rows) => { setEvents(rows); setError(null); }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);
  const sinceMs = range === "all" ? null : Date.now() - Number(range) * 86400000;
  const stats = useMemo(() => computeLandingStats(events, { sinceMs, source: source || null }), [events, sinceMs, source]);
  const row = (cells, header) => (
    <div className="grid items-center text-sm py-2.5" style={{ gridTemplateColumns: "1.6fr repeat(5, 1fr)", borderBottom: `1px solid ${header ? T.border : T.borderSoft}`, color: header ? T.textFaint : T.text, fontSize: header ? 11 : undefined, textTransform: header ? "uppercase" : undefined, minWidth: 560 }}>
      {cells.map((c, i) => <span key={i} style={{ fontFamily: !header && i > 0 ? T.fontMono : undefined }}>{c}</span>)}
    </div>
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={range} onChange={(e) => setRange(e.target.value)} className="text-xs rounded-lg px-2 py-1.5 outline-none" style={inputStyle}>
          {RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} className="text-xs rounded-lg px-2 py-1.5 outline-none" style={inputStyle}>
          <option value="">All sources</option>
          {stats.sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {loading && <span className="text-xs" style={{ color: T.textFaint }}>Loading…</span>}
      </div>
      {error && <p className="text-xs" style={{ color: T.red }}>{error}</p>}
      <div className="flex items-center gap-8 flex-wrap">
        <div><div style={{ fontFamily: T.fontMono, fontSize: 24, color: T.text }}>{stats.views}</div><div className="text-xs" style={{ color: T.textFaint }}>visitors landed</div></div>
        <div><div style={{ fontFamily: T.fontMono, fontSize: 24, color: T.text }}>{pct(stats.engagedRate)}</div><div className="text-xs" style={{ color: T.textFaint }}>clicked an option</div></div>
        <div><div style={{ fontFamily: T.fontMono, fontSize: 24, color: T.teal }}>{stats.submitsTotal}</div><div className="text-xs" style={{ color: T.textFaint }}>submitted a form ({pct(stats.overallRate)} of visitors)</div></div>
      </div>
      <div className="overflow-x-auto">
        {row(["Option", "Clicks", "Click rate", "Submitted", "Form completion", "Of all visitors"], true)}
        {stats.options.map((o) => row([o.label, o.clicks, pct(o.clickRate), o.submits, pct(o.completionRate), pct(o.overallRate)]))}
      </div>
      <p className="text-[11px]" style={{ color: T.textFaint, lineHeight: 1.5 }}>
        Click rate = visitors who clicked that option ÷ visitors who landed. Form completion = submissions ÷ clicks. Counts are unique visitors (a person who returns in the same browser session counts once).
      </p>
      {stats.bySource.length > 1 && !source && (
        <div className="overflow-x-auto">
          <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: T.textFaint }}>By QR code / source</div>
          {row(["Source", "Visitors", "Engaged", "Submitted", "Conversion", ""], true)}
          {stats.bySource.map((s) => row([s.source, s.views, pct(s.engagedRate), s.submitsTotal, pct(s.overallRate), ""]))}
        </div>
      )}
    </div>
  );
}

// ---- Mail the CRM couldn't place ---------------------------------------------
// Replies from known contacts are logged automatically (mail-intake); what
// lands here is from someone who isn't a saved contact yet.
function RepliesTab({ companies, createCompany, createContact, addCommunicationLogEntry, createTask, onChanged }) {
  const [emails, setEmails] = useState([]);
  const [error, setError] = useState(null);
  const [picked, setPicked] = useState({}); // email id -> company id
  const [busyId, setBusyId] = useState(null);
  const [newNames, setNewNames] = useState({}); // email id -> name for a company that doesn't exist yet

  const load = useCallback(async () => {
    try { setEmails(await inboxApi.fetchUnmatchedEmails()); setError(null); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const sorted = useMemo(() => [...companies].sort((a, b) => a.name.localeCompare(b.name)), [companies]);
  const outsideEmail = (m) => (m.direction === "outbound" ? (m.to_emails || "").split(",")[0].trim() : m.from_email);

  // Best-guess company name from the other party's address: jane@wellnest.com -> "Wellnest".
  // A free-mail address gives nothing to go on, so the field starts empty.
  const guessCompany = (m) => {
    const dom = (outsideEmail(m).split("@")[1] || "").toLowerCase();
    if (!dom || /^(gmail|yahoo|outlook|hotmail|icloud|aol|proton)/.test(dom)) return "";
    const base = dom.split(".")[0];
    return base.charAt(0).toUpperCase() + base.slice(1);
  };

  const assign = async (m) => {
    let companyId = picked[m.id];
    if (!companyId) return;
    setBusyId(m.id); setError(null);
    try {
      if (companyId === "__new") {
        const name = (newNames[m.id] ?? guessCompany(m)).trim();
        if (!name) throw new Error("Type a name for the new company.");
        const created = await createCompany({ name, industry: null, region: null, stage: "Lead", deal_type: "enterprise", deal_value: 0 });
        companyId = created.id;
      }
      const addr = outsideEmail(m);
      const name = m.direction === "outbound" ? addr : (m.from_name || addr);
      const contact = await createContact(companyId, { name, email: addr, is_primary: false });
      await addCommunicationLogEntry(companyId, {
        occurred_at: m.received_at, contact_id: contact?.id || null, contact_name: null, type: "email",
        notes: `${m.direction === "outbound" ? "Emailed" : "Reply from"} ${name} — "${m.subject}"${m.snippet ? `\n\n${m.snippet}` : ""}`, photo_urls: [],
      });
      await inboxApi.updateInboundEmail(m.id, { status: "logged", company_id: companyId, contact_id: contact?.id || null });
      // Same rule as automatic matches: a reply earns a follow-up task, a sent message doesn't.
      if (m.direction === "inbound") {
        const today = new Date();
        const due = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        const company = companies.find((c) => c.id === companyId);
        await createTask({ company_id: companyId, title: `Reply from ${name}${company ? ` (${company.name})` : ""} — follow up`, type: "email", due_date: due });
      }
      await load(); onChanged();
    } catch (e) { setError(e.message || "Couldn't log that email."); } finally { setBusyId(null); }
  };
  const dismiss = async (m) => {
    try { await inboxApi.updateInboundEmail(m.id, { status: "dismissed" }); await load(); onChanged(); }
    catch (e) { setError(e.message); }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs" style={{ color: T.textFaint }}>
        Mail that reached the CRM mailbox from someone who isn't a saved contact. Pick their company and it's logged on its Communications Log, with them added as a contact. Replies from people already saved as contacts are logged automatically and never show here.
      </p>
      {error && <p className="text-sm" style={{ color: T.red }}>{error}</p>}
      {emails.length === 0 && <p className="text-xs" style={{ color: T.textFaint }}>Nothing waiting.</p>}
      {emails.map((m) => (
        <div key={m.id} className="rounded-lg p-3 flex flex-col gap-2" style={{ background: T.surface2, border: `1px solid ${T.borderSoft}` }}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: T.text }}>{m.subject}</div>
              <div className="text-xs" style={{ color: T.textDim }}>
                {m.direction === "outbound" ? `Sent to ${m.to_emails || "—"}` : `From ${m.from_name ? `${m.from_name} <${m.from_email}>` : m.from_email}`}
              </div>
            </div>
            <span className="text-[11px] shrink-0" style={{ color: T.textFaint, fontFamily: T.fontMono }}>{fmtWhen(m.received_at)}</span>
          </div>
          {m.snippet && <p className="text-xs whitespace-pre-wrap" style={{ color: T.textDim, maxHeight: 96, overflow: "hidden" }}>{m.snippet}</p>}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={picked[m.id] || ""} onChange={(e) => setPicked((p) => ({ ...p, [m.id]: e.target.value }))}
              className="text-xs rounded-lg px-2 py-1.5 outline-none" style={{ ...inputStyle, maxWidth: 240 }}
            >
              <option value="">Choose a company…</option>
              <option value="__new">＋ New company…</option>
              {sorted.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {picked[m.id] === "__new" && (
              <input
                value={newNames[m.id] ?? guessCompany(m)} onChange={(e) => setNewNames((n) => ({ ...n, [m.id]: e.target.value }))}
                placeholder="Company name" className="text-xs rounded-lg px-2 py-1.5 outline-none" style={{ ...inputStyle, width: 170 }}
              />
            )}
            <button
              onClick={() => assign(m)} disabled={!picked[m.id] || busyId === m.id}
              className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: T.amber, color: T.bg, opacity: picked[m.id] && busyId !== m.id ? 1 : 0.5 }}
            >
              {busyId === m.id ? "Logging…" : "Log it"}
            </button>
            <button onClick={() => dismiss(m)} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${T.border}`, color: T.textDim }}>Ignore</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Page --------------------------------------------------------------------
const TABS = [
  { id: "leads", label: "Web leads", icon: Users },
  { id: "bd", label: "BD applications", icon: InboxIcon },
  { id: "replies", label: "Replies", icon: Reply },
  { id: "newsletter", label: "Newsletter", icon: Mail },
  { id: "issues", label: "Newsletter issues", icon: Send },
  { id: "influencers", label: "Influencers", icon: Megaphone },
  { id: "stats", label: "Landing page stats", icon: BarChart3 },
];

export default function InboxPage({ companies, profile, createCompany, createContact, addCommunicationLogEntry, createTask, goToCompany, onChanged }) {
  const [tab, setTab] = useState("leads");
  const [subscriberCount, setSubscriberCount] = useState(0);
  // Who an issue would go to right now (everyone who hasn't unsubscribed).
  useEffect(() => {
    if (profile?.role !== "owner") return;
    inboxApi.fetchSubscribers().then((s) => setSubscriberCount(s.filter((x) => !x.unsubscribed_at).length)).catch(() => {});
  }, [profile?.role, tab]);
  if (profile?.role !== "owner") return <p className="text-sm" style={{ color: T.textFaint }}>The Inbox is for Owners.</p>;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }}>Inbox</h1>
        <p className="text-sm" style={{ color: T.textDim }}>Everything that comes in from the lemowellness.com landing page, and how well it's converting.</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
            style={{ background: tab === t.id ? T.surface2 : "transparent", border: `1px solid ${tab === t.id ? T.amber : T.border}`, color: tab === t.id ? T.amber : T.textDim }}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>
      <Card>
        <CardTitle icon={TABS.find((t) => t.id === tab).icon}>{TABS.find((t) => t.id === tab).label}</CardTitle>
        {tab === "leads" && <WebLeadsTab companies={companies} createCompany={createCompany} createContact={createContact} goToCompany={goToCompany} profile={profile} onChanged={onChanged} />}
        {tab === "bd" && <BdTab onChanged={onChanged} />}
        {tab === "replies" && <RepliesTab companies={companies} createCompany={createCompany} createContact={createContact} addCommunicationLogEntry={addCommunicationLogEntry} createTask={createTask} onChanged={onChanged} />}
        {tab === "newsletter" && <NewsletterTab />}
        {tab === "issues" && <NewsletterIssues subscribers={subscriberCount} />}
        {tab === "influencers" && <InfluencersTab companies={companies} />}
        {tab === "stats" && <StatsTab />}
      </Card>
    </div>
  );
}
