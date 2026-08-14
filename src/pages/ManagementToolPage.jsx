import React from "react";
import {
  ExternalLink, Info, Table2, ListOrdered, CheckSquare, ShieldCheck,
} from "lucide-react";
import { T } from "../theme.js";
import { Card, CardTitle } from "../components/ui.jsx";

const MANAGEMENT_TOOL_URL = "https://script.google.com/a/macros/lemowellness.com/s/AKfycbzwsRT9DjjsMvogHMNBjbKtkBaqgU6Z7sWM2D83UcT6Kii2Kwc3So_0TE0A-_bBCw-3pw/exec";

const WHO_SEES_IT = [
  {
    tool: "Lemo CRM",
    who: "Everyone — Owners, Partners, Consultants",
    what: "Leads, deals, pipeline stage, showroom bookings — plus, on each Company's page, a simple snapshot of that company's revenue and chair usage.",
  },
  {
    tool: "Management Tool",
    who: "Owners only",
    what: "Full company financials (income and expenses), plus the deep-dive usage numbers — seating count, idle/occupied count, scans, conversion %, and more.",
  },
];

const STEPS = [
  "Anyone — Owner, Partner, or Consultant — adds a new lead to the CRM as a Company, sets the stage to “Lead,” and assigns a rep.",
  "Move it through the Pipeline as things progress: Contacted → Proposal → Negotiation. Keep notes on the company card. Everyone can do this.",
  "If the prospect wants to try a chair, book it in the CRM's Showroom tab.",
  "Deal closes and the chair goes in. Move the company to “Installed” in the CRM Pipeline.",
  "Whoever runs the install completes the pre-install checklist right on the company's CRM page. That's the one place it lives, so no Management Tool access is needed to finish it.",
  "An Owner adds the new location to the Management Tool so its full financials and usage tracking switch on.",
  "From here on, that company's CRM page shows a running snapshot of its revenue and usage — visible to everyone, so the whole team can see at a glance how it's doing.",
  "Once a month, an Owner runs the Monthly Check below to make sure the CRM snapshot and the full Management Tool numbers agree.",
  "If usage or revenue ever looks low — whether someone spots it in the CRM snapshot or an Owner sees it in the Management Tool — move the company to “Stay in Contact” in the CRM and flag it for a follow-up call.",
];

const MONTHLY_CHECK = [
  "Open the CRM → Revenue → Revenue by Company. Note each location's number for the month.",
  "Open the Management Tool → Monthly Overview. Compare its numbers to what the CRM shows.",
  "If the two don't match, don't guess — find out why (a missed entry, a timing lag) and fix it.",
  "Open the Management Tool → Usage tab. Look for any location with a lot of “idle” time and very little “occupied” time.",
  "For any low-usage location, add a note on its CRM company page and consider moving it to “Stay in Contact” so the assigned rep checks in.",
  "Confirm every company that moved to “Installed” in the Pipeline this month is also showing up in the Management Tool.",
  "Confirm the revenue and usage snapshot on each company's CRM page still matches the full numbers in the Management Tool.",
];

const GOLDEN_RULES = [
  "Everyone lives in the CRM day to day. Only Owners go into the Management Tool.",
  "The CRM's Company page shows the basics — revenue and usage — for everyone. The deep-dive numbers (seating count, idle count, conversion %) stay in the Management Tool, for Owners only.",
  "The pre-install checklist lives in the CRM, not the Management Tool, so anyone running an install can complete it without needing Owner access.",
  "If the CRM snapshot and the Management Tool numbers don't match, that's an Owner-only check — don't guess, dig into both.",
  "If a company's numbers look low on the CRM snapshot, flag it — an Owner can then pull the full picture from the Management Tool before deciding next steps.",
];

export default function ManagementToolPage() {
  return (
    <div>
      <div className="mb-5">
        <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }}>Management Tool</h1>
        <p className="text-sm mt-1" style={{ color: T.textDim }}>
          Internal SOP — using the CRM and the Management Tool together. Last updated August 14, 2026 · Owner: Justin
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Card style={{ border: `1px solid ${T.amber}40` }}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold mb-1" style={{ color: T.text, fontFamily: T.fontBody }}>Open the Management Tool</h3>
              <p className="text-xs" style={{ color: T.textFaint }}>
                Full financials and deep-dive usage numbers — opens in a new tab.
              </p>
            </div>
            <a
              href={MANAGEMENT_TOOL_URL} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium rounded-lg px-4 py-2.5 shrink-0"
              style={{ background: T.amber, color: T.bg, fontFamily: T.fontBody }}
            >
              Open Management Tool <ExternalLink size={15} />
            </a>
          </div>
        </Card>

        <div className="rounded-xl p-4" style={{ background: `${T.amber}0d`, border: `1px solid ${T.amber}30` }}>
          <div className="flex items-center gap-2 mb-1.5">
            <Info size={14} style={{ color: T.amber }} />
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: T.amber, fontFamily: T.fontMono }}>The one-sentence version</span>
          </div>
          <p className="text-sm" style={{ color: T.text }}>
            Everyone — Owners, Partners, Consultants — lives in the CRM day to day. Only Owners go into the Management Tool, for full financials and the deep-dive usage numbers, and reconcile the two once a month.
          </p>
        </div>

        <Card>
          <CardTitle icon={Table2}>What Each Tool Is For — and Who Sees It</CardTitle>
          <div className="flex flex-col gap-3">
            {WHO_SEES_IT.map((row) => (
              <div key={row.tool} className="rounded-lg p-3" style={{ background: T.surface2 }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold" style={{ color: T.text }}>{row.tool}</span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ color: row.who === "Owners only" ? T.red : T.teal, border: `1px solid ${row.who === "Owners only" ? T.red : T.teal}55`, background: `${row.who === "Owners only" ? T.red : T.teal}14`, fontFamily: T.fontMono }}
                  >
                    {row.who}
                  </span>
                </div>
                <p className="text-xs" style={{ color: T.textDim }}>{row.what}</p>
              </div>
            ))}
          </div>
          <p className="text-xs mt-3" style={{ color: T.textFaint }}>
            In short: the CRM's Company tab gives everyone the headline numbers for a company. The Management Tool is where those numbers get audited and broken down — and that view stays with Owners.
          </p>
        </Card>

        <Card>
          <CardTitle icon={ListOrdered}>Step by Step: The Life of a Location</CardTitle>
          <div className="flex flex-col">
            {STEPS.map((step, i) => (
              <div
                key={step}
                className="flex gap-3 py-3"
                style={{ borderBottom: i < STEPS.length - 1 ? `1px solid ${T.borderSoft}` : "none" }}
              >
                <div
                  className="flex items-center justify-center rounded-full shrink-0"
                  style={{ width: 22, height: 22, background: `${T.amber}14`, border: `1px solid ${T.amber}40`, color: T.amber, fontFamily: T.fontMono, fontSize: 11, fontWeight: 600 }}
                >
                  {i + 1}
                </div>
                <p className="text-sm" style={{ color: T.textDim }}>{step}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card style={{ border: `1px solid ${T.red}30` }}>
          <CardTitle icon={CheckSquare} right={<span className="text-[11px]" style={{ color: T.textFaint }}>~15 min · repeat every month</span>}>
            Monthly Check — Owners Only
          </CardTitle>
          <div className="flex flex-col gap-2">
            {MONTHLY_CHECK.map((item) => (
              <div key={item} className="flex items-start gap-2">
                <div
                  className="shrink-0 rounded"
                  style={{ width: 14, height: 14, border: `1px solid ${T.border}`, marginTop: 2 }}
                />
                <p className="text-sm" style={{ color: T.textDim }}>{item}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle icon={ShieldCheck}>Golden Rules</CardTitle>
          <div className="flex flex-col gap-2.5">
            {GOLDEN_RULES.map((rule) => (
              <div key={rule} className="flex items-start gap-2">
                <span style={{ color: T.amber, marginTop: 1 }}>—</span>
                <p className="text-sm" style={{ color: T.textDim }}>{rule}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
