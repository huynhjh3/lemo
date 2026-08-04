import { AlertTriangle, Clock, Flame } from "lucide-react";
import { STAGE_PROB } from "../theme.js";

export const TODAY = new Date();

export const fmtMoney = (n) => "$" + Math.round(n).toLocaleString();
export const fmtCount = (n) => Math.round(n).toLocaleString();
export const round2 = (n) => Math.round(n * 100) / 100;

// dealValue is $ (monthly) for 'enterprise' deals, or our % (0-100) of
// revenue for 'revenue_share' deals — these helpers keep every $ sum/format
// from mistaking a percentage for a dollar amount.
export const isRevShare = (c) => c.dealType === "revenue_share";
export const fmtDealValue = (c) => (isRevShare(c) ? `${c.dealValue}%` : fmtMoney(c.dealValue));
export const dealValueUsd = (c) => (isRevShare(c) ? 0 : c.dealValue);
export const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
export const daysSince = (d) => daysBetween(d, TODAY);
export const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function recentMonths(count = 6) {
  const months = [];
  for (let i = count - 1; i >= 0; i--) {
    months.push(new Date(TODAY.getFullYear(), TODAY.getMonth() - i, 1));
  }
  return months;
}
export const monthLabel = (d) => d.toLocaleDateString("en-US", { month: "short" });
export const monthPeriod = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

export function pipelineHealth(companies, tasks) {
  const overdue = tasks.filter((t) => !t.done && daysBetween(t.due, TODAY) > 0).length;
  const closedWon = companies.filter((c) => c.stage === "Installed" && c.closedDate);
  const closedLostCount = companies.filter((c) => c.stage === "Stay in Contact").length;
  const avgDays = closedWon.length
    ? Math.round(closedWon.reduce((sum, c) => sum + daysBetween(c.createdDate, c.closedDate), 0) / closedWon.length)
    : null;
  const totalClosed = closedWon.length + closedLostCount;
  const conversion = totalClosed ? Math.round((closedWon.length / totalClosed) * 100) : null;
  return { overdue, avgDays, conversion };
}

export function forecastedRevenue(companies) {
  const active = companies.filter((c) => c.stage !== "Installed" && c.stage !== "Stay in Contact");
  const weighted = active.reduce((sum, c) => sum + dealValueUsd(c) * (STAGE_PROB[c.stage] ?? 0), 0);
  const recognizedMRR = companies.filter((c) => c.stage === "Installed").reduce((sum, c) => {
    const h = c.revenueHistory;
    return sum + (h.length ? h[h.length - 1].value : 0);
  }, 0);
  return { total: weighted + recognizedMRR, weighted, recognizedMRR };
}

export function riskyCompanies(companies) {
  return companies
    .filter((c) => c.stage !== "Installed" && c.stage !== "Stay in Contact")
    .map((c) => {
      const stale = c.lastContact ? daysSince(c.lastContact) : null;
      const reasons = [];
      if (c.status === "risk") reasons.push("Marked at risk");
      if (stale !== null && stale > 14) reasons.push(`No contact in ${stale} days`);
      return { ...c, stale, reasons };
    })
    .filter((c) => c.reasons.length > 0)
    .sort((a, b) => dealValueUsd(b) - dealValueUsd(a));
}

export function highPriorityActions(tasks, companies) {
  const items = [];
  tasks.filter((t) => !t.done && daysBetween(t.due, TODAY) >= 0).forEach((t) => {
    const overdue = daysBetween(t.due, TODAY) > 0;
    items.push({
      key: "task-" + t.id, kind: overdue ? "Overdue" : "Due Today",
      title: t.title, sub: t.company, urgency: overdue ? 3 : 2,
      icon: overdue ? AlertTriangle : Clock, companyId: t.companyId,
    });
  });
  riskyCompanies(companies).forEach((c) => {
    items.push({
      key: "risk-" + c.id, kind: "At Risk", title: `${c.name} — ${c.reasons[0]}`,
      sub: fmtDealValue(c) + " deal", urgency: c.status === "risk" ? 3 : 1, icon: Flame,
      companyId: c.id,
    });
  });
  return items.sort((a, b) => b.urgency - a.urgency).slice(0, 8);
}
