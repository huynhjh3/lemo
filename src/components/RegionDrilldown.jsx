import React from "react";
import { MapPin, Building2, TrendingUp, TrendingDown } from "lucide-react";
import { T } from "../theme.js";
import { Card, CardTitle, StatusDot } from "./ui.jsx";
import { companiesByHistory } from "../lib/helpers.js";

function trend(row) {
  const up = row.thisMonth >= row.lastMonth;
  const pct = row.lastMonth === 0 ? "new" : Math.abs(Math.round(((row.thisMonth - row.lastMonth) / row.lastMonth) * 100)) + "%";
  return { up, pct };
}

// Shared by Revenue and Usage: a "by region" table that drills into a
// "by company" table for whichever region row was clicked. `byRegion` is
// pre-aggregated by the caller (groupByRegion); the per-company breakdown
// is computed here once a region is selected, scoped to just that region.
export default function RegionDrilldown({
  companies, historyKey, regionColors, selectedRegion, setSelectedRegion, goToCompany, fmt, byRegion, emptyLabel, title = "",
}) {
  if (!selectedRegion) {
    return (
      <Card>
        <CardTitle icon={MapPin}>{title} by Region</CardTitle>
        {byRegion.length === 0 ? (
          <p className="text-xs" style={{ color: T.textFaint }}>{emptyLabel}</p>
        ) : (
          <div className="flex flex-col">
            <div className="grid grid-cols-4 text-[11px] uppercase tracking-wide pb-2" style={{ color: T.textFaint, borderBottom: `1px solid ${T.border}` }}>
              <span>Region</span><span>This month</span><span>Last month</span><span>Trend</span>
            </div>
            {byRegion.map((r) => {
              const { up, pct } = trend(r);
              const color = regionColors?.[r.region];
              return (
                <button
                  key={r.region}
                  onClick={() => setSelectedRegion(r.region)}
                  className="grid grid-cols-4 items-center text-sm py-2.5 text-left w-full"
                  style={{ borderBottom: `1px solid ${T.borderSoft}` }}
                >
                  <div className="flex items-center gap-2">
                    <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: color || T.textFaint }} />
                    <span style={{ color: T.text }}>{r.region}</span>
                  </div>
                  <span style={{ fontFamily: T.fontMono, color: T.text }}>{fmt(r.thisMonth)}</span>
                  <span style={{ fontFamily: T.fontMono, color: T.textFaint }}>{fmt(r.lastMonth)}</span>
                  <span className="flex items-center gap-1" style={{ color: up ? T.teal : T.red }}>
                    {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    <span className="text-xs">{pct}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Card>
    );
  }

  const byCompany = companiesByHistory(companies, historyKey, selectedRegion);
  return (
    <Card>
      <div className="flex items-center justify-between mb-1">
        <CardTitle icon={Building2}>{title} by Company — {selectedRegion}</CardTitle>
        <button onClick={() => setSelectedRegion(null)} className="text-xs shrink-0" style={{ color: T.textDim }}>
          ← All regions
        </button>
      </div>
      {byCompany.length === 0 ? (
        <p className="text-xs" style={{ color: T.textFaint }}>{emptyLabel}</p>
      ) : (
        <div className="flex flex-col">
          <div className="grid grid-cols-4 text-[11px] uppercase tracking-wide pb-2" style={{ color: T.textFaint, borderBottom: `1px solid ${T.border}` }}>
            <span>Company</span><span>This month</span><span>Last month</span><span>Trend</span>
          </div>
          {byCompany.map((c) => {
            const { up, pct } = trend(c);
            const Row = goToCompany ? "button" : "div";
            return (
              <Row
                key={c.id}
                onClick={goToCompany ? () => goToCompany(c.id) : undefined}
                className="grid grid-cols-4 items-center text-sm py-2.5 text-left w-full"
                style={{ borderBottom: `1px solid ${T.borderSoft}` }}
              >
                <div className="flex items-center gap-2"><StatusDot status={c.status} /> <span style={{ color: T.text }}>{c.name}</span></div>
                <span style={{ fontFamily: T.fontMono, color: T.text }}>{fmt(c.thisMonth)}</span>
                <span style={{ fontFamily: T.fontMono, color: T.textFaint }}>{fmt(c.lastMonth)}</span>
                <span className="flex items-center gap-1" style={{ color: up ? T.teal : T.red }}>
                  {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  <span className="text-xs">{pct}</span>
                </span>
              </Row>
            );
          })}
        </div>
      )}
    </Card>
  );
}
