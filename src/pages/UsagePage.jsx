import React from "react";
import { ArrowLeft, Activity, TrendingUp, TrendingDown } from "lucide-react";
import { T } from "../theme.js";
import { Card, CardTitle, StatusDot } from "../components/ui.jsx";
import { fmtMoney } from "../lib/helpers.js";

export default function UsagePage({ companies, goToCompany, back }) {
  const byCompany = [...companies]
    .map((c) => ({
      ...c,
      thisMonth: c.usageHistory[c.usageHistory.length - 1]?.value || 0,
      lastMonth: c.usageHistory[c.usageHistory.length - 2]?.value || 0,
    }))
    .filter((c) => c.thisMonth > 0 || c.lastMonth > 0)
    .sort((a, b) => b.thisMonth - a.thisMonth);

  const totalThisMonth = byCompany.reduce((s, c) => s + c.thisMonth, 0);

  return (
    <div>
      <button onClick={back} className="flex items-center gap-1.5 text-xs mb-4" style={{ color: T.textDim }}>
        <ArrowLeft size={14} /> Revenue
      </button>
      <div className="flex items-center justify-between mb-5">
        <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }}>Usage by Company</h1>
        <div className="text-right">
          <div style={{ fontFamily: T.fontMono, fontSize: 20, color: T.teal }}>{fmtMoney(totalThisMonth)}</div>
          <div className="text-xs" style={{ color: T.textFaint }}>total this month</div>
        </div>
      </div>

      <Card>
        <CardTitle icon={Activity}>Usage by Company</CardTitle>
        {byCompany.length === 0 ? (
          <p className="text-xs" style={{ color: T.textFaint }}>No usage recorded yet.</p>
        ) : (
          <div className="flex flex-col">
            <div className="grid grid-cols-4 text-[11px] uppercase tracking-wide pb-2" style={{ color: T.textFaint, borderBottom: `1px solid ${T.border}` }}>
              <span>Company</span><span>This month</span><span>Last month</span><span>Trend</span>
            </div>
            {byCompany.map((c) => {
              const up = c.thisMonth >= c.lastMonth;
              return (
                <button
                  key={c.id}
                  onClick={() => goToCompany(c.id)}
                  className="grid grid-cols-4 items-center text-sm py-2.5 text-left w-full"
                  style={{ borderBottom: `1px solid ${T.borderSoft}` }}
                >
                  <div className="flex items-center gap-2"><StatusDot status={c.status} /> <span style={{ color: T.text }}>{c.name}</span></div>
                  <span style={{ fontFamily: T.fontMono, color: T.text }}>{fmtMoney(c.thisMonth)}</span>
                  <span style={{ fontFamily: T.fontMono, color: T.textFaint }}>{fmtMoney(c.lastMonth)}</span>
                  <span className="flex items-center gap-1" style={{ color: up ? T.teal : T.red }}>
                    {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    <span className="text-xs">{c.lastMonth === 0 ? "new" : Math.abs(Math.round(((c.thisMonth - c.lastMonth) / c.lastMonth) * 100)) + "%"}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
