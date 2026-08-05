import { recentMonths, monthLabel, monthPeriod } from "./helpers.js";

function buildRevenueHistory(revenueEntries) {
  return recentMonths().map((d) => {
    const period = monthPeriod(d);
    const entry = revenueEntries.find((r) => r.period === period);
    return { month: monthLabel(d), value: entry ? Number(entry.amount) : 0 };
  });
}

// Usage = a count of completed orders (orders_count), not a dollar figure —
// gross_revenue/amount still only drive the revenue-share % calc elsewhere.
function buildUsageHistory(csvUploads) {
  return recentMonths().map((d) => {
    const monthKey = monthPeriod(d).slice(0, 7); // 'YYYY-MM'
    const value = csvUploads
      .filter((r) => r.upload_date.slice(0, 7) === monthKey)
      .reduce((s, r) => s + (r.orders_count || 0), 0);
    return { month: monthLabel(d), value };
  });
}

export function transformCompany(row) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    industry: row.industry,
    city: row.city,
    region: row.region,
    repId: row.rep_id,
    rep: row.rep?.name || "Unassigned",
    stage: row.stage,
    status: row.status,
    repConfirmed: row.rep_confirmed,
    dealType: row.deal_type,
    dealValue: Number(row.deal_value),
    createdDate: row.created_date,
    lastContact: row.last_contact,
    nextFollowUp: row.next_follow_up,
    closedDate: row.closed_date,
    interest: row.interest,
    contacts: (row.contacts || []).map((c) => ({
      id: c.id, name: c.name, role: c.role, email: c.email, phone: c.phone, primary: c.is_primary,
    })),
    outlets: (row.outlets || []).map((o) => ({
      id: o.id,
      name: o.name,
      address: o.address,
      devices: (o.devices || []).map((d) => ({
        id: d.id, type: d.type, serial: d.serial, status: d.status, installed: d.installed_date,
      })),
    })),
    activity: (row.activity_log || []).map((a) => ({
      id: a.id, date: a.occurred_at, type: a.type, user: a.user?.name || "—", summary: a.summary,
    })),
    notes: (row.notes || []).map((n) => ({
      id: n.id, date: n.created_at.slice(0, 10), author: n.author?.name || "—", text: n.body,
    })),
    revenueHistory: buildRevenueHistory(row.revenue_entries || []),
    usageHistory: buildUsageHistory(row.revenue_csv_uploads || []),
    usageDaily: (row.revenue_csv_uploads || [])
      .map((r) => ({ date: r.upload_date, orders: r.orders_count || 0 }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export function transformTask(row) {
  return {
    id: row.id,
    companyId: row.company_id,
    company: row.company?.name || "—",
    title: row.title,
    due: row.due_date,
    type: row.type,
    done: row.done,
  };
}

export function transformActivityEntry(row) {
  return {
    id: row.id,
    companyId: row.company_id,
    companyName: row.company?.name || row.company_name || "—",
    userId: row.user_id,
    userName: row.user?.name || "—",
    type: row.type,
    summary: row.summary,
    date: row.occurred_at,
  };
}
