import { AlertTriangle, Clock, Flame, Tag, UserCheck, UserPlus, ClipboardCheck } from "lucide-react";
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

// `profile` drives a few extra action types on top of the shared
// overdue-task / at-risk-company ones below:
// - anyone: any company just assigned to THEM by someone else
//   (rep_confirmed = false, set by set_rep_confirmed — migration 011) that
//   they haven't acknowledged yet. Identity-based (rep_id === profile.id),
//   not role-gated — an owner or geo_partner assigned as a rep needs to
//   confirm it too, same as a bd_consultant.
// - owner: any company still missing a code (bd_consultant can't set one —
//   migration 009 — so this is how an owner notices a rep just added one);
//   and any still-unrouted company (no rep AND no region) — a bd_consultant
//   can't set either (migrations 009/012), so this is the owner's cue to
//   either assign a rep directly or set a region to hand it to that
//   region's geo_partner instead.
// - geo_partner: any company still missing a rep. `companies` for a
//   geo_partner is already RLS-scoped to their own region (migration 010),
//   so no extra region check is needed here — once an owner sets a
//   company's region, it becomes the geo_partner's job (not the owner's)
//   to assign it a rep.
export function highPriorityActions(tasks, companies, profile) {
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
  if (profile?.role === "owner") {
    companies.filter((c) => !c.code).forEach((c) => {
      items.push({
        key: "code-" + c.id, kind: "Needs Code",
        title: `${c.name} — assign a company code`, sub: fmtDealValue(c) + " deal",
        urgency: 3, icon: Tag, companyId: c.id,
      });
    });
    companies.filter((c) => !c.repId && !c.region).forEach((c) => {
      items.push({
        key: "route-" + c.id, kind: "Needs Rep",
        title: `${c.name} — assign a rep or region`, sub: fmtDealValue(c) + " deal",
        urgency: 3, icon: UserPlus, companyId: c.id,
      });
    });
  }
  companies.filter((c) => c.repId === profile?.id && !c.repConfirmed).forEach((c) => {
    items.push({
      key: "assign-" + c.id, kind: "New Assignment",
      title: `${c.name} — confirm assignment`, sub: "Just assigned to you",
      urgency: 3, icon: UserCheck, companyId: c.id,
    });
  });
  if (profile?.role === "geo_partner") {
    companies.filter((c) => !c.repId).forEach((c) => {
      items.push({
        key: "rep-" + c.id, kind: "Needs Rep",
        title: `${c.name} — assign a rep`, sub: fmtDealValue(c) + " deal",
        urgency: 3, icon: UserPlus, companyId: c.id,
      });
    });
  }
  // A bd_consultant-created company (auto-assigned to themselves, migration
  // 015) always starts pending_review = true — owner always sees it, and a
  // geo_partner sees it too since `companies` is already region-scoped for
  // them, so it only shows up here once it's actually in their region.
  if (profile?.role === "owner" || profile?.role === "geo_partner") {
    companies.filter((c) => c.pendingReview).forEach((c) => {
      items.push({
        key: "review-" + c.id, kind: "Pending Review",
        title: `${c.name} — review new company`, sub: `Added by ${c.rep}`,
        urgency: 3, icon: ClipboardCheck, companyId: c.id,
      });
    });
  }
  return items.sort((a, b) => b.urgency - a.urgency).slice(0, 8);
}
