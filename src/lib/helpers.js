import { AlertTriangle, Clock, Flame, Tag, UserCheck, UserPlus, ClipboardCheck, ClipboardList, Send, StickyNote, MessageSquare, ShieldCheck } from "lucide-react";
import { STAGE_PROB } from "../theme.js";

// Shared with TeamPage.jsx's Pending Approvals card, so a request's title
// reads identically whether it shows up there or in the HPA feed below.
export const APPROVAL_LABEL = {
  maintenance_on: () => "Turn the site OFF for everyone",
  delete_user: (a) => `Delete ${a.payload.user_name}'s account`,
  invite_owner: (a) => `Invite ${a.payload.name} (${a.payload.email}) as Owner`,
  invite_geo_partner: (a) => `Invite ${a.payload.name} (${a.payload.email}) as Strategic Partner${a.payload.region ? ` — ${a.payload.region}` : ""}`,
};

export const TODAY = new Date();

export const fmtMoney = (n) => "$" + Math.round(n).toLocaleString();
export const fmtCount = (n) => Math.round(n).toLocaleString();
export const round2 = (n) => Math.round(n * 100) / 100;

// dealValue is $ (monthly) for 'enterprise' deals, or our % (0-100) of
// revenue for 'revenue_share'/'fixed_rent'/'fixed_plus_share' deals — the
// latter two (migration 044) are locations where Lemo pays the host a
// monthly rent (fixedRentAmount) rather than being paid by them, but still
// keep a % of gross revenue on top, same convention as revenue_share.
// These helpers keep every $ sum/format from mistaking a percentage for a
// dollar amount — name kept as "isRevShare" for minimal diff, but it now
// means "deal_value is a %", not literally "deal_type === revenue_share".
export const isRevShare = (c) => ["revenue_share", "fixed_rent", "fixed_plus_share"].includes(c.dealType);
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

export const NO_REGION_LABEL = "No region";
export const NO_INDUSTRY_LABEL = "No industry";

// Both revenueHistory and usageHistory end with the most recent month —
// shared by the Revenue and Usage pages' "by region"/"by industry"/
// "by company" tables.
export function lastTwoMonths(history) {
  return {
    thisMonth: history[history.length - 1]?.value || 0,
    lastMonth: history[history.length - 2]?.value || 0,
  };
}

// Sums a history key (revenueHistory or usageHistory) into thisMonth/
// lastMonth totals grouped by an arbitrary company field — feeds the
// top-level "by region"/"by industry" table before drilling into a single
// group's companies (companiesByFieldValue). Returned rows use a generic
// `group` key (not `region`/`industry`) so one table component
// (CategoryDrilldown) can render either grouping.
export function groupByField(companies, historyKey, field, noValueLabel) {
  const byGroup = new Map();
  companies.forEach((c) => {
    const { thisMonth, lastMonth } = lastTwoMonths(c[historyKey]);
    if (thisMonth === 0 && lastMonth === 0) return;
    const group = c[field] || noValueLabel;
    const existing = byGroup.get(group) || { group, thisMonth: 0, lastMonth: 0 };
    existing.thisMonth += thisMonth;
    existing.lastMonth += lastMonth;
    byGroup.set(group, existing);
  });
  return Array.from(byGroup.values()).sort((a, b) => b.thisMonth - a.thisMonth);
}

// Same this/lastMonth shape as groupByField, scoped to companies matching
// one group's value — the drill-down table once a region/industry row is
// clicked.
export function companiesByFieldValue(companies, historyKey, field, value, noValueLabel) {
  return companies
    .filter((c) => (c[field] || noValueLabel) === value)
    .map((c) => ({ ...c, ...lastTwoMonths(c[historyKey]) }))
    .filter((c) => c.thisMonth > 0 || c.lastMonth > 0)
    .sort((a, b) => b.thisMonth - a.thisMonth);
}

export const groupByRegion = (companies, historyKey) => groupByField(companies, historyKey, "region", NO_REGION_LABEL);
export const groupByIndustry = (companies, historyKey) => groupByField(companies, historyKey, "industry", NO_INDUSTRY_LABEL);
export const companiesByHistory = (companies, historyKey, region) => companiesByFieldValue(companies, historyKey, "region", region, NO_REGION_LABEL);
export const companiesByIndustryValue = (companies, historyKey, industry) => companiesByFieldValue(companies, historyKey, "industry", industry, NO_INDUSTRY_LABEL);

// A deterministic, plain-language read on what moved — no LLM, just the
// same region/industry aggregates the Revenue page already computes,
// turned into a sentence a stakeholder can screenshot and understand
// without reading the underlying tables (confirmed: this is the kind of
// "smarter without an API bill" feature to keep building — see
// scoreFollowUps above for the same philosophy).
export function revenueStory({ totalThisMonth, totalLastMonth, byRegion, byIndustry, projectedTotal, companies = [] }) {
  const pctChange = totalLastMonth > 0 ? Math.round(((totalThisMonth - totalLastMonth) / totalLastMonth) * 100) : null;
  const mover = (rows) => {
    const withDelta = rows.map((r) => ({ ...r, delta: r.thisMonth - r.lastMonth }));
    const gain = [...withDelta].sort((a, b) => b.delta - a.delta)[0];
    const drop = [...withDelta].sort((a, b) => a.delta - b.delta)[0];
    return { gain: gain?.delta > 0 ? gain : null, drop: drop?.delta < 0 ? drop : null };
  };
  const regionMove = mover(byRegion);
  const industryMove = mover(byIndustry);

  // Which single company drove a region/industry's gain, and by how
  // much of it — names the actual account instead of leaving "SoCal led
  // the gains" as an abstraction nobody can act on. Only called out when
  // one company is genuinely most of the story (>=60% of the group's own
  // gain), not just technically the largest of several similar movers.
  const topCompanyIn = (field, value, groupDelta) => {
    const withDelta = companies
      .filter((c) => (c[field] || null) === value)
      .map((c) => {
        const h = c.revenueHistory;
        return { name: c.name, delta: (h[h.length - 1]?.value || 0) - (h[h.length - 2]?.value || 0) };
      })
      .sort((a, b) => b.delta - a.delta);
    const top = withDelta[0];
    return top && top.delta > 0 && groupDelta > 0 && top.delta >= groupDelta * 0.6 ? top : null;
  };

  const parts = [];
  if (pctChange !== null) {
    const soFar = projectedTotal != null ? " so far" : "";
    parts.push(`Revenue is ${pctChange >= 0 ? "up" : "down"} ${Math.abs(pctChange)}% this month${soFar} (${fmtMoney(totalThisMonth)} vs ${fmtMoney(totalLastMonth)}).`);
  } else if (totalThisMonth > 0) {
    parts.push(`${fmtMoney(totalThisMonth)} recognized this month.`);
  }
  // Month-end projection (see projectMonthEnd) — a second, full-month
  // comparison alongside the month-to-date one above, since a partial
  // month always reads as "down" against a complete prior month on its
  // own. Only shown once there's an actual last-month total to compare
  // the projection against.
  if (projectedTotal != null && totalLastMonth > 0) {
    const projectedPct = Math.round(((projectedTotal - totalLastMonth) / totalLastMonth) * 100);
    parts.push(`Forecasted to be ${projectedPct >= 0 ? "up" : "down"} ${Math.abs(projectedPct)}% by month end.`);
  }
  if (regionMove.gain) {
    const top = topCompanyIn("region", regionMove.gain.group, regionMove.gain.delta);
    parts.push(`${regionMove.gain.group} led the gains, up ${fmtMoney(regionMove.gain.delta)}${top ? ` (mostly ${top.name})` : ""}.`);
  }
  if (industryMove.gain && industryMove.gain.group !== regionMove.gain?.group) {
    const top = topCompanyIn("industry", industryMove.gain.group, industryMove.gain.delta);
    parts.push(`${industryMove.gain.group} was the strongest industry, up ${fmtMoney(industryMove.gain.delta)}${top ? ` (mostly ${top.name})` : ""}.`);
  }
  if (regionMove.drop) parts.push(`${regionMove.drop.group} pulled back ${fmtMoney(Math.abs(regionMove.drop.delta))}.`);
  return parts.join(" ");
}

// Single best calendar day this month, pooled across every company — a
// concrete, screenshot-friendly detail rather than just an aggregate.
export function bestDayThisMonth(companies) {
  const monthKey = monthPeriod(TODAY).slice(0, 7);
  const byDate = new Map();
  companies.forEach((c) => {
    (c.usageDaily || []).forEach((d) => {
      if (!d.date.startsWith(monthKey)) return;
      byDate.set(d.date, (byDate.get(d.date) || 0) + (d.amount || 0));
    });
  });
  let best = null;
  byDate.forEach((amount, date) => {
    if (amount > 0 && (!best || amount > best.amount)) best = { date, amount: round2(amount) };
  });
  return best;
}

// This month's average $ on today's day-of-week vs. the same day-of-week
// last month — a concrete instance of the pattern projectMonthEnd reads
// from, not just an abstract multiplier.
const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export function sameWeekdayComparison(companies) {
  const dow = TODAY.getDay();
  const thisMonthKey = monthPeriod(TODAY).slice(0, 7);
  const lastMonthKey = monthPeriod(new Date(TODAY.getFullYear(), TODAY.getMonth() - 1, 1)).slice(0, 7);
  const sumByDate = (monthKey) => {
    const byDate = new Map();
    companies.forEach((c) => {
      (c.usageDaily || []).forEach((d) => {
        if (!d.date.startsWith(monthKey) || new Date(d.date + "T00:00:00").getDay() !== dow) return;
        byDate.set(d.date, (byDate.get(d.date) || 0) + (d.amount || 0));
      });
    });
    return Array.from(byDate.values());
  };
  const thisMonthVals = sumByDate(thisMonthKey);
  const lastMonthVals = sumByDate(lastMonthKey);
  if (!thisMonthVals.length && !lastMonthVals.length) return null;
  const avg = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
  return { dowName: DOW_NAMES[dow], thisMonthAvg: round2(avg(thisMonthVals)), lastMonthAvg: round2(avg(lastMonthVals)) };
}

// Projects revenue through the end of the current month using day-of-week
// seasonality (Monday usage, weekend lulls, weekday spikes) pooled from
// every company's daily CSV history, scaled by a recent-usage-trend
// multiplier so a real pickup in usage lately actually moves the
// projection instead of just averaging it away. Deterministic — no LLM,
// same philosophy as everything else in this file.
export function projectMonthEnd(companies) {
  // Pool every company's (date, amount, orders) rows system-wide — a
  // single company's daily history is too sparse/noisy on its own to
  // read a day-of-week pattern from.
  const byDate = new Map();
  companies.forEach((c) => {
    (c.usageDaily || []).forEach((d) => {
      const existing = byDate.get(d.date) || { amount: 0, orders: 0 };
      existing.amount += d.amount || 0;
      existing.orders += d.orders || 0;
      byDate.set(d.date, existing);
    });
  });
  const rows = Array.from(byDate.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (rows.length < 7) return null; // not enough history to read a weekly pattern from

  // Average $ recognized on each day-of-week, across all available history.
  const byDow = Array.from({ length: 7 }, () => []);
  rows.forEach((r) => byDow[new Date(r.date + "T00:00:00").getDay()].push(r.amount));
  const dowAvg = byDow.map((vals) => (vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0));

  // Last 14 days' average orders vs. the 14 days before that — how much
  // usage has picked up (or slowed) lately. Clamped to 0.5x-2x so a thin,
  // noisy history can't extrapolate into something absurd.
  const avgOrders = (arr) => (arr.length ? arr.reduce((s, r) => s + r.orders, 0) / arr.length : 0);
  const recentAvg = avgOrders(rows.slice(-14));
  const priorAvg = avgOrders(rows.slice(-28, -14));
  const trendMultiplier = priorAvg > 0 ? Math.min(2, Math.max(0.5, recentAvg / priorAvg)) : 1;

  // Sum the day-of-week average (scaled by the trend) for every day still
  // left in the current month.
  const year = TODAY.getFullYear(), month = TODAY.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  let projectedRemaining = 0;
  for (let day = TODAY.getDate() + 1; day <= lastDay; day++) {
    projectedRemaining += dowAvg[new Date(year, month, day).getDay()] * trendMultiplier;
  }
  return { projectedRemaining: round2(projectedRemaining), trendMultiplier };
}

// A single company's own daily history is too thin to read a day-of-week
// pattern from (see projectMonthEnd's pooled approach above) — so this is
// a plain run-rate projection instead: this month's $-per-day so far,
// scaled out to the full month. Only meaningful for a usage-driven deal
// (revenue_share/fixed_rent/fixed_plus_share); enterprise deals are a flat
// known number, nothing to forecast.
export function companyRevenueStory(company) {
  if (!isRevShare(company)) return null;
  const monthKey = monthPeriod(TODAY).slice(0, 7);
  const thisMonthRows = (company.usageDaily || []).filter((d) => d.date.slice(0, 7) === monthKey);
  const totalSoFar = thisMonthRows.reduce((s, d) => s + (d.amount || 0), 0);
  if (totalSoFar <= 0) return null;
  const daysElapsed = TODAY.getDate();
  const daysInMonth = new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0).getDate();
  const projected = round2((totalSoFar / daysElapsed) * daysInMonth);
  const lastMonthActual = company.revenueHistory[company.revenueHistory.length - 2]?.value || 0;
  const pct = lastMonthActual > 0 ? Math.round(((projected - lastMonthActual) / lastMonthActual) * 100) : null;
  const trendClause = pct === null ? "" : `, ${pct >= 0 ? "up" : "down"} ${Math.abs(pct)}% vs last month`;
  return `Forecasted to close at ${fmtMoney(projected)} this month${trendClause}.`;
}

// Day-over-day and week-over-week usage read for one company — the
// day-to-day trend is noisy for a single company (small counts), so it's
// phrased as a plain comparison rather than a percentage; the week
// comparison sums enough volume that a percentage is more meaningful.
export function usageStory(company) {
  const daily = company.usageDaily || [];
  if (daily.length === 0) return null;
  const today = daily[daily.length - 1];
  const yesterday = daily[daily.length - 2];
  const last7 = daily.slice(-7).reduce((s, r) => s + r.orders, 0);
  const prev7 = daily.slice(-14, -7).reduce((s, r) => s + r.orders, 0);

  const clauses = [];
  if (yesterday) {
    if (today.orders === yesterday.orders) {
      clauses.push(`steady at ${today.orders} order${today.orders === 1 ? "" : "s"} today`);
    } else {
      const up = today.orders > yesterday.orders;
      clauses.push(`${up ? "up" : "down"} today — ${today.orders} vs ${yesterday.orders} order${yesterday.orders === 1 ? "" : "s"} yesterday`);
    }
  }
  if (last7 > 0 || prev7 > 0) {
    const up = last7 >= prev7;
    const pct = prev7 > 0 ? Math.round(Math.abs((last7 - prev7) / prev7) * 100) : null;
    clauses.push(prev7 === 0
      ? `${last7} order${last7 === 1 ? "" : "s"} this week vs none the week before`
      : `${up ? "up" : "down"}${pct !== null ? ` ${pct}%` : ""} this week (${last7} vs ${prev7})`);
  }
  if (clauses.length === 0) return null;
  return `Usage is ${clauses.join("; ")}.`;
}

// Follow-Up Detection (LemoCRM_FollowUp_Spec, 2026-08-27) — a simple,
// explainable weighted score per active-pipeline company, not a black box.
// Each signal below adds a fixed weight; the total ranks the company's card
// in the High Priority Actions feed and feeds the Overview "Overdue" tile.
// Only Lead/Contacted/Proposal/Negotiation are scored — same active-pipeline
// scope as riskyCompanies below; a closed deal (Installed or Stay in
// Contact) can't "go cold" in the sense this feature is watching for.
// Thresholds and weights are business judgment calls (confirmed with
// Justin: tiered-by-stage silence, auto-clear on new contact, score every
// company including $0/test-code ones) — tune here, not in the caller.
const STAGE_SILENCE_DAYS = { Lead: 21, Contacted: 14, Proposal: 10, Negotiation: 5 };
const STAGE_TYPICAL_DAYS = { Lead: 30, Contacted: 21, Proposal: 21, Negotiation: 14 };
const FOLLOWUP_WEIGHT = { followUpPassed: 40, stageSilence: 25, overdueTask: 25, stageStall: 15, unassignedRep: 10 };

function lastLoggedAt(company) {
  return company.communicationsLog[0]?.occurredAt || null;
}

// Most recent "Moved to <stage> stage" system activity entry for the
// company's CURRENT stage — a real, already-recorded signal (the audit
// trigger logs every stage change) rather than a new column. Falls back to
// createdDate for a company that's never moved out of its original stage.
export function stageEnteredAt(company) {
  const moves = company.activity
    .filter((a) => a.type === "system" && a.summary === `Moved to ${company.stage} stage`)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return moves[0]?.date || company.createdDate;
}

// Returns every active-pipeline company with a nonzero score, highest
// first — each with `reasons` (plain-language, matching the spec's card
// format) in the order their signals were evaluated.
export function scoreFollowUps(companies, tasks) {
  const results = [];
  companies.forEach((c) => {
    if (!STAGE_SILENCE_DAYS[c.stage]) return;
    let score = 0;
    const reasons = [];
    const lastLog = lastLoggedAt(c);

    if (c.nextFollowUp && daysBetween(c.nextFollowUp, TODAY) > 0) {
      const nothingSince = !lastLog || new Date(lastLog) < new Date(c.nextFollowUp);
      if (nothingSince) {
        score += FOLLOWUP_WEIGHT.followUpPassed;
        reasons.push(`follow-up overdue ${daysBetween(c.nextFollowUp, TODAY)} days, no contact logged`);
      }
    }

    const silenceDays = lastLog ? daysSince(lastLog) : daysSince(c.createdDate);
    if (silenceDays > STAGE_SILENCE_DAYS[c.stage]) {
      score += FOLLOWUP_WEIGHT.stageSilence;
      reasons.push(`${silenceDays} days without a logged contact (${c.stage} tolerates ${STAGE_SILENCE_DAYS[c.stage]})`);
    }

    const overdueTask = tasks
      .filter((t) => t.companyId === c.id && !t.done && daysBetween(t.due, TODAY) > 0)
      .find((t) => !lastLog || new Date(t.due) > new Date(lastLog));
    if (overdueTask) {
      score += FOLLOWUP_WEIGHT.overdueTask;
      reasons.push(`task "${overdueTask.title}" overdue with nothing logged since`);
    }

    const daysInStage = daysSince(stageEnteredAt(c));
    if (daysInStage > STAGE_TYPICAL_DAYS[c.stage] * 1.5) {
      score += FOLLOWUP_WEIGHT.stageStall;
      reasons.push(`${daysInStage} days in ${c.stage}, well past typical`);
    }

    // Modifier only — doesn't flag a company on its own, only compounds an
    // existing signal (matches the spec's "Modifier (+)" row exactly).
    if (score > 0 && !c.repId) {
      score += FOLLOWUP_WEIGHT.unassignedRep;
      reasons.push("no rep assigned");
    }

    if (score > 0) results.push({ company: c, score, reasons });
  });
  return results.sort((a, b) => b.score - a.score);
}

// Replaces the old Overdue/Avg close/Conversion/At risk tiles (Justin:
// "non useful") with a plain-language read of what's actually stuck —
// same deterministic, no-LLM approach as revenueStory. Reuses the exact
// stall definition scoreFollowUps already scores on (STAGE_TYPICAL_DAYS *
// 1.5), so "stalled" means the same thing here and in the HPA feed.
export function pipelineStory(companies, profile) {
  const scoped = profile?.role === "geo_partner" ? companies.filter((c) => c.region === profile.region) : companies;
  const byStage = new Map();
  scoped.forEach((c) => {
    const typical = STAGE_TYPICAL_DAYS[c.stage];
    if (!typical) return;
    const daysInStage = daysSince(stageEnteredAt(c));
    if (daysInStage > typical * 1.5) {
      const list = byStage.get(c.stage) || [];
      list.push(daysInStage);
      byStage.set(c.stage, list);
    }
  });
  const clauses = Array.from(byStage.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 2)
    .map(([stage, days]) => {
      const n = days.length;
      const minDays = Math.floor(Math.min(...days) / 10) * 10;
      return `${n} deal${n > 1 ? "s" : ""} ${n > 1 ? "have" : "has"} been in ${stage} over ${minDays} days`;
    });
  if (clauses.length === 0) return null;
  return clauses.join("; ") + ".";
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

// Per-stage story behind the pipeline half of forecastedRevenue's total —
// how many open deals are sitting in each stage and how likely each is
// to install (reuses the same STAGE_PROB weights), ordered highest-
// probability stage first so the reader sees what's closest to closing.
export function pipelineBreakdown(companies) {
  const active = companies.filter((c) => c.stage !== "Installed" && c.stage !== "Stay in Contact");
  const byStage = new Map();
  active.forEach((c) => {
    const list = byStage.get(c.stage) || [];
    list.push(c);
    byStage.set(c.stage, list);
  });
  return Array.from(byStage.entries())
    .map(([stage, list]) => ({ stage, count: list.length, prob: STAGE_PROB[stage] ?? 0 }))
    .sort((a, b) => b.prob - a.prob);
}

// A one-sentence read of pipelineBreakdown, same deterministic-narrative
// approach as pipelineStory/revenueStory: is the pipeline mostly early
// (Lead/Contacted) or does it have real deals close to closing?
export function pipelineForecastStory(companies) {
  const rows = pipelineBreakdown(companies);
  if (rows.length === 0) return null;
  const total = rows.reduce((s, r) => s + r.count, 0);
  const early = rows.filter((r) => r.stage === "Lead" || r.stage === "Contacted").reduce((s, r) => s + r.count, 0);
  const advancing = rows.find((r) => r.stage !== "Lead" && r.stage !== "Contacted");

  if (advancing && early > 0) {
    return `Pipeline skews early — ${early} of ${total} open deal${total === 1 ? "" : "s"} ${early === 1 ? "is" : "are"} still in Lead or Contacted. ${advancing.count} in ${advancing.stage} ${advancing.count === 1 ? "is" : "are"} closest to closing, ${Math.round(advancing.prob * 100)}% likely.`;
  }
  const top = rows[0];
  return `${top.count} of ${total} open deal${total === 1 ? "" : "s"} ${top.count === 1 ? "is" : "are"} in ${top.stage}, ${Math.round(top.prob * 100)}% likely to close.`;
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
// - geo_partner: any company in THEIR region still missing a rep. `companies`
//   is no longer region-scoped by RLS for geo_partner (migration 039 opened
//   read visibility to every region, for the Companies list/Pipeline board)
//   — so the region check below is load-bearing now, not redundant; once an
//   owner sets a company's region, it becomes that region's geo_partner's
//   job (not the owner's, and not every other region's geo_partner) to
//   assign it a rep.
export function highPriorityActions(tasks, companies, notes, profile, approvals = []) {
  const items = [];
  // A pending Master Admin dual-approval request (migration 029) surfaces
  // here only for a DIFFERENT Master Admin than whoever requested it — the
  // requester can't self-approve (prevent_self_approval trigger), so it'd
  // be a dead-end action item for them, same isSelf logic as the Pending
  // Approvals card on TeamPage. No companyId — these aren't company-scoped.
  if (profile?.is_master_admin) {
    approvals.filter((a) => a.requested_by !== profile.id).forEach((a) => {
      items.push({
        key: "approval-" + a.id, kind: "Needs Approval",
        title: APPROVAL_LABEL[a.action_type]?.(a) || a.action_type,
        sub: `Requested by ${a.requestedByProfile?.name || "—"}`,
        urgency: 3, icon: ShieldCheck, companyId: null,
      });
    });
  }
  // Follow-Up Detection (see scoreFollowUps above) — region-scoped for a
  // Strategic Partner the same way Needs Rep/Pending Review already are
  // (companies itself stopped being region-scoped by RLS for them in
  // migration 039); a bd_consultant's `companies` is already scoped to
  // just their own by RLS, so no extra check needed there. `action:
  // "openCommsLog"` tells the click handler to land on the company with
  // the Communications Log entry form already expanded (spec Section 4).
  const followUpScope = profile?.role === "geo_partner" ? companies.filter((c) => c.region === profile.region) : companies;
  scoreFollowUps(followUpScope, tasks).forEach(({ company: c, reasons }) => {
    items.push({
      key: "followup-" + c.id, kind: "Follow-Up",
      title: `${c.name} — ${reasons[0]}`,
      sub: fmtDealValue(c) + " deal",
      urgency: 3, icon: AlertTriangle, companyId: c.id,
      action: "openCommsLog",
    });
  });
  // A note aimed at you (person or your region) surfaces here — a note
  // attached to a company or fully general doesn't, since those are
  // reference/bulletin material, not a directed ask for your attention.
  // Clears once you mark it read (note_reads — migration 032); readAt is
  // per-user, so a region note stays live for everyone else in that region
  // who hasn't read it yet even after you have.
  notes.filter((n) => n.targetUserId && n.targetUserId === profile?.id && !n.readAt).forEach((n) => {
    items.push({
      key: "note-person-" + n.id, kind: "Note",
      title: `Note from ${n.authorName}`, sub: n.body.length > 60 ? n.body.slice(0, 60) + "…" : n.body,
      urgency: 2, icon: StickyNote, companyId: n.companyId || null,
    });
  });
  notes.filter((n) => n.targetRegion && profile?.region && n.targetRegion === profile.region && !n.readAt).forEach((n) => {
    items.push({
      key: "note-region-" + n.id, kind: "Note",
      title: `Region note from ${n.authorName}`, sub: n.body.length > 60 ? n.body.slice(0, 60) + "…" : n.body,
      urgency: 2, icon: StickyNote, companyId: n.companyId || null,
    });
  });
  // A reply on your own note re-surfaces it as an HPA — "your own" here
  // means you authored it, regardless of its target (even a note you sent
  // to someone else can get a reply worth seeing). Comparing the latest
  // comment's timestamp against your own readAt (rather than a plain
  // isRead boolean) is what lets this re-open after you've already read
  // the note once — posting a comment or reopening the thread bumps
  // readAt past the reply and clears it again (see NotesPage.jsx).
  notes.filter((n) => n.authorId === profile?.id && n.comments.length > 0).forEach((n) => {
    const lastComment = n.comments[n.comments.length - 1];
    if (lastComment.authorId === profile?.id) return;
    if (n.readAt && new Date(n.readAt) >= new Date(lastComment.createdAt)) return;
    items.push({
      key: "note-reply-" + n.id, kind: "Reply",
      title: `${lastComment.authorName} replied to your note`,
      sub: lastComment.body.length > 60 ? lastComment.body.slice(0, 60) + "…" : lastComment.body,
      urgency: 2, icon: MessageSquare, companyId: n.companyId || null,
    });
  });
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
    // A checklist submitted for install stays a work order until an owner
    // explicitly approves it (see "Approve for Installation" on the
    // checklist itself) — not tied to the company's stage, since that just
    // tracks whether the chair is physically in, a separate later step. An
    // edit to the checklist after submitting clears submittedForInstallAt
    // back to null (see upsertPreInstallChecklist), so this also
    // disappears the moment a detail changes and needs re-review. Also
    // excluded once bypassed — bypassing (migration 026) doesn't clear
    // submittedForInstallAt itself, so a checklist that was submitted and
    // THEN bypassed instead of approved would otherwise stay stuck here
    // forever with no way to clear it. Checklists live on type='install'
    // tasks (migration 027), not outlets — a task can hold one before any
    // Location or chair exists.
    tasks.filter((t) => t.type === "install" && t.checklist?.submittedForInstallAt && !t.checklist?.approvedForInstallAt && !t.checklist?.bypassedAt).forEach((t) => {
      items.push({
        key: "workorder-" + t.id, kind: "Work Order",
        title: `${t.title} (${t.company}) — ready for installation`,
        sub: "Submitted for installation", urgency: 3, icon: Send, companyId: t.companyId,
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
    companies.filter((c) => !c.repId && c.region === profile.region).forEach((c) => {
      items.push({
        key: "rep-" + c.id, kind: "Needs Rep",
        title: `${c.name} — assign a rep`, sub: fmtDealValue(c) + " deal",
        urgency: 3, icon: UserPlus, companyId: c.id,
      });
    });
  }
  // A bd_consultant-created company (auto-assigned to themselves, migration
  // 015) always starts pending_review = true — owner always sees every one;
  // a geo_partner only sees their own region's (companies is no longer
  // region-scoped by RLS for them as of migration 039, so this region
  // check is what keeps it to what's actually theirs to confirm).
  // Every type='install' task without a *completed* checklist surfaces
  // here — not just missing ones — since an edit after completion clears
  // completedAt back to null (see upsertPreInstallChecklist), so a stale
  // "done" can't hide a detail that changed since. Not gated by stage/role:
  // it's flagged the moment such a task exists, for whoever can already
  // see that company. Excluded once bypassed (migration 026) — an Owner
  // bypassing a checklist never sets completedAt, so without this check it
  // would keep nagging "fill out pre-install checklist" forever on a task
  // that was explicitly marked as not needing one.
  tasks.filter((t) => t.type === "install").forEach((t) => {
    if (!t.checklist?.completedAt && !t.checklist?.bypassedAt) {
      items.push({
        key: "checklist-" + t.id, kind: "Pre-Install Checklist",
        title: `${t.title} (${t.company}) — fill out pre-install checklist`,
        sub: t.checklist ? "In progress" : "Not started",
        urgency: 2, icon: ClipboardList, companyId: t.companyId,
      });
    }
  });
  if (profile?.role === "owner" || profile?.role === "geo_partner") {
    companies.filter((c) => c.pendingReview && (profile.role === "owner" || c.region === profile.region)).forEach((c) => {
      items.push({
        key: "review-" + c.id, kind: "Pending Review",
        title: `${c.name} — review new company`, sub: `Added by ${c.rep}`,
        urgency: 3, icon: ClipboardCheck, companyId: c.id,
      });
    });
  }
  return items.sort((a, b) => b.urgency - a.urgency).slice(0, 8);
}
