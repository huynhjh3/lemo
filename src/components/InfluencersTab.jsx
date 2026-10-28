import React, { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { T } from "../theme.js";
import * as api from "../lib/api/influencers.js";
import * as inboxApi from "../lib/api/inbox.js";
import { computeInfluencerStats, trackedLink, slugify, describeCommission, statementText } from "../lib/influencerStats.js";
import { fmtMoney } from "../lib/helpers.js";

const inputStyle = { background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody };
const BLANK = { name: "", handle: "", platform: "instagram", slug: "", promo_code: "", commission_type: "none", commission_value: "", commission_months: "", notes: "" };

function Num({ value, label }) {
  return (
    <div className="min-w-0">
      <div style={{ fontFamily: T.fontMono, fontSize: 18, color: T.text }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: T.textFaint }}>{label}</div>
    </div>
  );
}

function InfluencerCard({ row, companies, onChanged, setError }) {
  const { inf } = row;
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(null);
  const [pick, setPick] = useState("");
  const link = trackedLink(inf);
  const sorted = useMemo(() => [...companies].sort((a, b) => a.name.localeCompare(b.name)), [companies]);

  const copy = async (what, text) => {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(null), 1500); }
    catch { setError("Couldn't copy. Select the text and copy it by hand."); }
  };
  const downloadQr = async () => {
    try {
      const url = await QRCode.toDataURL(link, { width: 900, margin: 2, color: { dark: "#1A1512", light: "#FFFFFF" } });
      const a = document.createElement("a"); a.href = url; a.download = `Lemo QR - ${inf.slug}.png`; a.click();
    } catch (e) { setError(e.message || "Couldn't make the QR code."); }
  };
  const run = async (fn) => { try { setError(null); await fn(); await onChanged(); } catch (e) { setError(e.message || "Something went wrong."); } };

  return (
    <div className="rounded-lg p-3 flex flex-col gap-3" style={{ background: T.surface2, border: `1px solid ${T.borderSoft}`, opacity: inf.active ? 1 : 0.6 }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-medium" style={{ color: T.text }}>
            {inf.name}{inf.handle ? <span style={{ color: T.textFaint }}> · @{inf.handle.replace(/^@/, "")}</span> : null}
            {!inf.active && <span className="ml-2 text-[10px] uppercase" style={{ color: T.red }}>paused</span>}
          </div>
          <div className="text-xs" style={{ color: T.textFaint }}>{describeCommission(inf)}{inf.promo_code ? ` · promo code ${inf.promo_code}` : ""}</div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <button onClick={() => copy("statement", statementText(row))} style={{ color: T.amber }}>{copied === "statement" ? "Copied" : "Copy statement"}</button>
          <button onClick={() => setOpen((o) => !o)} style={{ color: T.textDim }}>{open ? "Hide details" : "Details"}</button>
        </div>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(84px, 1fr))" }}>
        <Num value={row.visits} label="Visits" />
        <Num value={row.signups} label="Sign-ups" />
        <Num value={row.inquiries} label="Inquiries" />
        <Num value={row.referred.length} label="Companies" />
        <Num value={row.installed} label="Installed" />
        <Num value={fmtMoney(row.revenue)} label="Revenue" />
        <div className="min-w-0"><div style={{ fontFamily: T.fontMono, fontSize: 18, color: T.teal }}>{fmtMoney(row.commission)}</div><div className="text-[10px] uppercase tracking-wide" style={{ color: T.textFaint }}>Commission</div></div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input readOnly value={link} onFocus={(e) => e.target.select()} className="text-xs rounded-lg px-3 py-1.5 outline-none flex-1" style={{ ...inputStyle, minWidth: 220, fontFamily: T.fontMono }} />
        <button onClick={() => copy("link", link)} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${T.border}`, color: T.textDim }}>{copied === "link" ? "Copied" : "Copy link"}</button>
        <button onClick={downloadQr} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${T.border}`, color: T.textDim }}>QR code</button>
      </div>

      {open && (
        <div className="flex flex-col gap-3 pt-2" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
          <div className="text-[11px] uppercase tracking-wide" style={{ color: T.textFaint }}>Referred companies</div>
          {row.referred.length === 0 && <p className="text-xs" style={{ color: T.textFaint }}>None yet. Leads that arrive through this link or promo code show up in Web leads, and appear here once you add them to the pipeline.</p>}
          {row.referred.map(({ ref, company }) => (
            <div key={ref.id} className="flex items-center justify-between gap-3 text-xs">
              <span style={{ color: T.text }}>{company.name} <span style={{ color: T.textFaint }}>· {company.stage} · via {ref.how}</span></span>
              <span className="flex items-center gap-3">
                <span style={{ fontFamily: T.fontMono, color: T.textDim }}>{fmtMoney((company.revenueHistory || []).reduce((s, m) => s + (Number(m?.value) || 0), 0))}</span>
                <button onClick={() => run(() => api.removeReferral(company.id))} style={{ color: T.textFaint }}>Remove</button>
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2 flex-wrap">
            <select value={pick} onChange={(e) => setPick(e.target.value)} className="text-xs rounded-lg px-2 py-1.5 outline-none" style={{ ...inputStyle, maxWidth: 240 }}>
              <option value="">Add a company by hand…</option>
              {sorted.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button disabled={!pick} onClick={() => run(async () => { await api.setReferral({ companyId: pick, influencerId: inf.id, how: "manual" }); setPick(""); })}
              className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: T.amber, color: T.bg, opacity: pick ? 1 : 0.5 }}>Attach</button>
            <span className="text-[11px]" style={{ color: T.textFaint }}>For calls, DMs, or anyone who didn’t come through the link.</span>
          </div>
          <div className="flex items-center gap-4 text-xs pt-1">
            <button onClick={() => run(() => api.updateInfluencer(inf.id, { active: !inf.active }))} style={{ color: T.textDim }}>{inf.active ? "Pause (stop attributing new leads)" : "Resume"}</button>
            {row.referred.length === 0 && <button onClick={() => run(() => api.deleteInfluencer(inf.id))} style={{ color: T.red }}>Delete</button>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function InfluencersTab({ companies }) {
  const [state, setState] = useState({ influencers: [], referrals: [], events: [], leads: [] });
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [influencers, referrals, events, leads] = await Promise.all([
        api.fetchInfluencers(), api.fetchReferrals(), inboxApi.fetchLandingEvents(null), inboxApi.fetchWebLeads(),
      ]);
      setState({ influencers, referrals, events, leads });
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => computeInfluencerStats({ ...state, companies }), [state, companies]);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const slug = slugify(form.slug || form.handle || form.name);
      if (!form.name.trim()) throw new Error("Add the influencer's name.");
      if (!slug) throw new Error("Add a link name (letters and numbers).");
      const promo = form.promo_code.trim().toUpperCase();
      if (promo && !/^[A-Z0-9]{3,20}$/.test(promo)) throw new Error("A promo code is 3 to 20 letters or numbers, no spaces.");
      if (form.commission_type !== "none" && !(Number(form.commission_value) > 0)) throw new Error("Add the commission amount.");
      await api.createInfluencer({
        name: form.name.trim(), handle: form.handle.trim().replace(/^@/, "") || null, platform: form.platform.trim().toLowerCase() || "instagram",
        slug, promo_code: promo || null, commission_type: form.commission_type,
        commission_value: form.commission_type === "none" ? 0 : Number(form.commission_value),
        commission_months: form.commission_type === "percent_revenue" && Number(form.commission_months) > 0 ? Number(form.commission_months) : null,
        notes: form.notes.trim() || null,
      });
      setForm(BLANK); setSlugTouched(false); setAdding(false); await load();
    } catch (e) { setError(e.message || "Couldn't save that influencer."); } finally { setBusy(false); }
  };

  const field = (label, node) => <label className="flex flex-col gap-1 text-[11px]" style={{ color: T.textFaint }}>{label}{node}</label>;
  const inp = (key, placeholder, extra = {}) => (
    <input value={form[key]} onChange={(e) => set({ [key]: e.target.value, ...(extra.onChange ? extra.onChange(e.target.value) : {}) })} placeholder={placeholder}
      className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs" style={{ color: T.textFaint, maxWidth: 560 }}>
          Give each influencer their own link (and QR code and optional promo code). Visits, inquiries, referred companies, installs, and commission owed are tracked here. Leads that arrive through their link or code appear in Web leads, and when you add one to the pipeline the referral follows it.
        </p>
        <button onClick={() => setAdding((a) => !a)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: T.amber, color: T.bg }}>{adding ? "Cancel" : "Add influencer"}</button>
      </div>
      {error && <p className="text-sm" style={{ color: T.red }}>{error}</p>}

      {adding && (
        <div className="rounded-lg p-3 flex flex-col gap-3" style={{ background: T.surface, border: `1px solid ${T.amber}55` }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {field("Name", inp("name", "Sarah Fit"))}
            {field("Handle", inp("handle", "@sarahfit", { onChange: (v) => (slugTouched ? {} : { slug: slugify(v) }) }))}
            {field("Platform", inp("platform", "instagram"))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {field("Link name (the part after ?src=)", (
              <input value={form.slug} onChange={(e) => { setSlugTouched(true); set({ slug: slugify(e.target.value) }); }} placeholder="sarah-fit" className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
            ))}
            {field("Promo code (optional)", inp("promo_code", "SARAH10"))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {field("Commission", (
              <select value={form.commission_type} onChange={(e) => set({ commission_type: e.target.value })} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
                <option value="none">None set yet</option>
                <option value="flat_per_install">Flat amount per installed company</option>
                <option value="percent_revenue">Percent of revenue</option>
              </select>
            ))}
            {form.commission_type !== "none" && field(form.commission_type === "flat_per_install" ? "Amount ($)" : "Percent (%)", inp("commission_value", form.commission_type === "flat_per_install" ? "250" : "5"))}
            {form.commission_type === "percent_revenue" && field("For the first … months (blank = all)", inp("commission_months", "12"))}
          </div>
          {field("Notes (optional)", inp("notes", "Agreement date, rate details, contact"))}
          <div><button onClick={save} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: T.amber, color: T.bg, opacity: busy ? 0.5 : 1 }}>{busy ? "Saving…" : "Save influencer"}</button></div>
        </div>
      )}

      {rows.length === 0 && !adding && <p className="text-sm" style={{ color: T.textFaint }}>No influencers yet. Click “Add influencer” when you sign your first one.</p>}
      {rows.map((row) => <InfluencerCard key={row.inf.id} row={row} companies={companies} onChanged={load} setError={setError} />)}
    </div>
  );
}
