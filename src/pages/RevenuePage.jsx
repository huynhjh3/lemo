import React, { useState } from "react";
import { TrendingUp } from "lucide-react";
import {
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart, Bar, Line,
} from "recharts";
import { T } from "../theme.js";
import { Card, CardTitle } from "../components/ui.jsx";
import { fmtMoney, fmtCount, forecastedRevenue, recentMonths, monthLabel, groupByRegion } from "../lib/helpers.js";
import RegionDrilldown from "../components/RegionDrilldown.jsx";

export default function RevenuePage({ companies, regionColors, goToUsage, goToCompany }) {
  const [selectedRegion, setSelectedRegion] = useState(null);
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

  const byRegion = groupByRegion(companies, "revenueHistory");
  const totalThisMonth = byRegion.reduce((s, r) => s + r.thisMonth, 0);

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
          <div className="text-xs mt-1" style={{ color: T.textFaint }}>
            Each open deal's value × win probability by stage (Lead 10% · Contacted 25% · Proposal 50% · Negotiation 75%).
            Revenue Share deals count once Installed with real usage — not before.
          </div>
        </Card>
        <Card onClick={goToUsage}>
          <div className="text-xs mb-1" style={{ color: T.textFaint }}>Total Usage (this month)</div>
          <div style={{ fontFamily: T.fontMono, fontSize: 24, color: T.text }}>{fmtCount(totalUsage)} orders</div>
          <div className="text-xs mt-1" style={{ color: T.textFaint }}>click for breakdown by region →</div>
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

      <RegionDrilldown
        title="Revenue"
        companies={companies}
        historyKey="revenueHistory"
        regionColors={regionColors}
        selectedRegion={selectedRegion}
        setSelectedRegion={setSelectedRegion}
        goToCompany={goToCompany}
        fmt={fmtMoney}
        byRegion={byRegion}
        emptyLabel="No recorded revenue yet."
      />
    </div>
  );
}
