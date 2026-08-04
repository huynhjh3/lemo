import React from "react";
import { Building2, TrendingUp, TrendingDown } from "lucide-react";
import {
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart, Bar, Line,
} from "recharts";
import { T } from "../theme.js";
import { Card, CardTitle, StatusDot } from "../components/ui.jsx";
import { fmtMoney, fmtCount, forecastedRevenue, recentMonths, monthLabel } from "../lib/helpers.js";

export default function RevenuePage({ companies, goToUsage }) {
  const months = recentMonths().map(monthLabel);
  const monthly = months.map((m, i) => ({
    month: m,
    actual: companies.reduce((s, c) => s + (c.revenueHistory[i]?.value || 0), 0),
  }));
  const forecast = forecastedRevenue(companies);
  const withForecast = [...monthly, { month: "+1mo", forecast: Math.round(forecast.total * 1.05) }, { month: "+2mo", forecast: Math.round(forecast.total * 1.12) }];
  if (monthly.length) withForecast[monthly.length - 1].forecast = monthly[monthly.length - 1].actual;

  const totalUsage = companies.reduce((s, c) => {
    const h = c.usageHistory;
    return s + (h.length ? h[h.length - 1].value : 0);
  }, 0);

  const byCompany = [...companies]
    .map((c) => ({
      ...c,
      thisMonth: c.revenueHistory[c.revenueHistory.length - 1]?.value || 0,
      lastMonth: c.revenueHistory[c.revenueHistory.length - 2]?.value || 0,
    }))
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
        <Card onClick={goToUsage}>
          <div className="text-xs mb-1" style={{ color: T.textFaint }}>Total Usage (this month)</div>
          <div style={{ fontFamily: T.fontMono, fontSize: 24, color: T.text }}>{fmtCount(totalUsage)} orders</div>
          <div className="text-xs mt-1" style={{ color: T.textFaint }}>click for breakdown by company →</div>
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
        {byCompany.length === 0 ? (
          <p className="text-xs" style={{ color: T.textFaint }}>No recorded revenue yet.</p>
        ) : (
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
        )}
      </Card>
    </div>
  );
}
