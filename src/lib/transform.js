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

// task_id is a unique FK, so PostgREST embeds this as a to-one relation —
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
  // Newest-first, so [0] is the most recent contact — used below to derive
  // lastContact instead of the companies.last_contact column, which
  // nothing in the app ever writes to and was always empty.
  const communicationsLog = (row.communications_log || [])
    .map((c) => ({
      id: c.id,
      occurredAt: c.occurred_at,
      contactId: c.contact_id,
      contactName: c.contact?.name || c.contact_name || null,
      type: c.type,
      notes: c.notes,
      photoUrls: c.photo_urls || [],
      createdById: c.created_by,
      createdByName: c.createdByProfile?.name || "—",
    }))
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));

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
    // A full timestamp (from communications_log.occurred_at), not a bare
    // date like the old column — format with fmtDateTime, not fmtDate.
    lastContact: communicationsLog[0]?.occurredAt || null,
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
      id: a.id, date: a.occurred_at, createdAt: a.created_at, type: a.type, user: a.user?.name || "—", summary: a.summary,
    })),
    communicationsLog,
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
    checklist: transformChecklist(
      Array.isArray(row.pre_install_checklists) ? row.pre_install_checklists[0] : row.pre_install_checklists
    ),
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

export function transformNote(row) {
  return {
    id: row.id,
    body: row.body,
    companyId: row.company_id,
    companyName: row.company?.name || null,
    targetUserId: row.target_user_id,
    targetUserName: row.targetUser?.name || null,
    targetRegion: row.target_region,
    authorId: row.author_id,
    authorName: row.author?.name || "—",
    createdAt: row.created_at,
    // note_reads' RLS only ever returns the caller's own row. readAt is
    // used two ways (see helpers.js): its mere presence clears a
    // person/region-targeted note from the recipient's HPA, and its value
    // is compared against the latest comment's timestamp to decide whether
    // a reply should re-surface the HPA for the note's own author.
    readAt: row.reads?.[0]?.read_at || null,
    comments: (row.comments || [])
      .map((c) => ({
        id: c.id,
        noteId: c.note_id,
        authorId: c.author_id,
        authorName: c.author?.name || "—",
        body: c.body,
        createdAt: c.created_at,
      }))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
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
