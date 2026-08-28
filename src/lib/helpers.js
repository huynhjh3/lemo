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

// Both revenueHistory and usageHistory end with the most recent month —
// shared by the Revenue and Usage pages' "by region"/"by company" tables.
export function lastTwoMonths(history) {
  return {
    thisMonth: history[history.length - 1]?.value || 0,
    lastMonth: history[history.length - 2]?.value || 0,
  };
}

// Sums a history key (revenueHistory or usageHistory) into thisMonth/
// lastMonth totals per region — feeds the top-level "by region" table
// before drilling into a single region's companies (companiesByHistory).
export function groupByRegion(companies, historyKey) {
  const byRegion = new Map();
  companies.forEach((c) => {
    const { thisMonth, lastMonth } = lastTwoMonths(c[historyKey]);
    if (thisMonth === 0 && lastMonth === 0) return;
    const region = c.region || NO_REGION_LABEL;
    const existing = byRegion.get(region) || { region, thisMonth: 0, lastMonth: 0 };
    existing.thisMonth += thisMonth;
    existing.lastMonth += lastMonth;
    byRegion.set(region, existing);
  });
  return Array.from(byRegion.values()).sort((a, b) => b.thisMonth - a.thisMonth);
}

// Same this/lastMonth shape as groupByRegion, scoped to one region's
// companies — the drill-down table once a region row is clicked.
export function companiesByHistory(companies, historyKey, region) {
  return companies
    .filter((c) => (c.region || NO_REGION_LABEL) === region)
    .map((c) => ({ ...c, ...lastTwoMonths(c[historyKey]) }))
    .filter((c) => c.thisMonth > 0 || c.lastMonth > 0)
    .sort((a, b) => b.thisMonth - a.thisMonth);
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
function stageEnteredAt(company) {
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

export function pipelineHealth(companies, tasks, profile) {
  // Same region-only scoping as the rest of the follow-up feature for a
  // Strategic Partner (see highPriorityActions) — companies itself is no
  // longer region-scoped by RLS for them (migration 039).
  const scoped = profile?.role === "geo_partner" ? companies.filter((c) => c.region === profile.region) : companies;
  const overdue = scoreFollowUps(scoped, tasks).length;
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
