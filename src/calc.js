import { TODAY, STAGE_PROB, TASKS, CLOSED_WON_HISTORY, CLOSED_LOST_COUNT, companyRevenue } from "./store.js";

export const fmtMoney = (n) => "$" + Math.round(n || 0).toLocaleString();
export const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
export const daysSince = (d) => daysBetween(d, TODAY);
export const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

/* ---------- all chairs, flattened, with their parent company/outlet ---------- */
export function allChairs(companies) {
  const out = [];
  for (const c of companies) {
    for (const o of c.outlets) {
      for (const d of o.chairs) out.push({ company: c, outlet: o, chair: d });
    }
  }
  return out;
}

/* ---------- Usage trend math (Section 5/10) ----------
   Usage is a cumulative, ever-increasing counter per chair. Trend comes from
   diffing snapshots, never from a single reading. A drop between two
   snapshots means a swapped/reset chair, not negative usage — flag it. */
export function usageAsOf(chair, dateStr) {
  const hist = [...chair.usageHistory].sort((a, b) => a.date.localeCompare(b.date));
  let last = null;
  for (const h of hist) {
    if (h.date <= dateStr) last = h;
    else break;
  }
  return last ? last.total : null;
}

export function dayOverDay(chair, dateStr = TODAY.toISOString().slice(0, 10)) {
  const today = usageAsOf(chair, dateStr);
  const yestDate = new Date(dateStr + "T00:00:00");
  yestDate.setDate(yestDate.getDate() - 1);
  const yesterday = usageAsOf(chair, yestDate.toISOString().slice(0, 10));
  if (today == null || yesterday == null) return { count: null, pct: null, anomaly: false };
  const count = today - yesterday;
  const pct = yesterday > 0 ? (count / yesterday) * 100 : null;
  return { count, pct, anomaly: count < 0 };
}

export function periodTotal(chair, startDate, endDate) {
  const start = usageAsOf(chair, startDate);
  const end = usageAsOf(chair, endDate);
  if (start == null || end == null) return null;
  return Math.max(0, end - start); // clamp: a hardware reset shouldn't show as negative usage
}

export function companyUsageTotal(company, startDate, endDate) {
  return company.outlets.reduce(
    (sum, o) => sum + o.chairs.reduce((s, d) => s + (periodTotal(d, startDate, endDate) || 0), 0),
    0
  );
}

/* ---------- Pipeline / revenue (extends the original demo math with Section 10) ---------- */

export function pipelineHealth() {
  const overdue = TASKS.filter((t) => !t.done && daysBetween(t.due, TODAY) > 0).length;
  const avgDays = Math.round(CLOSED_WON_HISTORY.reduce((a, b) => a + b, 0) / CLOSED_WON_HISTORY.length);
  const conversion = Math.round((CLOSED_WON_HISTORY.length / (CLOSED_WON_HISTORY.length + CLOSED_LOST_COUNT)) * 100);
  return { overdue, avgDays, conversion };
}

// Forecasted Revenue = every Won Enterprise company's monthly fee, plus 80% (or
// each company's stored split) of every Won Revenue-share company's usage total
// for the period, plus the weighted pipeline value of everything still open.
export function forecastedRevenue(companies, periodStart = "2026-06-14", periodEnd = "2026-07-14") {
  const active = companies.filter((c) => c.stage !== "Won" && c.stage !== "Lost" && !c.archived);
  const weighted = active.reduce((sum, c) => sum + c.dealValue * STAGE_PROB[c.stage], 0);
  const won = companies.filter((c) => c.stage === "Won" && !c.archived);
  const recognizedMRR = won.reduce((sum, c) => {
    if (c.businessType === "enterprise") return sum + companyRevenue(c);
    const usage = companyUsageTotal(c, periodStart, periodEnd);
    return sum + companyRevenue(c, usage);
  }, 0);
  return { total: weighted + recognizedMRR, weighted, recognizedMRR };
}

export function riskyCompanies(companies) {
  return companies
    .filter((c) => c.stage !== "Won" && c.stage !== "Lost" && !c.archived)
    .map((c) => {
      const stale = daysSince(c.lastContact);
      const reasons = [];
      if (c.status === "risk") reasons.push("Marked at risk");
      if (stale > 14) reasons.push(`No contact in ${stale} days`);
      return { ...c, stale, reasons };
    })
    .filter((c) => c.reasons.length > 0)
    .sort((a, b) => b.dealValue - a.dealValue);
}

/* ---------- Usage alerts (Section 11) ----------
   Turns the daily usage snapshot into action items, the same way deal
   risk already surfaces on the Overview page. */
export function usageAlerts(companies, dateStr = TODAY.toISOString().slice(0, 10)) {
  const alerts = [];
  for (const { company, outlet, chair } of allChairs(companies)) {
    if (company.archived || chair.retired) continue;
    const hist = [...chair.usageHistory].sort((a, b) => a.date.localeCompare(b.date));
    if (hist.length === 0) continue;
    const recent = hist.filter((h) => h.date <= dateStr).slice(-7);

    // Zero usage for several days running -> possibly offline
    if (recent.length >= 3) {
      const flat = recent.slice(-3);
      if (flat.every((h) => h.total === flat[0].total)) {
        alerts.push({
          key: `flat-${chair.serial}`, kind: "Possibly Offline", urgency: 3,
          title: `${chair.serial} — no usage in ${flat.length}+ days`,
          sub: `${company.name} · ${outlet.name}`, companyId: company.id,
        });
      }
    }

    // Sharp day-over-day drop (excluding true resets, which are their own alert below)
    const dod = dayOverDay(chair, dateStr);
    if (dod.count != null && dod.count > 0 && dod.pct != null && dod.pct < -40) {
      alerts.push({
        key: `drop-${chair.serial}`, kind: "Sharp Drop", urgency: 2,
        title: `${chair.serial} — usage down ${Math.abs(Math.round(dod.pct))}% day over day`,
        sub: `${company.name} · ${outlet.name}`, companyId: company.id,
      });
    }

    // Hardware reset / swap: total went down between snapshots
    if (dod.anomaly) {
      alerts.push({
        key: `reset-${chair.serial}`, kind: "Needs Review", urgency: 3,
        title: `${chair.serial} — usage counter dropped, likely a swap or reset`,
        sub: `${company.name} · ${outlet.name}`, companyId: company.id,
      });
    }

    // Newly installed, still zero usage
    const daysInstalled = daysBetween(chair.installed, dateStr);
    const total = hist[hist.length - 1]?.total ?? 0;
    if (daysInstalled <= 7 && total === 0) {
      alerts.push({
        key: `new-${chair.serial}`, kind: "Confirm Live", urgency: 1,
        title: `${chair.serial} — newly installed, no usage yet`,
        sub: `${company.name} · ${outlet.name}`, companyId: company.id,
      });
    }
  }

  // Revenue-share companies tracking behind their usual pace this month
  const monthStart = dateStr.slice(0, 8) + "01";
  for (const c of companies) {
    if (c.archived || c.businessType !== "revenue_share" || c.stage !== "Won") continue;
    const soFar = companyUsageTotal(c, monthStart, dateStr);
    const daysElapsed = Math.max(1, daysBetween(monthStart, dateStr));
    const dailyPace = soFar / daysElapsed;
    const priorMonthDays = 30;
    const priorStart = new Date(monthStart + "T00:00:00");
    priorStart.setDate(priorStart.getDate() - priorMonthDays);
    const priorTotal = companyUsageTotal(c, priorStart.toISOString().slice(0, 10), monthStart);
    const priorPace = priorTotal / priorMonthDays;
    if (priorPace > 0 && dailyPace < priorPace * 0.6) {
      alerts.push({
        key: `pace-${c.id}`, kind: "At-Risk Revenue", urgency: 2,
        title: `${c.name} — usage pace down vs. last month, revenue share at risk`,
        sub: fmtMoney(companyRevenue(c, soFar)) + " so far this month", companyId: c.id,
      });
    }
  }

  return alerts.sort((a, b) => b.urgency - a.urgency);
}

export function highPriorityActions(companies) {
  const items = [];
  TASKS.filter((t) => !t.done && daysBetween(t.due, TODAY) >= 0).forEach((t) => {
    const overdue = daysBetween(t.due, TODAY) > 0;
    items.push({
      key: "task-" + t.id, kind: overdue ? "Overdue" : "Due Today",
      title: t.title, sub: t.company, urgency: overdue ? 3 : 2, type: "task",
    });
  });
  riskyCompanies(companies).forEach((c) => {
    items.push({
      key: "risk-" + c.id, kind: "At Risk", title: `${c.name} — ${c.reasons[0]}`,
      sub: fmtMoney(c.dealValue) + " deal", urgency: c.status === "risk" ? 3 : 1, type: "risk", companyId: c.id,
    });
  });
  usageAlerts(companies).forEach((a) => items.push({ ...a, type: "usage" }));
  return items.sort((a, b) => b.urgency - a.urgency).slice(0, 8);
}

/* ---------- Import diff (Section 7): preview before Confirm ----------
   Walks each row: company already listed? outlet already listed under it?
   chair already listed under that outlet? Existing -> updated, new -> added. */
export function computeImportDiff(rows, companies) {
  const result = { newCompanies: 0, updatedCompanies: 0, newOutlets: 0, newChairs: 0, updatedChairs: 0, warnings: [], rows: [] };
  const seenCompanyIds = new Set();
  for (const row of rows) {
    const company = companies.find((c) => c.id === row.companyId || c.name === row.companyName);
    const isNewCompany = !company;
    if (isNewCompany) {
      if (!seenCompanyIds.has(row.companyId || row.companyName)) result.newCompanies++;
    } else if (!seenCompanyIds.has(company.id)) {
      result.updatedCompanies++;
    }
    seenCompanyIds.add(row.companyId || row.companyName);

    const outlet = company?.outlets.find((o) => o.id === row.outletId);
    if (!outlet) result.newOutlets++;

    const chair = outlet?.chairs.find((d) => d.serial === row.serial);
    if (!chair) result.newChairs++;
    else result.updatedChairs++;

    let status = !company ? "new company" : !outlet ? "new outlet" : !chair ? "new chair" : "usage update";
    if (chair) {
      const lastTotal = chair.usageHistory.length ? chair.usageHistory[chair.usageHistory.length - 1].total : 0;
      if (row.usageTotal < lastTotal) {
        status = "flagged: usage decreased (possible swap/reset)";
        result.warnings.push(`${row.serial}: usage went from ${lastTotal} to ${row.usageTotal}`);
      }
    }
    if (!row.serial) result.warnings.push(`Row for ${row.companyName || row.companyId} is missing a chair serial`);

    result.rows.push({ ...row, status });
  }
  return result;
}
