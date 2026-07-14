import React, { useState, useRef } from "react";
import {
  LayoutDashboard, Building2, Sparkles, BarChart3, Workflow,
  Search, Phone, Mail, MapPin, Clock, AlertTriangle, CheckCircle2,
  Circle, ChevronRight, ChevronLeft, Copy, Loader2, Users, Wifi,
  WifiOff, FileText, Calendar, ArrowLeft, Send, DollarSign,
  Flame, ClipboardList, TrendingUp, TrendingDown, StickyNote,
  PhoneCall, Mail as MailIcon, Handshake, Wrench, Check
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, ComposedChart, Line
} from "recharts";

/* ============================== DESIGN TOKENS ============================== */
const T = {
  bg: "#14171C",
  surface: "#1A1E25",
  surface2: "#22272F",
  border: "#2B303A",
  borderSoft: "#252A32",
  text: "#E8E6DD",
  textDim: "#8B92A0",
  textFaint: "#5C6270",
  amber: "#F2A93B",
  teal: "#3FBAC2",
  red: "#E85C4A",
  fontDisplay: "'Space Grotesk', sans-serif",
  fontBody: "'Inter', sans-serif",
  fontMono: "'IBM Plex Mono', monospace",
};

const STATUS_META = {
  healthy: { color: T.teal, label: "Healthy" },
  attention: { color: T.amber, label: "Needs Attention" },
  risk: { color: T.red, label: "At Risk" },
};

const STAGE_ORDER = ["Lead", "Contacted", "Proposal", "Negotiation", "Won", "Lost"];
const STAGE_PROB = { Lead: 0.1, Contacted: 0.25, Proposal: 0.5, Negotiation: 0.75, Won: 1, Lost: 0 };
const TODAY = new Date("2026-07-14T09:00:00");

/* ============================== MOCK DATA ============================== */
const COMPANIES = [
  {
    id: "c1", name: "Brightside Diners", industry: "Restaurant Group", city: "Austin, TX",
    rep: "Maria Chen", stage: "Negotiation", status: "attention", dealValue: 48000,
    createdDate: "2026-05-10", lastContact: "2026-07-08", nextFollowUp: "2026-07-15",
    interest: "Expanding router + kiosk rollout to all 12 locations by Q4. Price-sensitive on volume tiers.",
    contacts: [
      { id: "p1", name: "Devon Ruiz", role: "Director of Operations", email: "devon@brightsidediners.com", phone: "(512) 555-0142", primary: true },
      { id: "p2", name: "Alicia Nguyen", role: "IT Manager", email: "alicia@brightsidediners.com", phone: "(512) 555-0198" },
    ],
    outlets: [
      { id: "o1", name: "Brightside – Downtown", address: "118 Congress Ave, Austin, TX", devices: [
        { id: "d1", type: "Smart Router X2", serial: "RX2-88213", status: "online", installed: "2026-03-12" },
        { id: "d2", type: "Kiosk Terminal", serial: "KT-40921", status: "offline", installed: "2026-03-12" },
      ]},
      { id: "o2", name: "Brightside – Domain", address: "3315 Esperanza Crossing, Austin, TX", devices: [
        { id: "d3", type: "Smart Router X2", serial: "RX2-88214", status: "online", installed: "2026-05-02" },
      ]},
    ],
    activity: [
      { id: "a1", date: "2026-07-08", type: "call", user: "Maria Chen", summary: "Discussed rollout timeline for remaining 4 locations." },
      { id: "a2", date: "2026-06-29", type: "email", user: "Maria Chen", summary: "Sent updated proposal with volume pricing." },
      { id: "a3", date: "2026-06-14", type: "install", user: "Field Team", summary: "Completed install at Domain location." },
      { id: "a4", date: "2026-05-30", type: "meeting", user: "Maria Chen", summary: "On-site demo with ops and IT leadership." },
    ],
    notes: [{ id: "n1", date: "2026-07-08", author: "Maria Chen", text: "Budget approved for FY, waiting on legal review of contract terms." }],
    revenueHistory: [{ month: "Feb", value: 0 }, { month: "Mar", value: 6200 }, { month: "Apr", value: 6200 }, { month: "May", value: 9400 }, { month: "Jun", value: 9400 }, { month: "Jul", value: 9400 }],
  },
  {
    id: "c2", name: "Northgate Retail Group", industry: "Big-Box Retail", city: "Denver, CO",
    rep: "Maria Chen", stage: "Proposal", status: "healthy", dealValue: 62000,
    createdDate: "2026-06-01", lastContact: "2026-07-11", nextFollowUp: "2026-07-17",
    interest: "Needs redundant connectivity for 6 stores ahead of holiday season. Fast decision cycle.",
    contacts: [{ id: "p3", name: "Grace Kim", role: "VP Store Operations", email: "gkim@northgateretail.com", phone: "(303) 555-0110", primary: true }],
    outlets: [
      { id: "o3", name: "Northgate – Cherry Creek", address: "2800 E 1st Ave, Denver, CO", devices: [
        { id: "d4", type: "Smart Router X2", serial: "RX2-90110", status: "online", installed: "2026-06-20" },
      ]},
    ],
    activity: [
      { id: "a5", date: "2026-07-11", type: "email", user: "Maria Chen", summary: "Shared proposal covering all 6 stores with fallback LTE add-on." },
      { id: "a6", date: "2026-07-02", type: "meeting", user: "Maria Chen", summary: "Discovery call — mapped current outage pain points." },
    ],
    notes: [{ id: "n2", date: "2026-07-02", author: "Maria Chen", text: "Compares us against a competitor on price only — lean on uptime SLA." }],
    revenueHistory: [{ month: "Feb", value: 0 }, { month: "Mar", value: 0 }, { month: "Apr", value: 0 }, { month: "May", value: 0 }, { month: "Jun", value: 2100 }, { month: "Jul", value: 2100 }],
  },
  {
    id: "c3", name: "Camden Hotels", industry: "Hospitality", city: "Charleston, SC",
    rep: "Josh Bell", stage: "Lead", status: "healthy", dealValue: 21000,
    createdDate: "2026-07-05", lastContact: "2026-07-09", nextFollowUp: "2026-07-16",
    interest: "Inbound lead from trade show. Wants guest-facing WiFi upgrade across 3 boutique properties.",
    contacts: [{ id: "p4", name: "Priya Shah", role: "GM", email: "priya@camdenhotels.com", phone: "(843) 555-0177", primary: true }],
    outlets: [{ id: "o4", name: "Camden – Waterfront", address: "45 Harbor St, Charleston, SC", devices: [] }],
    activity: [{ id: "a7", date: "2026-07-09", type: "call", user: "Josh Bell", summary: "Intro call — qualified budget and timeline." }],
    notes: [],
    revenueHistory: [{ month: "Feb", value: 0 }, { month: "Mar", value: 0 }, { month: "Apr", value: 0 }, { month: "May", value: 0 }, { month: "Jun", value: 0 }, { month: "Jul", value: 0 }],
  },
  {
    id: "c4", name: "Union Square Markets", industry: "Grocery", city: "San Francisco, CA",
    rep: "Maria Chen", stage: "Contacted", status: "risk", dealValue: 15000,
    createdDate: "2026-06-10", lastContact: "2026-06-24", nextFollowUp: "2026-07-13",
    interest: "Went quiet after initial pricing call. Original champion may have left the company.",
    contacts: [{ id: "p5", name: "Marcus Lee", role: "Facilities Lead", email: "mlee@unionsquaremkts.com", phone: "(415) 555-0133", primary: true }],
    outlets: [{ id: "o5", name: "Union Square Markets – SoMa", address: "500 Folsom St, San Francisco, CA", devices: [] }],
    activity: [
      { id: "a8", date: "2026-06-24", type: "email", user: "Maria Chen", summary: "Followed up on pricing questions — no response." },
      { id: "a9", date: "2026-06-15", type: "call", user: "Maria Chen", summary: "Initial pricing discussion, positive tone." },
    ],
    notes: [{ id: "n3", date: "2026-06-24", author: "Maria Chen", text: "Try reaching out via LinkedIn — email may be going stale." }],
    revenueHistory: [{ month: "Feb", value: 0 }, { month: "Mar", value: 0 }, { month: "Apr", value: 0 }, { month: "May", value: 0 }, { month: "Jun", value: 0 }, { month: "Jul", value: 0 }],
  },
  {
    id: "c5", name: "Pacific Fuel Stops", industry: "Fuel & Convenience", city: "Sacramento, CA",
    rep: "Josh Bell", stage: "Won", status: "healthy", dealValue: 94000,
    createdDate: "2026-04-01", lastContact: "2026-07-10", nextFollowUp: "2026-08-01",
    interest: "Signed for 14 sites. Now in phased rollout — expansion opportunity for EV charger monitoring.",
    contacts: [{ id: "p6", name: "Renee Ford", role: "Regional Director", email: "renee@pacificfuel.com", phone: "(916) 555-0188", primary: true }],
    outlets: [
      { id: "o6", name: "Pacific Fuel – I-80 Hub", address: "2100 W El Camino Ave, Sacramento, CA", devices: [
        { id: "d5", type: "Smart Router X2", serial: "RX2-77120", status: "online", installed: "2026-06-01" },
        { id: "d6", type: "Payment Gateway", serial: "PG-11029", status: "online", installed: "2026-06-01" },
      ]},
    ],
    activity: [
      { id: "a10", date: "2026-07-10", type: "install", user: "Field Team", summary: "Installed 3rd of 14 sites, on schedule." },
      { id: "a11", date: "2026-06-01", type: "meeting", user: "Josh Bell", summary: "Kickoff call with rollout project team." },
    ],
    notes: [{ id: "n4", date: "2026-06-01", author: "Josh Bell", text: "Flag for upsell: EV charger monitoring add-on once rollout completes." }],
    revenueHistory: [{ month: "Feb", value: 0 }, { month: "Mar", value: 0 }, { month: "Apr", value: 0 }, { month: "May", value: 0 }, { month: "Jun", value: 6700 }, { month: "Jul", value: 13400 }],
  },
  {
    id: "c6", name: "Ridgeline Fitness Clubs", industry: "Fitness", city: "Salt Lake City, UT",
    rep: "Maria Chen", stage: "Negotiation", status: "risk", dealValue: 33000,
    createdDate: "2026-05-20", lastContact: "2026-06-20", nextFollowUp: "2026-07-14",
    interest: "Negotiating contract length — wants 12-month instead of 24-month term.",
    contacts: [{ id: "p7", name: "Tom Bradley", role: "Owner", email: "tom@ridgelinefit.com", phone: "(801) 555-0166", primary: true }],
    outlets: [{ id: "o7", name: "Ridgeline – Sugar House", address: "2100 S 700 E, Salt Lake City, UT", devices: [
      { id: "d7", type: "Smart Router X2", serial: "RX2-65310", status: "online", installed: "2026-05-28" },
    ]}],
    activity: [
      { id: "a12", date: "2026-06-20", type: "call", user: "Maria Chen", summary: "Pushed back on 24-month term, wants flexibility." },
      { id: "a13", date: "2026-06-05", type: "install", user: "Field Team", summary: "Pilot install completed at Sugar House location." },
    ],
    notes: [{ id: "n5", date: "2026-06-20", author: "Maria Chen", text: "Stalled 24 days — needs a decision this week or deal is at risk." }],
    revenueHistory: [{ month: "Feb", value: 0 }, { month: "Mar", value: 0 }, { month: "Apr", value: 0 }, { month: "May", value: 0 }, { month: "Jun", value: 1800 }, { month: "Jul", value: 1800 }],
  },
  {
    id: "c7", name: "Solstice Coffee Co.", industry: "Coffee & Cafe", city: "Portland, OR",
    rep: "Josh Bell", stage: "Proposal", status: "attention", dealValue: 27000,
    createdDate: "2026-06-15", lastContact: "2026-07-06", nextFollowUp: "2026-07-14",
    interest: "8-location chain, wants guest WiFi analytics bundled in. Comparing 2 vendors.",
    contacts: [{ id: "p8", name: "Emma Ostrowski", role: "Operations Manager", email: "emma@solsticecoffee.com", phone: "(503) 555-0121", primary: true }],
    outlets: [{ id: "o8", name: "Solstice – Pearl District", address: "1200 NW Everett St, Portland, OR", devices: [] }],
    activity: [{ id: "a14", date: "2026-07-06", type: "email", user: "Josh Bell", summary: "Sent comparison sheet against their current provider." }],
    notes: [{ id: "n6", date: "2026-07-06", author: "Josh Bell", text: "Decision expected by end of month, keep proposal visible." }],
    revenueHistory: [{ month: "Feb", value: 0 }, { month: "Mar", value: 0 }, { month: "Apr", value: 0 }, { month: "May", value: 0 }, { month: "Jun", value: 0 }, { month: "Jul", value: 0 }],
  },
  {
    id: "c8", name: "Anchor Point Logistics", industry: "Warehousing", city: "Memphis, TN",
    rep: "Josh Bell", stage: "Lost", status: "healthy", dealValue: 18000,
    createdDate: "2026-04-20", lastContact: "2026-05-25", nextFollowUp: null,
    interest: "Went with an in-house IT solution instead. Revisit in 6 months.",
    contacts: [{ id: "p9", name: "Wayne Griggs", role: "IT Director", email: "wgriggs@anchorpointlog.com", phone: "(901) 555-0155" }],
    outlets: [],
    activity: [{ id: "a15", date: "2026-05-25", type: "call", user: "Josh Bell", summary: "Told us they're building an internal solution instead." }],
    notes: [{ id: "n7", date: "2026-05-25", author: "Josh Bell", text: "Set a reminder to check back in around November." }],
    revenueHistory: [{ month: "Feb", value: 0 }, { month: "Mar", value: 0 }, { month: "Apr", value: 0 }, { month: "May", value: 0 }, { month: "Jun", value: 0 }, { month: "Jul", value: 0 }],
  },
];

const TASKS = [
  { id: "t1", title: "Send redlined contract back to legal", company: "Brightside Diners", due: "2026-07-12", type: "email", done: false },
  { id: "t2", title: "Re-engage via LinkedIn — champion may have left", company: "Union Square Markets", due: "2026-07-13", type: "call", done: false },
  { id: "t3", title: "Follow up on 12-month term ask", company: "Ridgeline Fitness Clubs", due: "2026-07-14", type: "call", done: false },
  { id: "t4", title: "Check in on WiFi upgrade timeline", company: "Camden Hotels", due: "2026-07-14", type: "meeting", done: false },
  { id: "t5", title: "Confirm proposal received, answer questions", company: "Northgate Retail Group", due: "2026-07-17", type: "email", done: false },
  { id: "t6", title: "Site visit — 4th install of rollout", company: "Pacific Fuel Stops", due: "2026-07-18", type: "meeting", done: false },
];

const CLOSED_WON_HISTORY = [29, 41, 22, 35, 30, 44, 27, 33, 38, 25, 31, 46, 28, 36];
const CLOSED_LOST_COUNT = 6;

/* ============================== HELPERS ============================== */
const fmtMoney = (n) => "$" + Math.round(n).toLocaleString();
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const daysSince = (d) => daysBetween(d, TODAY);
const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

const ACTIVITY_ICON = { call: PhoneCall, email: MailIcon, meeting: Users, install: Wrench, note: StickyNote };

function pipelineHealth() {
  const overdue = TASKS.filter((t) => !t.done && daysBetween(t.due, TODAY) > 0).length;
  const avgDays = Math.round(CLOSED_WON_HISTORY.reduce((a, b) => a + b, 0) / CLOSED_WON_HISTORY.length);
  const conversion = Math.round((CLOSED_WON_HISTORY.length / (CLOSED_WON_HISTORY.length + CLOSED_LOST_COUNT)) * 100);
  return { overdue, avgDays, conversion };
}

function forecastedRevenue() {
  const active = COMPANIES.filter((c) => c.stage !== "Won" && c.stage !== "Lost");
  const weighted = active.reduce((sum, c) => sum + c.dealValue * STAGE_PROB[c.stage], 0);
  const recognizedMRR = COMPANIES.filter((c) => c.stage === "Won").reduce((sum, c) => {
    const h = c.revenueHistory;
    return sum + h[h.length - 1].value;
  }, 0);
  return { total: weighted + recognizedMRR, weighted, recognizedMRR };
}

function riskyCompanies() {
  return COMPANIES.filter((c) => c.stage !== "Won" && c.stage !== "Lost")
    .map((c) => {
      const stale = daysSince(c.lastContact);
      const reasons = [];
      if (c.status === "risk") reasons.push("Marked at risk");
      if (stale > 14) reasons.push(`No contact in ${stale} days`);
      return { ...c, stale, reasons };
    })
    .filter((c) => c.reasons.length > 0)
    .sort((a, b) => b.dealValue - a.dealValue);
}

function highPriorityActions() {
  const items = [];
  TASKS.filter((t) => !t.done && daysBetween(t.due, TODAY) >= 0).forEach((t) => {
    const overdue = daysBetween(t.due, TODAY) > 0;
    items.push({
      key: "task-" + t.id, kind: overdue ? "Overdue" : "Due Today",
      title: t.title, sub: t.company, urgency: overdue ? 3 : 2,
      icon: overdue ? AlertTriangle : Clock,
    });
  });
  riskyCompanies().forEach((c) => {
    items.push({
      key: "risk-" + c.id, kind: "At Risk", title: `${c.name} — ${c.reasons[0]}`,
      sub: fmtMoney(c.dealValue) + " deal", urgency: c.status === "risk" ? 3 : 1, icon: Flame,
    });
  });
  return items.sort((a, b) => b.urgency - a.urgency).slice(0, 6);
}

/* ============================== SMALL UI PRIMITIVES ============================== */
function StatusDot({ status, size = 8 }) {
  const c = STATUS_META[status]?.color || T.textFaint;
  return (
    <span
      style={{
        display: "inline-block", width: size, height: size, borderRadius: "50%",
        background: c, boxShadow: `0 0 6px ${c}99`, flexShrink: 0,
      }}
    />
  );
}

function DeviceStatus({ status }) {
  const online = status === "online";
  const Icon = online ? Wifi : WifiOff;
  const c = online ? T.teal : T.red;
  return (
    <span className="inline-flex items-center gap-1 text-xs" style={{ color: c, fontFamily: T.fontMono }}>
      <Icon size={12} /> {online ? "online" : "offline"}
    </span>
  );
}

function Card({ children, className = "", style = {} }) {
  return (
    <div
      className={`rounded-xl p-5 ${className}`}
      style={{ background: T.surface, border: `1px solid ${T.border}`, ...style }}
    >
      {children}
    </div>
  );
}

function CardTitle({ icon: Icon, children, right }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} style={{ color: T.amber }} />}
        <h3 className="text-sm font-semibold tracking-wide" style={{ color: T.text, fontFamily: T.fontDisplay }}>
          {children}
        </h3>
      </div>
      {right}
    </div>
  );
}

function StageBadge({ stage }) {
  const map = {
    Lead: T.textDim, Contacted: T.textDim, Proposal: T.amber,
    Negotiation: T.amber, Won: T.teal, Lost: T.red,
  };
  const c = map[stage] || T.textDim;
  return (
    <span
      className="text-[11px] px-2 py-0.5 rounded-full font-medium"
      style={{ color: c, border: `1px solid ${c}55`, background: `${c}14`, fontFamily: T.fontMono }}
    >
      {stage}
    </span>
  );
}

/* ============================== SIDEBAR ============================== */
function Sidebar({ page, setPage, setSelectedCompanyId }) {
  const items = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "companies", label: "Companies", icon: Building2 },
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
          <div
            className="flex items-center justify-center rounded-lg"
            style={{ width: 30, height: 30, background: T.amber }}
          >
            <Wifi size={16} color={T.bg} />
          </div>
          <span style={{ fontFamily: T.fontDisplay, fontWeight: 700, letterSpacing: 1, color: T.text, fontSize: 17 }}>
            LEMO
          </span>
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
      <div className="px-5 py-4 flex items-center gap-2" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
        <div
          className="rounded-full flex items-center justify-center text-xs font-semibold"
          style={{ width: 28, height: 28, background: T.surface2, color: T.teal, fontFamily: T.fontMono }}
        >
          MC
        </div>
        <div>
          <div className="text-xs font-medium" style={{ color: T.text }}>Maria Chen</div>
          <div className="text-[11px]" style={{ color: T.textFaint }}>Sales · Lemo</div>
        </div>
      </div>
    </div>
  );
}

/* ============================== OVERVIEW PAGE ============================== */
function OverviewPage({ goToCompany }) {
  const health = pipelineHealth();
  const forecast = forecastedRevenue();
  const risks = riskyCompanies();
  const priorities = highPriorityActions();
  const todayTasks = TASKS.filter((t) => t.due === "2026-07-14" && !t.done);
  const forecastTrend = [
    { m: "Feb", v: 6200 }, { m: "Mar", v: 6200 }, { m: "Apr", v: 6200 },
    { m: "May", v: 9400 }, { m: "Jun", v: 19500 }, { m: "Jul", v: forecast.total },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 style={{ fontFamily: T.fontDisplay, fontSize: 24, fontWeight: 600, color: T.text }}>
          Good morning, Maria
        </h1>
        <p className="text-sm mt-1" style={{ color: T.textDim }}>
          Tuesday, July 14 — here's what needs your attention today.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <CardTitle icon={Flame}>High Priority Actions</CardTitle>
          <div className="flex flex-col divide-y" style={{ borderColor: T.borderSoft }}>
            {priorities.map((p) => (
              <div key={p.key} className="flex items-center gap-3 py-2.5" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
                <p.icon size={15} style={{ color: p.urgency === 3 ? T.red : T.amber, flexShrink: 0 }} />
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
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle icon={DollarSign}>Forecasted Revenue</CardTitle>
          <div style={{ fontFamily: T.fontMono, fontSize: 26, fontWeight: 600, color: T.teal }}>
            {fmtMoney(forecast.total)}
          </div>
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
            Revenue at risk:{" "}
            <span style={{ color: T.red, fontFamily: T.fontMono }}>
              {fmtMoney(risks.reduce((s, c) => s + c.dealValue, 0))}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {risks.slice(0, 3).map((c) => (
              <button
                key={c.id}
                onClick={() => goToCompany(c.id)}
                className="text-left flex items-center gap-2 rounded-lg px-2 py-1.5 -mx-2"
                style={{ background: T.surface2 }}
              >
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
function CompaniesPage({ goToCompany }) {
  const [q, setQ] = useState("");
  const filtered = COMPANIES.filter((c) =>
    [c.name, c.city, c.industry].join(" ").toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }}>Companies</h1>
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2"
          style={{ background: T.surface, border: `1px solid ${T.border}`, width: 280 }}
        >
          <Search size={14} style={{ color: T.textFaint }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search company, city, industry…"
            className="bg-transparent outline-none text-sm w-full"
            style={{ color: T.text, fontFamily: T.fontBody }}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {filtered.map((c) => (
          <button
            key={c.id}
            onClick={() => goToCompany(c.id)}
            className="text-left rounded-xl p-4 transition-transform hover:-translate-y-0.5"
            style={{ background: T.surface, border: `1px solid ${T.border}` }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <StatusDot status={c.status} />
                <span className="text-sm font-semibold truncate" style={{ color: T.text, fontFamily: T.fontDisplay }}>
                  {c.name}
                </span>
              </div>
              <StageBadge stage={c.stage} />
            </div>
            <div className="text-xs mb-3" style={{ color: T.textFaint }}>{c.industry} · {c.city}</div>
            <div className="flex items-center justify-between text-xs" style={{ color: T.textDim }}>
              <span style={{ fontFamily: T.fontMono, color: T.teal }}>{fmtMoney(c.dealValue)}</span>
              <span>Last contact {fmtDate(c.lastContact)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============================== COMPANY PROFILE ============================== */
function CompanyProfile({ company, back }) {
  const refs = {
    overview: useRef(null), contacts: useRef(null), locations: useRef(null),
    activity: useRef(null), revenue: useRef(null), notes: useRef(null),
  };
  const scrollTo = (key) => refs[key].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const sortedActivity = [...company.activity].sort((a, b) => new Date(b.date) - new Date(a.date));

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
          </div>
          <div className="text-sm" style={{ color: T.textDim }}>{company.industry} · {company.city} · Rep: {company.rep}</div>
        </div>
        <div className="text-right">
          <div style={{ fontFamily: T.fontMono, fontSize: 22, color: T.teal }}>{fmtMoney(company.dealValue)}</div>
          <div className="text-xs" style={{ color: T.textFaint }}>deal value</div>
        </div>
      </div>

      <div
        className="flex gap-1 mb-5 px-1 py-1 rounded-lg sticky top-0 z-10"
        style={{ background: T.surface, border: `1px solid ${T.border}` }}
      >
        {[
          ["overview", "Overview"], ["contacts", "Contacts"], ["locations", "Locations & Devices"],
          ["activity", "Activity"], ["revenue", "Revenue"], ["notes", "Notes"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => scrollTo(key)}
            className="text-xs px-3 py-1.5 rounded-md"
            style={{ color: T.textDim, fontFamily: T.fontBody }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <Card style={{ scrollMarginTop: 70 }}>
          <div ref={refs.overview} />
          <CardTitle icon={Building2}>Overview</CardTitle>
          <p className="text-sm mb-4" style={{ color: T.text, lineHeight: 1.6 }}>{company.interest}</p>
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <div style={{ color: T.textFaint }}>Next follow-up</div>
              <div className="mt-1" style={{ color: T.text, fontFamily: T.fontMono }}>
                {company.nextFollowUp ? fmtDate(company.nextFollowUp) : "—"}
              </div>
            </div>
            <div>
              <div style={{ color: T.textFaint }}>Last contact</div>
              <div className="mt-1" style={{ color: T.text, fontFamily: T.fontMono }}>{fmtDate(company.lastContact)}</div>
            </div>
            <div>
              <div style={{ color: T.textFaint }}>In pipeline since</div>
              <div className="mt-1" style={{ color: T.text, fontFamily: T.fontMono }}>{fmtDate(company.createdDate)}</div>
            </div>
          </div>
        </Card>

        <Card style={{ scrollMarginTop: 70 }}>
          <div ref={refs.contacts} />
          <CardTitle icon={Users}>Contacts</CardTitle>
          <div className="grid grid-cols-2 gap-3">
            {company.contacts.map((p) => (
              <div key={p.id} className="rounded-lg p-3" style={{ background: T.surface2 }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium" style={{ color: T.text }}>{p.name}</span>
                  {p.primary && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: T.amber, background: `${T.amber}14` }}>
                      Primary
                    </span>
                  )}
                </div>
                <div className="text-xs mb-2" style={{ color: T.textFaint }}>{p.role}</div>
                <div className="flex flex-col gap-1 text-xs" style={{ color: T.textDim }}>
                  <a href={`mailto:${p.email}`} className="flex items-center gap-1.5 hover:underline">
                    <Mail size={11} /> {p.email}
                  </a>
                  <a href={`tel:${p.phone}`} className="flex items-center gap-1.5 hover:underline">
                    <Phone size={11} /> {p.phone}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card style={{ scrollMarginTop: 70 }}>
          <div ref={refs.locations} />
          <CardTitle icon={MapPin}>Locations & Devices</CardTitle>
          {company.outlets.length === 0 ? (
            <p className="text-xs" style={{ color: T.textFaint }}>No outlets on file yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {company.outlets.map((o) => (
                <div key={o.id} className="rounded-lg p-3" style={{ background: T.surface2 }}>
                  <div className="text-sm font-medium mb-0.5" style={{ color: T.text }}>{o.name}</div>
                  <div className="text-xs mb-2" style={{ color: T.textFaint }}>{o.address}</div>
                  {o.devices.length === 0 ? (
                    <div className="text-xs" style={{ color: T.textFaint }}>No devices installed yet.</div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {o.devices.map((d) => (
                        <div key={d.id} className="flex items-center justify-between text-xs py-1" style={{ borderTop: `1px solid ${T.border}`, color: T.textDim }}>
                          <span>{d.type} <span style={{ color: T.textFaint, fontFamily: T.fontMono }}>· {d.serial}</span></span>
                          <DeviceStatus status={d.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card style={{ scrollMarginTop: 70 }}>
          <div ref={refs.activity} />
          <CardTitle icon={Clock}>Activity Timeline</CardTitle>
          <div className="flex flex-col">
            {sortedActivity.map((a, i) => {
              const Icon = ACTIVITY_ICON[a.type] || StickyNote;
              return (
                <div key={a.id} className="flex gap-3 pb-4 relative">
                  {i < sortedActivity.length - 1 && (
                    <div className="absolute left-[9px] top-6 bottom-0 w-px" style={{ background: T.border }} />
                  )}
                  <div
                    className="rounded-full flex items-center justify-center shrink-0 z-10"
                    style={{ width: 20, height: 20, background: T.surface2, border: `1px solid ${T.border}` }}
                  >
                    <Icon size={11} style={{ color: T.amber }} />
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: T.textFaint, fontFamily: T.fontMono }}>
                      {fmtDate(a.date)} · {a.user}
                    </div>
                    <div className="text-sm mt-0.5" style={{ color: T.text }}>{a.summary}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card style={{ scrollMarginTop: 70 }}>
          <div ref={refs.revenue} />
          <CardTitle icon={DollarSign}>Revenue</CardTitle>
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
function AIPage() {
  const [companyId, setCompanyId] = useState(COMPANIES[0].id);
  const [emailType, setEmailType] = useState("Cold Outreach");
  const [context, setContext] = useState(COMPANIES[0].interest);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const company = COMPANIES.find((c) => c.id === companyId);
  const primaryContact = company?.contacts.find((p) => p.primary) || company?.contacts[0];

  const handleCompanyChange = (id) => {
    setCompanyId(id);
    const c = COMPANIES.find((cc) => cc.id === id);
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
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      const text = data.content?.map((b) => b.text || "").join("\n").trim();
      if (!text) throw new Error("No response from model");
      const [subjectLine, ...rest] = text.split("\n");
      setResult({
        subject: subjectLine.replace(/^Subject:\s*/i, ""),
        body: rest.join("\n").trim(),
      });
    } catch (e) {
      setError("Couldn't generate a draft right now. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyAll = () => {
    if (!result) return;
    navigator.clipboard.writeText(`Subject: ${result.subject}\n\n${result.body}`);
  };

  return (
    <div>
      <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }} className="mb-1">
        AI Outreach
      </h1>
      <p className="text-sm mb-5" style={{ color: T.textDim }}>
        Pick a company and let AI draft the first outreach email, grounded in what's actually in their file.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: T.textFaint }}>Company</label>
              <select
                value={companyId}
                onChange={(e) => handleCompanyChange(e.target.value)}
                className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody }}
              >
                {COMPANIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: T.textFaint }}>Email type</label>
              <select
                value={emailType}
                onChange={(e) => setEmailType(e.target.value)}
                className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody }}
              >
                {["Cold Outreach", "Follow-up", "Re-engagement", "Check-in"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: T.textFaint }}>Context for the AI</label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={5}
                className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-none"
                style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody }}
              />
            </div>
            {primaryContact && (
              <div className="text-xs" style={{ color: T.textFaint }}>
                Sending to: <span style={{ color: T.textDim }}>{primaryContact.name}, {primaryContact.role}</span>
              </div>
            )}
            <button
              onClick={generate}
              disabled={loading}
              className="flex items-center justify-center gap-2 text-sm font-medium rounded-lg py-2.5 mt-1"
              style={{ background: T.amber, color: T.bg, fontFamily: T.fontBody, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {loading ? "Drafting…" : "Generate draft"}
            </button>
          </div>
        </Card>

        <Card>
          <CardTitle icon={Send} right={result && (
            <button onClick={copyAll} className="flex items-center gap-1 text-xs" style={{ color: T.textDim }}>
              <Copy size={12} /> Copy
            </button>
          )}>
            Draft
          </CardTitle>
          {!result && !loading && !error && (
            <div className="flex items-center justify-center h-48 text-xs text-center" style={{ color: T.textFaint }}>
              Your generated email will appear here.
            </div>
          )}
          {loading && (
            <div className="flex items-center justify-center h-48 text-xs" style={{ color: T.textFaint }}>
              <Loader2 size={16} className="animate-spin mr-2" /> Writing draft…
            </div>
          )}
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
function RevenuePage() {
  const months = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  const monthly = months.map((m, i) => ({
    month: m,
    actual: COMPANIES.reduce((s, c) => s + c.revenueHistory[i].value, 0),
  }));
  const forecast = forecastedRevenue();
  const withForecast = [...monthly, { month: "Aug", forecast: Math.round(forecast.total * 1.05) }, { month: "Sep", forecast: Math.round(forecast.total * 1.12) }];
  withForecast[monthly.length - 1].forecast = monthly[monthly.length - 1].actual;

  const byCompany = [...COMPANIES]
    .map((c) => ({ ...c, thisMonth: c.revenueHistory[c.revenueHistory.length - 1].value, lastMonth: c.revenueHistory[c.revenueHistory.length - 2].value }))
    .filter((c) => c.thisMonth > 0 || c.lastMonth > 0)
    .sort((a, b) => b.thisMonth - a.thisMonth);

  const totalThisMonth = byCompany.reduce((s, c) => s + c.thisMonth, 0);

  return (
    <div>
      <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }} className="mb-5">Revenue</h1>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <Card>
          <div className="text-xs mb-1" style={{ color: T.textFaint }}>This month (actual)</div>
          <div style={{ fontFamily: T.fontMono, fontSize: 24, color: T.teal }}>{fmtMoney(totalThisMonth)}</div>
        </Card>
        <Card>
          <div className="text-xs mb-1" style={{ color: T.textFaint }}>Forecasted (weighted pipeline)</div>
          <div style={{ fontFamily: T.fontMono, fontSize: 24, color: T.amber }}>{fmtMoney(forecast.weighted)}</div>
        </Card>
        <Card>
          <div className="text-xs mb-1" style={{ color: T.textFaint }}>Recurring from won deals</div>
          <div style={{ fontFamily: T.fontMono, fontSize: 24, color: T.text }}>{fmtMoney(forecast.recognizedMRR)}</div>
        </Card>
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
          <div className="grid grid-cols-4 text-[11px] uppercase tracking-wide pb-2" style={{ color: T.textFaint, borderBottom: `1px solid ${T.border}` }}>
            <span>Company</span><span>This month</span><span>Last month</span><span>Trend</span>
          </div>
          {byCompany.map((c) => {
            const up = c.thisMonth >= c.lastMonth;
            return (
              <div key={c.id} className="grid grid-cols-4 items-center text-sm py-2.5" style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                <div className="flex items-center gap-2"><StatusDot status={c.status} /> <span style={{ color: T.text }}>{c.name}</span></div>
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
function PipelinePage({ goToCompany }) {
  return (
    <div>
      <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }} className="mb-5">Pipeline</h1>
      <div className="grid grid-cols-6 gap-3 items-start">
        {STAGE_ORDER.map((stage) => {
          const deals = COMPANIES.filter((c) => c.stage === stage);
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
                    <button
                      key={c.id}
                      onClick={() => goToCompany(c.id)}
                      className="text-left rounded-lg p-2.5"
                      style={{ background: T.surface2, border: `1px solid ${T.borderSoft}` }}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <StatusDot status={c.status} size={6} />
                        <span className="text-xs font-medium truncate" style={{ color: T.text }}>{c.name}</span>
                      </div>
                      <div className="text-[11px]" style={{ color: T.teal, fontFamily: T.fontMono }}>{fmtMoney(c.dealValue)}</div>
                      <div className="text-[10px] mt-1" style={{ color: T.textFaint }}>{days}d in pipeline · {c.rep}</div>
                    </button>
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
  const [page, setPage] = useState("overview");
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);

  const goToCompany = (id) => { setSelectedCompanyId(id); setPage("companies"); };
  const selectedCompany = COMPANIES.find((c) => c.id === selectedCompanyId);

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
        <Sidebar page={page} setPage={setPage} setSelectedCompanyId={setSelectedCompanyId} />
        <div className="flex-1 p-6 overflow-x-hidden">
          {page === "overview" && <OverviewPage goToCompany={goToCompany} />}
          {page === "companies" && !selectedCompany && <CompaniesPage goToCompany={goToCompany} />}
          {page === "companies" && selectedCompany && (
            <CompanyProfile company={selectedCompany} back={() => setSelectedCompanyId(null)} />
          )}
          {page === "ai" && <AIPage />}
          {page === "revenue" && <RevenuePage />}
          {page === "pipeline" && <PipelinePage goToCompany={goToCompany} />}
        </div>
      </div>
    </div>
  );
}
