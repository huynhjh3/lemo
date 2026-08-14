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

// Only populated for devices the CSV upload could match by serial (see
// UploadPage's optional "Chair ID" column) — a device with no matching
// upload rows still appears, just with 0 orders, so every chair shows up
// in the breakdown even before any chair-level data exists for it.
function buildUsageByChair(outlets) {
  return outlets.flatMap((o) =>
    (o.devices || []).map((d) => ({
      id: d.id,
      label: `${d.type}${d.serial ? ` · ${d.serial}` : ""}`,
      orders: (d.device_usage_uploads || []).reduce((s, u) => s + (u.orders_count || 0), 0),
    }))
  );
}

// outlet_id is a unique FK, so PostgREST embeds this as a to-one relation —
// a single object (or null), NOT an array — unlike devices/contacts/etc.
// below, which are genuine to-many relations. Handling both shapes here
// defensively (rather than assuming array) is what actually matters: an
// earlier version of this function assumed array-always and silently
// dropped every checklist, which is why Save appeared to do nothing.
function transformChecklist(row) {
  if (!row) return null;
  return {
    id: row.id,
    preferredInstallStart: row.preferred_install_start,
    preferredInstallEnd: row.preferred_install_end,
    requiredCompletionDate: row.required_completion_date,
    installTimeStart: row.install_time_start,
    installTimeEnd: row.install_time_end,
    deadlineFlexible: row.deadline_flexible,
    deadlineEventDetails: row.deadline_event_details,
    availableSpace: row.available_space,
    chairArrangement: row.chair_arrangement,
    floorAccess: row.floor_access,
    outletsNearChairs: row.outlets_near_chairs,
    photosLink: row.photos_link,
    deliveryAccess: row.delivery_access,
    siteRequirements: row.site_requirements || [],
    siteRequirementsOther: row.site_requirements_other,
    accessInstructions: row.access_instructions,
    earlyReceipt: row.early_receipt,
    additionalNotes: row.additional_notes,
    completedAt: row.completed_at,
    submittedForInstallAt: row.submitted_for_install_at,
    submittedBy: row.submitted_by,
    approvedForInstallAt: row.approved_for_install_at,
    approvedBy: row.approved_by,
    bypassedAt: row.bypassed_at,
    bypassedBy: row.bypassed_by,
    updatedAt: row.updated_at,
  };
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
    pendingReview: row.pending_review,
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
      checklist: transformChecklist(
        Array.isArray(o.pre_install_checklists) ? o.pre_install_checklists[0] : o.pre_install_checklists
      ),
    })),
    activity: (row.activity_log || []).map((a) => ({
      id: a.id, date: a.occurred_at, createdAt: a.created_at, type: a.type, user: a.user?.name || "—", summary: a.summary,
    })),
    notes: (row.notes || []).map((n) => ({
      id: n.id, date: n.created_at.slice(0, 10), author: n.author?.name || "—", text: n.body,
    })),
    revenueHistory: buildRevenueHistory(row.revenue_entries || []),
    usageHistory: buildUsageHistory(row.revenue_csv_uploads || []),
    usageDaily: (row.revenue_csv_uploads || [])
      .map((r) => ({ date: r.upload_date, orders: r.orders_count || 0 }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    usageByChair: buildUsageByChair(row.outlets || []),
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

export function transformShowroomBooking(row) {
  return {
    id: row.id,
    startAt: row.start_at,
    endAt: row.end_at,
    companyId: row.company_id,
    companyName: row.company?.name || null,
    prospectName: row.prospect_name,
    notes: row.notes,
    bookedById: row.booked_by,
    bookedByName: row.bookedByProfile?.name || "—",
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
