import React, { useState } from "react";
import { TrendingUp, MapPin, Factory, Sparkles } from "lucide-react";
import {
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart, Bar, Line,
} from "recharts";
import { T } from "../theme.js";
import { useAuth } from "../context/AuthContext.jsx";
import { Card, CardTitle } from "../components/ui.jsx";
import {
  fmtMoney, fmtCount, fmtDate, forecastedRevenue, recentMonths, monthLabel, TODAY,
  groupByRegion, groupByIndustry, companiesByHistory, companiesByIndustryValue, revenueStory, projectMonthEnd,
  bestDayThisMonth,
} from "../lib/helpers.js";
import CategoryDrilldown from "../components/CategoryDrilldown.jsx";

export default function RevenuePage({ companies, regionColors, goToUsage, goToCompany }) {
  const { profile } = useAuth();
  // Aggregate totals (by region/by industry) stay visible, but drilling
  // into a specific company's numbers within a region/industry would
  // expose the same per-company $ figures we hide on CompanyProfile —
  // so these roles get the aggregate row only, no company breakdown.
  const hideCompanyBreakdown = profile?.role === "geo_partner" || profile?.role === "bd_consultant";
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [selectedIndustry, setSelectedIndustry] = useState(null);
  const months = recentMonths().map(monthLabel);
  const monthly = months.map((m, i) => ({
    month: m,
    actual: companies.reduce((s, c) => s + (c.revenueHistory[i]?.value || 0), 0),
  }));
  const forecast = forecastedRevenue(companies);

  const totalUsage = companies.reduce((s, c) => {
    const h = c.usageHistory;
    return s + (h.length ? h[h.length - 1].value : 0);
  }, 0);

  const byRegion = groupByRegion(companies, "revenueHistory");
  const byIndustry = groupByIndustry(companies, "revenueHistory");
  const totalThisMonth = byRegion.reduce((s, r) => s + r.thisMonth, 0);
  const totalLastMonth = byRegion.reduce((s, r) => s + r.lastMonth, 0);
  const monthEndProjection = projectMonthEnd(companies);
  const projectedTotal = monthEndProjection ? totalThisMonth + monthEndProjection.projectedRemaining : null;
  const story = revenueStory({ totalThisMonth, totalLastMonth, byRegion, byIndustry, projectedTotal, companies });
  const bestDay = bestDayThisMonth(companies);

  // The current month's point on the dashed forecast line now reflects
  // the actual seasonality-based projection (see projectMonthEnd) instead
  // of just mirroring the actual bar — previously this line silently set
  // it equal to the actual figure purely so the dashed line had somewhere
  // to start, which meant the tooltip showed identical "actual"/"forecast"
  // numbers for the current month even when the page's own story sentence
  // said revenue was forecasted to land somewhere else entirely.
  const withForecast = [...monthly, { month: "+1mo", forecast: Math.round(forecast.total * 1.05) }, { month: "+2mo", forecast: Math.round(forecast.total * 1.12) }];
  if (monthly.length) withForecast[monthly.length - 1].forecast = projectedTotal ?? monthly[monthly.length - 1].actual;

  const daysLeftInMonth = new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0).getDate() - TODAY.getDate();

  return (
    <div>
      <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }} className="mb-5">Revenue</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <Card>
          <div className="text-xs mb-1" style={{ color: T.textFaint }}>This month (actual)</div>
          <div style={{ fontFamily: T.fontMono, fontSize: 24, color: T.teal }}>{fmtMoney(totalThisMonth)}</div>
          <div className="text-xs mt-1" style={{ color: T.textFaint }}>
            {daysLeftInMonth === 0 ? "last day of the month" : `${daysLeftInMonth} day${daysLeftInMonth === 1 ? "" : "s"} left in the month`}
          </div>
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

      {(story || bestDay) && (
        <Card className="mb-4" style={{ border: `1px solid ${T.amber}40` }}>
          {story && (
            <div className="flex items-start gap-2.5">
              <Sparkles size={15} style={{ color: T.amber, marginTop: 1, flexShrink: 0 }} />
              <p className="text-sm" style={{ color: T.text, lineHeight: 1.5 }}>{story}</p>
            </div>
          )}
          {bestDay && (
            <div
              className="flex items-center gap-4 text-xs flex-wrap"
              style={{ color: T.textFaint, marginTop: story ? 10 : 0, paddingLeft: story ? 23 : 0 }}
            >
              <span>Best day: {fmtDate(bestDay.date)}, {fmtMoney(bestDay.amount)}</span>
            </div>
          )}
        </Card>
      )}

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CategoryDrilldown
          title="Revenue"
          groupLabel="Region"
          groupIcon={MapPin}
          getColor={(region) => regionColors?.[region]}
          companiesInGroup={(region) => companiesByHistory(companies, "revenueHistory", region)}
          selectedGroup={selectedRegion}
          setSelectedGroup={setSelectedRegion}
          backLabel="All regions"
          goToCompany={goToCompany}
          fmt={fmtMoney}
          byGroup={byRegion}
          emptyLabel="No recorded revenue yet."
          hideCompanyBreakdown={hideCompanyBreakdown}
        />
        <CategoryDrilldown
          title="Revenue"
          groupLabel="Industry"
          groupIcon={Factory}
          companiesInGroup={(industry) => companiesByIndustryValue(companies, "revenueHistory", industry)}
          selectedGroup={selectedIndustry}
          setSelectedGroup={setSelectedIndustry}
          backLabel="All industries"
          goToCompany={goToCompany}
          fmt={fmtMoney}
          byGroup={byIndustry}
          emptyLabel="No recorded revenue yet."
          hideCompanyBreakdown={hideCompanyBreakdown}
        />
      </div>
    </div>
  );
}
