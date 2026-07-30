import React, { useState, useRef, useReducer, useEffect } from "react";
import {
  LayoutDashboard, Building2, Sparkles, BarChart3, Workflow,
  Search, Phone, Mail, MapPin, Clock, AlertTriangle, CheckCircle2,
  Circle, ChevronRight, Copy, Loader2, Users, Wifi,
  FileText, Calendar, ArrowLeft, Send, DollarSign,
  Flame, TrendingUp, TrendingDown, StickyNote,
  PhoneCall, Mail as MailIcon, Wrench, Pencil, Archive, Plus, UploadCloud, Trash2, RotateCcw,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, ComposedChart, Line
} from "recharts";

import { T } from "./theme.js";
import { Card, CardTitle, StatusDot, ChairStatus, StageBadge, Modal } from "./ui.jsx";
import {
  STAGE_ORDER, TASKS, TODAY, buildInitialCompanies, companiesReducer, companyRevenue,
} from "./store.js";
import {
  fmtMoney, fmtDate, daysBetween, pipelineHealth, forecastedRevenue,
  riskyCompanies, highPriorityActions,
} from "./calc.js";
import { CompanyFormModal, OutletsChairsSection } from "./forms.jsx";
import UploadImportPage from "./UploadImport.jsx";
import { loadPersisted, savePersisted, clearPersisted } from "./persistence.js";

const ACTIVITY_ICON = { call: PhoneCall, email: MailIcon, meeting: Users, install: Wrench, note: StickyNote };

/* ============================== SIDEBAR ============================== */
function Sidebar({ page, setPage, setSelectedCompanyId, onReset }) {
  const items = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "companies", label: "Companies", icon: Building2 },
    { id: "upload", label: "Upload / Import", icon: UploadCloud },
    { id: "ai", label: "AI Outreach", icon: Sparkles },
    { id: "revenue", label: "Revenue", icon: BarChart3 },
    { id: "pipeline", label: "Pipeline", icon: Workflow },
  ];
  return (
    <div
      className="flex flex-col justify-between shrink-0"
      style={{ width: 220, background: T.surface, borderRight: `1px solid ${T.border}`, minHeight: "100%" }}
    >
      <div>
        <div className="flex items-center gap-2 px-5 py-5" style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
          <div className="flex items-center justify-center rounded-lg" style={{ width: 30, height: 30, background: T.amber }}>
            <Wifi size={16} color={T.bg} />
          </div>
          <span style={{ fontFamily: T.fontDisplay, fontWeight: 700, letterSpacing: 1, color: T.text, fontSize: 17 }}>LEMO</span>
        </div>
        <nav className="px-3 py-4 flex flex-col gap-1">
          {items.map((it) => {
            const active = page === it.id;
            return (
              <button
                key={it.id}
                onClick={() => { setPage(it.id); setSelectedCompanyId(null); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
                style={{
                  background: active ? T.surface2 : "transparent",
                  color: active ? T.amber : T.textDim,
                  fontFamily: T.fontBody, fontWeight: active ? 600 : 500,
                  borderLeft: active ? `2px solid ${T.amber}` : "2px solid transparent",
                }}
              >
                <it.icon size={16} />
                {it.label}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="flex flex-col" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-5 py-2.5 text-[11px]"
          style={{ color: T.textFaint }}
          title="Clear saved edits and reload the original sample data"
        >
          <RotateCcw size={12} /> Reset to sample data
        </button>
        <div className="px-5 pb-4 flex items-center gap-2">
          <div className="rounded-full flex items-center justify-center text-xs font-semibold" style={{ width: 28, height: 28, background: T.surface2, color: T.teal, fontFamily: T.fontMono }}>MC</div>
          <div>
            <div className="text-xs font-medium" style={{ color: T.text }}>Maria Chen</div>
            <div className="text-[11px]" style={{ color: T.textFaint }}>Sales · Lemo</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================== OVERVIEW PAGE ============================== */
function OverviewPage({ companies, goToCompany }) {
  const health = pipelineHealth();
  const forecast = forecastedRevenue(companies);
  const risks = riskyCompanies(companies);
  const priorities = highPriorityActions(companies);
  const todayISO = TODAY.toISOString().slice(0, 10);
  const todayTasks = TASKS.filter((t) => t.due === todayISO && !t.done);
  const forecastTrend = [
    { m: "Feb", v: 6200 }, { m: "Mar", v: 6200 }, { m: "Apr", v: 6200 },
    { m: "May", v: 9400 }, { m: "Jun", v: 19500 }, { m: "Jul", v: forecast.total },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 style={{ fontFamily: T.fontDisplay, fontSize: 24, fontWeight: 600, color: T.text }}>Good morning, Maria</h1>
        <p className="text-sm mt-1" style={{ color: T.textDim }}>{TODAY.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} — here's what needs your attention today.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <CardTitle icon={Flame}>High Priority Actions</CardTitle>
          <div className="flex flex-col divide-y" style={{ borderColor: T.borderSoft }}>
            {priorities.map((p) => (
              <button
                key={p.key}
                onClick={() => p.companyId && goToCompany(p.companyId)}
                className="flex items-center gap-3 py-2.5 text-left w-full"
                style={{ borderTop: `1px solid ${T.borderSoft}` }}
              >
                <AlertTriangle size={15} style={{ color: p.urgency === 3 ? T.red : T.amber, flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate" style={{ color: T.text }}>{p.title}</div>
                  <div className="text-xs" style={{ color: T.textFaint }}>{p.sub}</div>
                </div>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0"
                  style={{ color: p.urgency === 3 ? T.red : T.amber, background: `${p.urgency === 3 ? T.red : T.amber}14`, fontFamily: T.fontMono }}
                >
                  {p.kind}
                </span>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle icon={DollarSign}>Forecasted Revenue</CardTitle>
          <div style={{ fontFamily: T.fontMono, fontSize: 26, fontWeight: 600, color: T.teal }}>{fmtMoney(forecast.total)}</div>
          <div className="text-xs mb-3" style={{ color: T.textFaint }}>projected this month</div>
          <div style={{ height: 70 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastTrend}>
                <defs>
                  <linearGradient id="fc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={T.teal} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={T.teal} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke={T.teal} strokeWidth={2} fill="url(#fc)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between text-xs mt-2 pt-2" style={{ borderTop: `1px solid ${T.borderSoft}`, color: T.textFaint }}>
            <span>Pipeline: {fmtMoney(forecast.weighted)}</span>
            <span>Recurring: {fmtMoney(forecast.recognizedMRR)}</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardTitle icon={Workflow}>Pipeline Health</CardTitle>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: T.textDim }}>Overdue follow-ups</span>
              <span style={{ fontFamily: T.fontMono, color: health.overdue > 0 ? T.red : T.text, fontSize: 15 }}>{health.overdue}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: T.textDim }}>Avg days to close</span>
              <span style={{ fontFamily: T.fontMono, color: T.text, fontSize: 15 }}>{health.avgDays}d</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: T.textDim }}>Conversion rate</span>
              <span style={{ fontFamily: T.fontMono, color: T.teal, fontSize: 15 }}>{health.conversion}%</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle icon={Calendar}>Today's Tasks</CardTitle>
          {todayTasks.length === 0 ? (
            <p className="text-xs" style={{ color: T.textFaint }}>Nothing scheduled for today.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {todayTasks.map((t) => (
                <div key={t.id} className="flex items-start gap-2">
                  <Circle size={13} style={{ color: T.textFaint, marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div className="text-xs" style={{ color: T.text }}>{t.title}</div>
                    <div className="text-[11px]" style={{ color: T.textFaint }}>{t.company}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardTitle icon={AlertTriangle}>Risks</CardTitle>
          <div className="text-xs mb-2" style={{ color: T.textDim }}>
            Revenue at risk: <span style={{ color: T.red, fontFamily: T.fontMono }}>{fmtMoney(risks.reduce((s, c) => s + c.dealValue, 0))}</span>
          </div>
          <div className="flex flex-col gap-2">
            {risks.slice(0, 3).map((c) => (
              <button key={c.id} onClick={() => goToCompany(c.id)} className="text-left flex items-center gap-2 rounded-lg px-2 py-1.5 -mx-2" style={{ background: T.surface2 }}>
                <StatusDot status={c.status} />
                <div className="min-w-0">
                  <div className="text-xs truncate" style={{ color: T.text }}>{c.name}</div>
                  <div className="text-[11px] truncate" style={{ color: T.textFaint }}>{c.reasons[0]}</div>
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ============================== COMPANIES LIST ============================== */
function CompaniesPage({ companies, goToCompany, onAdd, onDelete }) {
  const [q, setQ] = useState("");
  const visible = companies.filter((c) => !c.archived);
  const filtered = visible.filter((c) => [c.name, c.city, c.industry].join(" ").toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }}>Companies</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: T.surface, border: `1px solid ${T.border}`, width: 260 }}>
            <Search size={14} style={{ color: T.textFaint }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company, city, industry…" className="bg-transparent outline-none text-sm w-full" style={{ color: T.text, fontFamily: T.fontBody }} />
          </div>
          <button onClick={onAdd} className="flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-2" style={{ background: T.amber, color: T.bg }}>
            <Plus size={15} /> Add company
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {filtered.map((c) => (
          <div
            key={c.id}
            role="button"
            tabIndex={0}
            onClick={() => goToCompany(c.id)}
            onKeyDown={(e) => e.key === "Enter" && goToCompany(c.id)}
            className="relative text-left rounded-xl p-4 transition-transform hover:-translate-y-0.5 cursor-pointer group"
            style={{ background: T.surface, border: `1px solid ${T.border}` }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Delete ${c.name}? This removes the company, its outlets, and chairs. This can't be undone.`)) {
                  onDelete(c.id);
                }
              }}
              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity rounded-md p-1"
              style={{ color: T.textFaint }}
              title="Delete company"
            >
              <Trash2 size={13} />
            </button>
            <div className="flex items-center justify-between mb-2 pr-5">
              <div className="flex items-center gap-2 min-w-0">
                <StatusDot status={c.status} />
                <span className="text-sm font-semibold truncate" style={{ color: T.text, fontFamily: T.fontDisplay }}>{c.name}</span>
              </div>
              <StageBadge stage={c.stage} />
            </div>
            <div className="text-xs mb-1" style={{ color: T.textFaint }}>{c.industry} · {c.city}</div>
            <div className="text-[10px] mb-3" style={{ color: T.textFaint, fontFamily: T.fontMono }}>{c.id}</div>
            <div className="flex items-center justify-between text-xs" style={{ color: T.textDim }}>
              <span style={{ fontFamily: T.fontMono, color: T.teal }}>{fmtMoney(c.dealValue)}</span>
              <span>Last contact {fmtDate(c.lastContact)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================== COMPANY PROFILE ============================== */
function CompanyProfile({ company, back, dispatch, onEdit }) {
  const refs = { overview: useRef(null), contacts: useRef(null), outlets: useRef(null), activity: useRef(null), revenue: useRef(null), notes: useRef(null) };
  const scrollTo = (key) => refs[key].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const sortedActivity = [...company.activity].sort((a, b) => new Date(b.date) - new Date(a.date));
  const revenue = companyRevenue(company, company.revenueHistory[company.revenueHistory.length - 1]?.value || 0);

  return (
    <div>
      <button onClick={back} className="flex items-center gap-1.5 text-xs mb-4" style={{ color: T.textDim }}>
        <ArrowLeft size={14} /> All companies
      </button>

      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <StatusDot status={company.status} size={10} />
            <h1 style={{ fontFamily: T.fontDisplay, fontSize: 24, fontWeight: 600, color: T.text }}>{company.name}</h1>
            <StageBadge stage={company.stage} />
            <span className="text-xs" style={{ color: T.textFaint, fontFamily: T.fontMono }}>{company.id}</span>
          </div>
          <div className="text-sm" style={{ color: T.textDim }}>{company.industry} · {company.city} · Rep: {company.rep}</div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onEdit} className="flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5" style={{ border: `1px solid ${T.border}`, color: T.textDim }}>
            <Pencil size={12} /> Edit
          </button>
          <button
            onClick={() => { dispatch({ type: "ARCHIVE_COMPANY", id: company.id }); back(); }}
            className="flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5"
            style={{ border: `1px solid ${T.border}`, color: T.textFaint }}
          >
            <Archive size={12} /> Archive
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Delete ${company.name}? This removes the company, its outlets, and chairs. This can't be undone.`)) {
                dispatch({ type: "DELETE_COMPANY", id: company.id });
                back();
              }
            }}
            className="flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5"
            style={{ border: `1px solid ${T.red}55`, color: T.red }}
          >
            <Trash2 size={12} /> Delete
          </button>
          <div className="text-right">
            <div style={{ fontFamily: T.fontMono, fontSize: 22, color: T.teal }}>{fmtMoney(company.dealValue)}</div>
            <div className="text-xs" style={{ color: T.textFaint }}>deal value</div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-5 px-1 py-1 rounded-lg sticky top-0 z-10" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
        {[["overview", "Overview"], ["contacts", "Contacts"], ["outlets", "Outlets & Chairs"], ["activity", "Activity"], ["revenue", "Revenue"], ["notes", "Notes"]].map(([key, label]) => (
          <button key={key} onClick={() => scrollTo(key)} className="text-xs px-3 py-1.5 rounded-md" style={{ color: T.textDim, fontFamily: T.fontBody }}>{label}</button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <Card style={{ scrollMarginTop: 70 }}>
          <div ref={refs.overview} />
          <CardTitle icon={Building2}>Overview</CardTitle>
          <p className="text-sm mb-4" style={{ color: T.text, lineHeight: 1.6 }}>{company.interest}</p>
          <div className="grid grid-cols-4 gap-4 text-xs">
            <div>
              <div style={{ color: T.textFaint }}>Next follow-up</div>
              <div className="mt-1" style={{ color: T.text, fontFamily: T.fontMono }}>{company.nextFollowUp ? fmtDate(company.nextFollowUp) : "—"}</div>
            </div>
            <div>
              <div style={{ color: T.textFaint }}>Last contact</div>
              <div className="mt-1" style={{ color: T.text, fontFamily: T.fontMono }}>{fmtDate(company.lastContact)}</div>
            </div>
            <div>
              <div style={{ color: T.textFaint }}>In pipeline since</div>
              <div className="mt-1" style={{ color: T.text, fontFamily: T.fontMono }}>{fmtDate(company.createdDate)}</div>
            </div>
            <div>
              <div style={{ color: T.textFaint }}>Business type</div>
              <div className="mt-1" style={{ color: T.text, fontFamily: T.fontMono }}>
                {company.businessType === "enterprise" ? `Enterprise · ${fmtMoney(company.monthlyFee)}/mo` : `Revenue share · ${company.splitToLemo}/${100 - company.splitToLemo}`}
              </div>
            </div>
          </div>
        </Card>

        <Card style={{ scrollMarginTop: 70 }}>
          <div ref={refs.contacts} />
          <CardTitle icon={Users}>Contacts</CardTitle>
          {company.contacts.length === 0 ? (
            <p className="text-xs" style={{ color: T.textFaint }}>No contacts on file yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {company.contacts.map((p) => (
                <div key={p.id} className="rounded-lg p-3" style={{ background: T.surface2 }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium" style={{ color: T.text }}>{p.name}</span>
                    {p.primary && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: T.amber, background: `${T.amber}14` }}>Primary</span>}
                  </div>
                  <div className="text-xs mb-2" style={{ color: T.textFaint }}>{p.role}</div>
                  <div className="flex flex-col gap-1 text-xs" style={{ color: T.textDim }}>
                    {p.email && <a href={`mailto:${p.email}`} className="flex items-center gap-1.5 hover:underline"><Mail size={11} /> {p.email}</a>}
                    {p.phone && <a href={`tel:${p.phone}`} className="flex items-center gap-1.5 hover:underline"><Phone size={11} /> {p.phone}</a>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card style={{ scrollMarginTop: 70 }}>
          <div ref={refs.outlets} />
          <CardTitle icon={MapPin}>Outlets & Chairs</CardTitle>
          <OutletsChairsSection company={company} dispatch={dispatch} />
        </Card>

        <Card style={{ scrollMarginTop: 70 }}>
          <div ref={refs.activity} />
          <CardTitle icon={Clock}>Activity Timeline</CardTitle>
          <div className="flex flex-col">
            {sortedActivity.map((a, i) => {
              const Icon = ACTIVITY_ICON[a.type] || StickyNote;
              return (
                <div key={a.id} className="flex gap-3 pb-4 relative">
                  {i < sortedActivity.length - 1 && <div className="absolute left-[9px] top-6 bottom-0 w-px" style={{ background: T.border }} />}
                  <div className="rounded-full flex items-center justify-center shrink-0 z-10" style={{ width: 20, height: 20, background: T.surface2, border: `1px solid ${T.border}` }}>
                    <Icon size={11} style={{ color: T.amber }} />
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: T.textFaint, fontFamily: T.fontMono }}>{fmtDate(a.date)} · {a.user}</div>
                    <div className="text-sm mt-0.5" style={{ color: T.text }}>{a.summary}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card style={{ scrollMarginTop: 70 }}>
          <div ref={refs.revenue} />
          <CardTitle icon={DollarSign} right={<span className="text-xs" style={{ color: T.textFaint }}>Latest period: <span style={{ color: T.teal, fontFamily: T.fontMono }}>{fmtMoney(revenue)}</span></span>}>Revenue</CardTitle>
          <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={company.revenueHistory}>
                <CartesianGrid vertical={false} stroke={T.borderSoft} />
                <XAxis dataKey="month" tick={{ fill: T.textFaint, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} />
                <YAxis tick={{ fill: T.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: T.text }} formatter={(v) => fmtMoney(v)} />
                <Bar dataKey="value" fill={T.teal} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card style={{ scrollMarginTop: 70 }}>
          <div ref={refs.notes} />
          <CardTitle icon={StickyNote}>Notes</CardTitle>
          {company.notes.length === 0 ? (
            <p className="text-xs" style={{ color: T.textFaint }}>No notes yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {company.notes.map((n) => (
                <div key={n.id} className="text-sm rounded-lg p-3" style={{ background: T.surface2, color: T.text }}>
                  {n.text}
                  <div className="text-[11px] mt-1.5" style={{ color: T.textFaint }}>{n.author} · {fmtDate(n.date)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ============================== AI OUTREACH PAGE ============================== */
function AIPage({ companies }) {
  const [companyId, setCompanyId] = useState(companies[0].id);
  const [emailType, setEmailType] = useState("Cold Outreach");
  const [context, setContext] = useState(companies[0].interest);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const company = companies.find((c) => c.id === companyId);
  const primaryContact = company?.contacts.find((p) => p.primary) || company?.contacts[0];

  const handleCompanyChange = (id) => {
    setCompanyId(id);
    const c = companies.find((cc) => cc.id === id);
    setContext(c.interest);
    setResult(null);
  };

  const generate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const prompt = `You are a sales rep at Lemo, a company that installs and manages smart connectivity devices (routers, kiosks, payment gateways) for retail, hospitality, and food-service outlets.

Write a ${emailType} email to ${primaryContact ? primaryContact.name + " (" + primaryContact.role + ")" : "the decision maker"} at ${company.name}, a ${company.industry} company in ${company.city}.

Context: ${context}

Requirements:
- Under 130 words
- Plain, direct, non-salesy tone
- One clear call to action
- Return ONLY in this exact format with no preamble:
Subject: <subject line>

<email body>`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await response.json();
      const text = data.content?.map((b) => b.text || "").join("\n").trim();
      if (!text) throw new Error("No response from model");
      const [subjectLine, ...rest] = text.split("\n");
      setResult({ subject: subjectLine.replace(/^Subject:\s*/i, ""), body: rest.join("\n").trim() });
    } catch (e) {
      setError("Couldn't generate a draft right now. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyAll = () => { if (result) navigator.clipboard.writeText(`Subject: ${result.subject}\n\n${result.body}`); };

  return (
    <div>
      <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }} className="mb-1">AI Outreach</h1>
      <p className="text-sm mb-5" style={{ color: T.textDim }}>Pick a company and let AI draft the first outreach email, grounded in what's actually in their file.</p>
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: T.textFaint }}>Company</label>
              <select value={companyId} onChange={(e) => handleCompanyChange(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 outline-none" style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody }}>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: T.textFaint }}>Email type</label>
              <select value={emailType} onChange={(e) => setEmailType(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 outline-none" style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody }}>
                {["Cold Outreach", "Follow-up", "Re-engagement", "Check-in"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: T.textFaint }}>Context for the AI</label>
              <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={5} className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-none" style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody }} />
            </div>
            {primaryContact && <div className="text-xs" style={{ color: T.textFaint }}>Sending to: <span style={{ color: T.textDim }}>{primaryContact.name}, {primaryContact.role}</span></div>}
            <button onClick={generate} disabled={loading} className="flex items-center justify-center gap-2 text-sm font-medium rounded-lg py-2.5 mt-1" style={{ background: T.amber, color: T.bg, fontFamily: T.fontBody, opacity: loading ? 0.7 : 1 }}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {loading ? "Drafting…" : "Generate draft"}
            </button>
          </div>
        </Card>
        <Card>
          <CardTitle icon={Send} right={result && (<button onClick={copyAll} className="flex items-center gap-1 text-xs" style={{ color: T.textDim }}><Copy size={12} /> Copy</button>)}>Draft</CardTitle>
          {!result && !loading && !error && <div className="flex items-center justify-center h-48 text-xs text-center" style={{ color: T.textFaint }}>Your generated email will appear here.</div>}
          {loading && <div className="flex items-center justify-center h-48 text-xs" style={{ color: T.textFaint }}><Loader2 size={16} className="animate-spin mr-2" /> Writing draft…</div>}
          {error && <div className="text-xs" style={{ color: T.red }}>{error}</div>}
          {result && (
            <div>
              <div className="text-xs mb-1" style={{ color: T.textFaint }}>Subject</div>
              <div className="text-sm mb-3 font-medium" style={{ color: T.text }}>{result.subject}</div>
              <div className="text-xs mb-1" style={{ color: T.textFaint }}>Body</div>
              <div className="text-sm whitespace-pre-wrap" style={{ color: T.text, lineHeight: 1.6 }}>{result.body}</div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ============================== REVENUE PAGE ============================== */
function RevenuePage({ companies }) {
  const months = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  const monthly = months.map((m, i) => ({ month: m, actual: companies.reduce((s, c) => s + c.revenueHistory[i].value, 0) }));
  const forecast = forecastedRevenue(companies);
  const withForecast = [...monthly, { month: "Aug", forecast: Math.round(forecast.total * 1.05) }, { month: "Sep", forecast: Math.round(forecast.total * 1.12) }];
  withForecast[monthly.length - 1].forecast = monthly[monthly.length - 1].actual;

  const byCompany = [...companies]
    .map((c) => ({ ...c, thisMonth: c.revenueHistory[c.revenueHistory.length - 1].value, lastMonth: c.revenueHistory[c.revenueHistory.length - 2].value }))
    .filter((c) => c.thisMonth > 0 || c.lastMonth > 0)
    .sort((a, b) => b.thisMonth - a.thisMonth);

  const totalThisMonth = byCompany.reduce((s, c) => s + c.thisMonth, 0);

  return (
    <div>
      <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }} className="mb-5">Revenue</h1>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <Card><div className="text-xs mb-1" style={{ color: T.textFaint }}>This month (actual)</div><div style={{ fontFamily: T.fontMono, fontSize: 24, color: T.teal }}>{fmtMoney(totalThisMonth)}</div></Card>
        <Card><div className="text-xs mb-1" style={{ color: T.textFaint }}>Forecasted (weighted pipeline)</div><div style={{ fontFamily: T.fontMono, fontSize: 24, color: T.amber }}>{fmtMoney(forecast.weighted)}</div></Card>
        <Card><div className="text-xs mb-1" style={{ color: T.textFaint }}>Recurring from won deals</div><div style={{ fontFamily: T.fontMono, fontSize: 24, color: T.text }}>{fmtMoney(forecast.recognizedMRR)}</div></Card>
      </div>
      <Card className="mb-4">
        <CardTitle icon={TrendingUp}>Monthly Revenue vs Forecast</CardTitle>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={withForecast}>
              <CartesianGrid vertical={false} stroke={T.borderSoft} />
              <XAxis dataKey="month" tick={{ fill: T.textFaint, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} />
              <YAxis tick={{ fill: T.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
              <Tooltip contentStyle={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: T.text }} formatter={(v) => fmtMoney(v)} />
              <Bar dataKey="actual" fill={T.teal} radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="forecast" stroke={T.amber} strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3, fill: T.amber }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <CardTitle icon={Building2}>Revenue by Company</CardTitle>
        <div className="flex flex-col">
          <div className="grid grid-cols-5 text-[11px] uppercase tracking-wide pb-2" style={{ color: T.textFaint, borderBottom: `1px solid ${T.border}` }}>
            <span>Company</span><span>Business type</span><span>This month</span><span>Last month</span><span>Trend</span>
          </div>
          {byCompany.map((c) => {
            const up = c.thisMonth >= c.lastMonth;
            return (
              <div key={c.id} className="grid grid-cols-5 items-center text-sm py-2.5" style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                <div className="flex items-center gap-2"><StatusDot status={c.status} /> <span style={{ color: T.text }}>{c.name}</span></div>
                <span className="text-xs" style={{ color: T.textFaint }}>{c.businessType === "enterprise" ? "Enterprise" : "Revenue share"}</span>
                <span style={{ fontFamily: T.fontMono, color: T.text }}>{fmtMoney(c.thisMonth)}</span>
                <span style={{ fontFamily: T.fontMono, color: T.textFaint }}>{fmtMoney(c.lastMonth)}</span>
                <span className="flex items-center gap-1" style={{ color: up ? T.teal : T.red }}>
                  {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  <span className="text-xs">{c.lastMonth === 0 ? "new" : Math.abs(Math.round(((c.thisMonth - c.lastMonth) / c.lastMonth) * 100)) + "%"}</span>
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ============================== PIPELINE PAGE ============================== */
function PipelinePage({ companies, goToCompany, dispatch, onAdd }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }}>Pipeline</h1>
        <button onClick={onAdd} className="flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-2" style={{ background: T.amber, color: T.bg }}>
          <Plus size={15} /> Add deal
        </button>
      </div>
      <div className="grid grid-cols-6 gap-3 items-start">
        {STAGE_ORDER.map((stage) => {
          const deals = companies.filter((c) => c.stage === stage && !c.archived);
          const total = deals.reduce((s, c) => s + c.dealValue, 0);
          return (
            <div key={stage} className="rounded-xl p-3" style={{ background: T.surface, border: `1px solid ${T.border}`, minHeight: 200 }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold" style={{ color: T.text, fontFamily: T.fontDisplay }}>{stage}</span>
                <span className="text-[11px]" style={{ color: T.textFaint, fontFamily: T.fontMono }}>{deals.length}</span>
              </div>
              <div className="text-[11px] mb-3" style={{ color: T.textFaint, fontFamily: T.fontMono }}>{fmtMoney(total)}</div>
              <div className="flex flex-col gap-2">
                {deals.map((c) => {
                  const days = daysBetween(c.createdDate, TODAY);
                  return (
                    <div key={c.id} className="text-left rounded-lg p-2.5" style={{ background: T.surface2, border: `1px solid ${T.borderSoft}` }}>
                      <button onClick={() => goToCompany(c.id)} className="text-left w-full">
                        <div className="flex items-center gap-1.5 mb-1">
                          <StatusDot status={c.status} size={6} />
                          <span className="text-xs font-medium truncate" style={{ color: T.text }}>{c.name}</span>
                        </div>
                        <div className="text-[11px]" style={{ color: T.teal, fontFamily: T.fontMono }}>{fmtMoney(c.dealValue)}</div>
                        <div className="text-[10px] mt-1" style={{ color: T.textFaint }}>{days}d in pipeline · {c.rep}</div>
                      </button>
                      <select
                        value={c.stage}
                        onChange={(e) => dispatch({ type: "MOVE_STAGE", id: c.id, stage: e.target.value })}
                        className="w-full text-[10px] mt-2 rounded px-1.5 py-1 outline-none"
                        style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.textDim, fontFamily: T.fontMono }}
                      >
                        {STAGE_ORDER.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================== ROOT APP ============================== */
export default function LemoCRM() {
  const [companies, dispatch] = useReducer(companiesReducer, undefined, () => loadPersisted()?.companies ?? buildInitialCompanies());
  const [uploadHistory, setUploadHistory] = useState(() => loadPersisted()?.uploadHistory ?? []);
  const [page, setPage] = useState("overview");
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [modal, setModal] = useState(null); // "add" | "edit" | null

  // Persist every change so edits, deletes, and uploads survive a refresh.
  useEffect(() => {
    savePersisted({ companies, uploadHistory });
  }, [companies, uploadHistory]);

  const goToCompany = (id) => { setSelectedCompanyId(id); setPage("companies"); };
  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);

  const handleImportConfirm = ({ fileName, rows, date }) => {
    dispatch({ type: "APPLY_IMPORT_SNAPSHOT", snapshot: { date, rows } });
    setUploadHistory((h) => [{ fileName, date, rowCount: rows.length, by: "Operations (you)" }, ...h]);
  };

  const resetToSampleData = () => {
    if (!window.confirm("Reset the CRM to the original sample data? Everything you've added or edited here will be lost.")) return;
    clearPersisted();
    window.location.reload();
  };

  return (
    <div style={{ fontFamily: T.fontBody, background: T.bg, minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        select { appearance: none; }
        button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
          outline: 2px solid ${T.amber}; outline-offset: 1px;
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
        }
      `}</style>
      <div className="flex" style={{ minHeight: "100vh" }}>
        <Sidebar page={page} setPage={setPage} setSelectedCompanyId={setSelectedCompanyId} onReset={resetToSampleData} />
        <div className="flex-1 p-6 overflow-x-hidden">
          {page === "overview" && <OverviewPage companies={companies} goToCompany={goToCompany} />}
          {page === "companies" && !selectedCompany && (
            <CompaniesPage companies={companies} goToCompany={goToCompany} onAdd={() => setModal("add")} onDelete={(id) => dispatch({ type: "DELETE_COMPANY", id })} />
          )}
          {page === "companies" && selectedCompany && (
            <CompanyProfile company={selectedCompany} back={() => setSelectedCompanyId(null)} dispatch={dispatch} onEdit={() => setModal("edit")} />
          )}
          {page === "upload" && <UploadImportPage companies={companies} onConfirm={handleImportConfirm} uploadHistory={uploadHistory} />}
          {page === "ai" && <AIPage companies={companies} />}
          {page === "revenue" && <RevenuePage companies={companies} />}
          {page === "pipeline" && <PipelinePage companies={companies} goToCompany={goToCompany} dispatch={dispatch} onAdd={() => setModal("add")} />}
        </div>
      </div>

      {modal === "add" && (
        <CompanyFormModal onClose={() => setModal(null)} onSave={(payload) => { dispatch({ type: "ADD_COMPANY", payload }); setModal(null); }} />
      )}
      {modal === "edit" && selectedCompany && (
        <CompanyFormModal
          initial={selectedCompany}
          onClose={() => setModal(null)}
          onSave={(payload) => { dispatch({ type: "UPDATE_COMPANY", id: selectedCompany.id, payload }); setModal(null); }}
        />
      )}
    </div>
  );
}
