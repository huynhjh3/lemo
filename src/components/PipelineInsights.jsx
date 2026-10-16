import React from "react";
import { Percent, TrendingUp } from "lucide-react";
import { T } from "../theme.js";
import { Card, CardTitle } from "./ui.jsx";
import { fmtMoney, conversionRows, conversionTotal, pipelineProjection } from "../lib/helpers.js";

const pct = (n) => `${Math.round(n * 100)}%`;
const STAGE_COLS = ["Contacted", "Proposal", "Negotiation", "Installed"];

function Cell({ n, of }) {
  return (
    <span style={{ fontFamily: T.fontMono, color: T.text }}>
      {n}
      <span className="text-[10px] ml-1" style={{ color: T.textFaint }}>{of ? pct(n / of) : "–"}</span>
    </span>
  );
}

// Conversion is scoped by role: an Owner sees every BD plus the group, a
// Strategic Partner only their own region's companies, a BD Consultant just
// their own book (their `companies` is already limited to it by RLS).
export default function ConversionCard({ companies, profile }) {
  const role = profile?.role;
  const scoped = role === "geo_partner" ? companies.filter((c) => c.region === profile.region)
    : role === "bd_consultant" ? companies.filter((c) => c.repId === profile.id)
    : companies;
  const rows = conversionRows(scoped);
  const total = conversionTotal(scoped, role === "geo_partner" ? `${profile.region || "Your area"} total` : "All BDs");
  const title = role === "bd_consultant" ? "Your Conversion" : role === "geo_partner" ? `Conversion — ${profile.region || "Your Area"}` : "Conversion by BD";
  const showTotal = role !== "bd_consultant";

  const Row = ({ r, bold }) => (
    <div
      className="grid items-center text-sm py-2.5"
      style={{ gridTemplateColumns: "minmax(110px,1.4fr) 60px repeat(4, minmax(70px,1fr)) 70px", borderBottom: `1px solid ${T.borderSoft}`, fontWeight: bold ? 600 : 400, minWidth: 560 }}
    >
      <span style={{ color: T.text }}>{r.name}</span>
      <span style={{ fontFamily: T.fontMono, color: T.textDim }}>{r.sourced}</span>
      {STAGE_COLS.map((_, i) => <Cell key={i} n={r.reached[i + 1]} of={r.sourced} />)}
      <span style={{ fontFamily: T.fontMono, color: T.teal }}>{pct(r.winRate)}</span>
    </div>
  );

  return (
    <Card>
      <CardTitle icon={Percent}>{title}</CardTitle>
      {rows.length === 0 ? (
        <p className="text-xs" style={{ color: T.textFaint }}>No companies to measure yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <div
            className="grid text-[11px] uppercase tracking-wide pb-2"
            style={{ gridTemplateColumns: "minmax(110px,1.4fr) 60px repeat(4, minmax(70px,1fr)) 70px", color: T.textFaint, borderBottom: `1px solid ${T.border}`, minWidth: 560 }}
          >
            <span>BD</span><span>Sourced</span>{STAGE_COLS.map((s) => <span key={s}>{s}</span>)}<span>Win rate</span>
          </div>
          {rows.map((r) => <Row key={r.key} r={r} />)}
          {showTotal && rows.length > 1 && <Row r={total} bold />}
        </div>
      )}
      <p className="text-[11px] mt-3" style={{ color: T.textFaint, lineHeight: 1.5 }}>
        Win rate = companies that reached Installed ÷ companies sourced. Stage columns count companies that reached that stage at least once.
      </p>
    </Card>
  );
}

// Owner-only. See pipelineProjection (helpers.js) for the formula.
export function ProjectionCard({ companies }) {
  const proj = pipelineProjection(companies);
  const stages = ["Lead", "Contacted", "Proposal", "Negotiation"];
  return (
    <Card>
      <CardTitle icon={TrendingUp}>Projected Monthly Revenue</CardTitle>
      <div className="flex items-end gap-6 flex-wrap mb-3">
        <div>
          <div style={{ fontFamily: T.fontMono, fontSize: 26, fontWeight: 600, color: T.teal }}>{fmtMoney(proj.expected)}</div>
          <div className="text-xs" style={{ color: T.textFaint }}>expected per month from the open pipeline</div>
        </div>
        <div className="text-xs" style={{ color: T.textFaint, lineHeight: 1.6 }}>
          <div>{fmtMoney(proj.potential)}/mo if every open deal closed</div>
          <div>~{Math.round(proj.expectedChairs * 10) / 10} chairs expected to land</div>
        </div>
      </div>

      {proj.byRep.length > 0 && (
        <div className="overflow-x-auto">
          <div className="grid text-[11px] uppercase tracking-wide pb-2" style={{ gridTemplateColumns: "minmax(110px,1.4fr) 70px 70px 70px 90px", color: T.textFaint, borderBottom: `1px solid ${T.border}`, minWidth: 420 }}>
            <span>BD</span><span>Deals</span><span>Chairs</span><span>Factor</span><span>Expected/mo</span>
          </div>
          {proj.byRep.map((r) => (
            <div key={r.key} className="grid items-center text-sm py-2" style={{ gridTemplateColumns: "minmax(110px,1.4fr) 70px 70px 70px 90px", borderBottom: `1px solid ${T.borderSoft}`, minWidth: 420 }}>
              <span style={{ color: T.text }}>{r.name}</span>
              <span style={{ fontFamily: T.fontMono, color: T.textDim }}>{r.deals}</span>
              <span style={{ fontFamily: T.fontMono, color: T.textDim }}>{r.chairs}</span>
              <span style={{ fontFamily: T.fontMono, color: T.textDim }}>×{r.factor.toFixed(2)}</span>
              <span style={{ fontFamily: T.fontMono, color: T.teal }}>{fmtMoney(r.expected)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="text-[11px] mt-3" style={{ color: T.textFaint, lineHeight: 1.6 }}>
        <div>
          Each open deal = monthly value × the team's conversion odds for its stage × that BD's factor (their win rate ÷ the team's {pct(proj.teamWinRate)}; no adjustment under 8 sourced companies).
        </div>
        <div>
          Stage odds: {stages.map((s, i) => `${s} ${pct(proj.stageOdds[s].p)}${proj.stageOdds[s].fromHistory ? "" : "*"}`).join(" · ")}
          {stages.some((s) => !proj.stageOdds[s].fromHistory) && "  (* default — not enough history yet)"}
        </div>
        <div>
          Flat-fee deals use their deal value. Revenue-share deals use {fmtMoney(proj.perChair)}/mo per chair
          {proj.sampleChairs ? `, the last full month's average across ${proj.sampleChairs} installed chair${proj.sampleChairs === 1 ? "" : "s"}` : " (no installed revenue-share chairs to learn from yet)"}.
          Assumption-based until public deployments produce real usage.
        </div>
      </div>
    </Card>
  );
}
