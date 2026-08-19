import React from "react";
import { Flame, DollarSign, Activity } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { T, ACTIVITY_ICON } from "../theme.js";
import { Card, CardTitle } from "../components/ui.jsx";
import {
  fmtMoney, fmtDate, TODAY, pipelineHealth, forecastedRevenue, riskyCompanies, highPriorityActions, dealValueUsd,
} from "../lib/helpers.js";
import { useMasterAdminApprovals } from "../hooks/useMasterAdminApprovals.js";

export default function OverviewPage({ companies, tasks, notes, recentActivity, goToCompany, firstName, profile }) {
  const health = pipelineHealth(companies, tasks);
  const forecast = forecastedRevenue(companies);
  const risks = riskyCompanies(companies);
  // RLS-scoped to Master Admins only (master_admin_approvals_select) — a
  // harmless empty fetch for everyone else, so calling it unconditionally
  // here (rather than threading a single instance down as a prop) is safe;
  // unlike useAppSettings/subscribeToTables (see project infra notes), this
  // hook is a plain one-shot fetch with no realtime channel to double-join.
  const { approvals } = useMasterAdminApprovals();
  const priorities = highPriorityActions(tasks, companies, notes, profile, approvals);
  const revenueAtRisk = risks.reduce((s, c) => s + dealValueUsd(c), 0);

  const months = companies[0]?.revenueHistory.map((r) => r.month) || [];
  const forecastTrend = months.map((m, i) => ({
    m,
    v: i === months.length - 1
      ? forecast.total
      : companies.reduce((sum, c) => sum + (c.revenueHistory[i]?.value || 0), 0),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 style={{ fontFamily: T.fontDisplay, fontSize: 24, fontWeight: 600, color: T.text }}>
          Good morning{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-sm mt-1" style={{ color: T.textDim }}>
          {TODAY.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} — here's what needs your attention today.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <CardTitle icon={Flame}>High Priority Actions</CardTitle>

          <div
            className="flex items-center gap-4 text-xs mb-3 pb-3 flex-wrap"
            style={{ borderBottom: `1px solid ${T.borderSoft}`, color: T.textDim }}
          >
            <span>Overdue <b style={{ color: health.overdue > 0 ? T.red : T.text, fontFamily: T.fontMono }}>{health.overdue}</b></span>
            <span>Avg close <b style={{ color: T.text, fontFamily: T.fontMono }}>{health.avgDays != null ? `${health.avgDays}d` : "—"}</b></span>
            <span>Conversion <b style={{ color: T.teal, fontFamily: T.fontMono }}>{health.conversion != null ? `${health.conversion}%` : "—"}</b></span>
            <span>At risk <b style={{ color: T.red, fontFamily: T.fontMono }}>{fmtMoney(revenueAtRisk)}</b></span>
          </div>

          {priorities.length === 0 ? (
            <p className="text-xs" style={{ color: T.textFaint }}>Nothing urgent right now.</p>
          ) : (
            <div className="flex flex-col divide-y" style={{ borderColor: T.borderSoft }}>
              {priorities.map((p) => {
                const Row = p.companyId ? "button" : "div";
                return (
                  <Row
                    key={p.key}
                    onClick={p.companyId ? () => goToCompany(p.companyId) : undefined}
                    className="flex items-center gap-3 py-2.5 text-left w-full"
                    style={{ borderTop: `1px solid ${T.borderSoft}` }}
                  >
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
                  </Row>
                );
              })}
            </div>
          )}
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

      <Card>
        <CardTitle icon={Activity}>Recent Activity</CardTitle>
        {recentActivity.length === 0 ? (
          <p className="text-xs" style={{ color: T.textFaint }}>Nothing logged yet.</p>
        ) : (
          <div className="flex flex-col divide-y overflow-y-auto" style={{ borderColor: T.borderSoft, maxHeight: 480 }}>
            {recentActivity.map((a) => {
              const Icon = ACTIVITY_ICON[a.type] || Activity;
              const Row = a.companyId ? "button" : "div";
              return (
                <Row
                  key={a.id}
                  onClick={a.companyId ? () => goToCompany(a.companyId) : undefined}
                  className="flex items-center gap-3 py-2.5 text-left w-full"
                  style={{ borderTop: `1px solid ${T.borderSoft}` }}
                >
                  <div
                    className="rounded-full flex items-center justify-center shrink-0"
                    style={{ width: 22, height: 22, background: T.surface2, border: `1px solid ${T.border}` }}
                  >
                    <Icon size={11} style={{ color: T.amber }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate" style={{ color: T.text }}>{a.summary}</div>
                    <div className="text-xs truncate" style={{ color: T.textFaint }}>{a.userName} · {a.companyName}</div>
                  </div>
                  <span className="text-[11px] shrink-0" style={{ color: T.textFaint, fontFamily: T.fontMono }}>{fmtDate(a.date)}</span>
                </Row>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
