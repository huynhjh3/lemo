/* ==============================================================
   DATA MODEL & STORE
   Implements the Company -> Outlet -> Chair hierarchy, ID scheme,
   business-type revenue rules, and usage-snapshot history described
   in the Lemo Wellness "How We Organize & Upload Our Data" SOP.
   ============================================================== */

export const STAGE_ORDER = ["Lead", "Contacted", "Proposal", "Negotiation", "Won", "Lost"];
export const STAGE_PROB = { Lead: 0.1, Contacted: 0.25, Proposal: 0.5, Negotiation: 0.75, Won: 1, Lost: 0 };
export const TODAY = new Date("2026-07-14T09:00:00");

export const BUSINESS_TYPES = {
  enterprise: { label: "Enterprise", legacyLabel: "Corporate" },
  revenue_share: { label: "Revenue share", legacyLabel: "Venue revenue sharing" },
};

/* ---------- ID helpers (Section 3 / 5 of the SOP) ---------- */

// Company IDs: CO0001, CO0002, ...
export function nextCompanyId(companies) {
  const max = companies.reduce((m, c) => {
    const n = parseInt((c.id || "CO0000").replace("CO", ""), 10) || 0;
    return Math.max(m, n);
  }, 0);
  return "CO" + String(max + 1).padStart(4, "0");
}

// Outlet IDs: two-letter city/market code + sequential number, e.g. LA01, AU02.
// The code tells you the market; the number tells you which outlet in that market.
function cityCode(city) {
  const clean = (city || "").split(",")[0].trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase().padEnd(2, "X");
}

export function nextOutletId(allCompanies, city) {
  const code = cityCode(city);
  const used = allCompanies
    .flatMap((c) => c.outlets)
    .map((o) => o.id)
    .filter((id) => id.startsWith(code))
    .map((id) => parseInt(id.slice(2), 10) || 0);
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return code + String(next).padStart(2, "0");
}

/* ---------- Revenue (Section 10) ---------- */

// Enterprise: flat monthly fee. Revenue share: split% of that period's chair usage.
// Split is stored per-company in case a partner has a non-default deal.
export function companyRevenue(company, usageTotalForPeriod = 0) {
  if (company.businessType === "enterprise") {
    return company.monthlyFee || 0;
  }
  const splitToLemo = company.splitToLemo ?? 80;
  return Math.round(usageTotalForPeriod * (splitToLemo / 100));
}

/* ---------- Seed data ---------- */
// Same eight companies as the original demo, extended with the SOP's
// Company/Outlet/Chair structure, business type, and usage snapshot history.

function seedUsageHistory(startTotal, dailyGrowth, days, flags = {}) {
  // Builds a run of dated snapshots ending 2026-07-14, growth per day,
  // optional flags: offlineFrom (index where growth stops), resetAt (index of a hardware reset).
  const out = [];
  let total = startTotal;
  const end = new Date("2026-07-14T00:00:00");
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const idx = days - 1 - i;
    if (flags.resetAt === idx) total = Math.max(0, Math.round(total * 0.05));
    else if (flags.offlineFrom == null || idx < flags.offlineFrom) total += dailyGrowth;
    out.push({ date: d.toISOString().slice(0, 10), total });
  }
  return out;
}

const seedCompanies = [
  {
    key: "c1", name: "Brightside Diners", industry: "Restaurant Group", city: "Austin, TX",
    rep: "Maria Chen", stage: "Negotiation", status: "attention", dealValue: 48000,
    createdDate: "2026-05-10", lastContact: "2026-07-08", nextFollowUp: "2026-07-15",
    interest: "Expanding chair rollout to all 12 locations by Q4. Price-sensitive on volume tiers.",
    businessType: "revenue_share", splitToLemo: 80, monthlyFee: null,
    contacts: [
      { id: "p1", name: "Devon Ruiz", role: "Director of Operations", email: "devon@brightsidediners.com", phone: "(512) 555-0142", primary: true },
      { id: "p2", name: "Alicia Nguyen", role: "IT Manager", email: "alicia@brightsidediners.com", phone: "(512) 555-0198" },
    ],
    outlets: [
      { id: "AU01", name: "Brightside – Downtown", address: "118 Congress Ave, Austin, TX", chairs: [
        { serial: "RX2-88213", type: "Smart Router X2", status: "online", installed: "2026-03-12", usageHistory: seedUsageHistory(4200, 38, 30) },
        { serial: "KT-40921", type: "Kiosk Terminal", status: "offline", installed: "2026-03-12", usageHistory: seedUsageHistory(1900, 22, 30, { offlineFrom: 25 }) },
      ]},
      { id: "AU02", name: "Brightside – Domain", address: "3315 Esperanza Crossing, Austin, TX", chairs: [
        { serial: "RX2-88214", type: "Smart Router X2", status: "online", installed: "2026-05-02", usageHistory: seedUsageHistory(900, 41, 30) },
      ]},
    ],
    activity: [
      { id: "a1", date: "2026-07-08", type: "call", user: "Maria Chen", summary: "Discussed rollout timeline for remaining 4 locations." },
      { id: "a2", date: "2026-06-29", type: "email", user: "Maria Chen", summary: "Sent updated proposal with volume pricing." },
      { id: "a3", date: "2026-06-14", type: "install", user: "Field Team", summary: "Completed install at Domain location." },
      { id: "a4", date: "2026-05-30", type: "meeting", user: "Maria Chen", summary: "On-site demo with ops and IT leadership." },
    ],
    notes: [{ id: "n1", date: "2026-07-08", author: "Maria Chen", text: "Budget approved for FY, waiting on legal review of contract terms." }],
    revenueHistory: [{ month: "Feb", value: 0 }, { month: "Mar", value: 6200 }, { month: "Apr", value: 6200 }, { month: "May", value: 9400 }, { month: "Jun", value: 9400 }, { month: "Jul", value: 9400 }],
  },
  {
    key: "c2", name: "Northgate Retail Group", industry: "Big-Box Retail", city: "Denver, CO",
    rep: "Maria Chen", stage: "Proposal", status: "healthy", dealValue: 62000,
    createdDate: "2026-06-01", lastContact: "2026-07-11", nextFollowUp: "2026-07-17",
    interest: "Needs redundant connectivity for 6 stores ahead of holiday season. Fast decision cycle.",
    businessType: "revenue_share", splitToLemo: 80, monthlyFee: null,
    contacts: [{ id: "p3", name: "Grace Kim", role: "VP Store Operations", email: "gkim@northgateretail.com", phone: "(303) 555-0110", primary: true }],
    outlets: [
      { id: "DE01", name: "Northgate – Cherry Creek", address: "2800 E 1st Ave, Denver, CO", chairs: [
        { serial: "RX2-90110", type: "Smart Router X2", status: "online", installed: "2026-06-20", usageHistory: seedUsageHistory(300, 30, 30) },
      ]},
    ],
    activity: [
      { id: "a5", date: "2026-07-11", type: "email", user: "Maria Chen", summary: "Shared proposal covering all 6 stores with fallback LTE add-on." },
      { id: "a6", date: "2026-07-02", type: "meeting", user: "Maria Chen", summary: "Discovery call — mapped current outage pain points." },
    ],
    notes: [{ id: "n2", date: "2026-07-02", author: "Maria Chen", text: "Compares us against a competitor on price only — lean on uptime SLA." }],
    revenueHistory: [{ month: "Feb", value: 0 }, { month: "Mar", value: 0 }, { month: "Apr", value: 0 }, { month: "May", value: 0 }, { month: "Jun", value: 2100 }, { month: "Jul", value: 2100 }],
  },
  {
    key: "c3", name: "Camden Hotels", industry: "Hospitality", city: "Charleston, SC",
    rep: "Josh Bell", stage: "Lead", status: "healthy", dealValue: 21000,
    createdDate: "2026-07-05", lastContact: "2026-07-09", nextFollowUp: "2026-07-16",
    interest: "Inbound lead from trade show. Wants guest-facing upgrade across 3 boutique properties.",
    businessType: "revenue_share", splitToLemo: 80, monthlyFee: null,
    contacts: [{ id: "p4", name: "Priya Shah", role: "GM", email: "priya@camdenhotels.com", phone: "(843) 555-0177", primary: true }],
    outlets: [{ id: "CH01", name: "Camden – Waterfront", address: "45 Harbor St, Charleston, SC", chairs: [] }],
    activity: [{ id: "a7", date: "2026-07-09", type: "call", user: "Josh Bell", summary: "Intro call — qualified budget and timeline." }],
    notes: [],
    revenueHistory: [{ month: "Feb", value: 0 }, { month: "Mar", value: 0 }, { month: "Apr", value: 0 }, { month: "May", value: 0 }, { month: "Jun", value: 0 }, { month: "Jul", value: 0 }],
  },
  {
    key: "c4", name: "Union Square Markets", industry: "Grocery", city: "San Francisco, CA",
    rep: "Maria Chen", stage: "Contacted", status: "risk", dealValue: 15000,
    createdDate: "2026-06-10", lastContact: "2026-06-24", nextFollowUp: "2026-07-13",
    interest: "Went quiet after initial pricing call. Original champion may have left the company.",
    businessType: "revenue_share", splitToLemo: 80, monthlyFee: null,
    contacts: [{ id: "p5", name: "Marcus Lee", role: "Facilities Lead", email: "mlee@unionsquaremkts.com", phone: "(415) 555-0133", primary: true }],
    outlets: [{ id: "SF01", name: "Union Square Markets – SoMa", address: "500 Folsom St, San Francisco, CA", chairs: [] }],
    activity: [
      { id: "a8", date: "2026-06-24", type: "email", user: "Maria Chen", summary: "Followed up on pricing questions — no response." },
      { id: "a9", date: "2026-06-15", type: "call", user: "Maria Chen", summary: "Initial pricing discussion, positive tone." },
    ],
    notes: [{ id: "n3", date: "2026-06-24", author: "Maria Chen", text: "Try reaching out via LinkedIn — email may be going stale." }],
    revenueHistory: [{ month: "Feb", value: 0 }, { month: "Mar", value: 0 }, { month: "Apr", value: 0 }, { month: "May", value: 0 }, { month: "Jun", value: 0 }, { month: "Jul", value: 0 }],
  },
  {
    key: "c5", name: "Pacific Fuel Stops", industry: "Fuel & Convenience", city: "Sacramento, CA",
    rep: "Josh Bell", stage: "Won", status: "healthy", dealValue: 94000,
    createdDate: "2026-04-01", lastContact: "2026-07-10", nextFollowUp: "2026-08-01",
    interest: "Signed for 14 sites. Now in phased rollout — expansion opportunity for EV charger monitoring.",
    businessType: "enterprise", splitToLemo: null, monthlyFee: 13400,
    contacts: [{ id: "p6", name: "Renee Ford", role: "Regional Director", email: "renee@pacificfuel.com", phone: "(916) 555-0188", primary: true }],
    outlets: [
      { id: "SA01", name: "Pacific Fuel – I-80 Hub", address: "2100 W El Camino Ave, Sacramento, CA", chairs: [
        { serial: "RX2-77120", type: "Smart Router X2", status: "online", installed: "2026-06-01", usageHistory: seedUsageHistory(2000, 60, 30) },
        { serial: "PG-11029", type: "Payment Gateway", status: "online", installed: "2026-06-01", usageHistory: seedUsageHistory(1500, 5, 30, { resetAt: 20 }) },
      ]},
    ],
    activity: [
      { id: "a10", date: "2026-07-10", type: "install", user: "Field Team", summary: "Installed 3rd of 14 sites, on schedule." },
      { id: "a11", date: "2026-06-01", type: "meeting", user: "Josh Bell", summary: "Kickoff call with rollout project team." },
    ],
    notes: [{ id: "n4", date: "2026-06-01", author: "Josh Bell", text: "Flag for upsell: EV charger monitoring add-on once rollout completes." }],
    revenueHistory: [{ month: "Feb", value: 0 }, { month: "Mar", value: 0 }, { month: "Apr", value: 0 }, { month: "May", value: 0 }, { month: "Jun", value: 6700 }, { month: "Jul", value: 13400 }],
  },
  {
    key: "c6", name: "Ridgeline Fitness Clubs", industry: "Fitness", city: "Salt Lake City, UT",
    rep: "Maria Chen", stage: "Negotiation", status: "risk", dealValue: 33000,
    createdDate: "2026-05-20", lastContact: "2026-06-20", nextFollowUp: "2026-07-14",
    interest: "Negotiating contract length — wants 12-month instead of 24-month term.",
    businessType: "revenue_share", splitToLemo: 80, monthlyFee: null,
    contacts: [{ id: "p7", name: "Tom Bradley", role: "Owner", email: "tom@ridgelinefit.com", phone: "(801) 555-0166", primary: true }],
    outlets: [{ id: "SL01", name: "Ridgeline – Sugar House", address: "2100 S 700 E, Salt Lake City, UT", chairs: [
      { serial: "RX2-65310", type: "Smart Router X2", status: "online", installed: "2026-05-28", usageHistory: seedUsageHistory(600, 25, 30) },
    ]}],
    activity: [
      { id: "a12", date: "2026-06-20", type: "call", user: "Maria Chen", summary: "Pushed back on 24-month term, wants flexibility." },
      { id: "a13", date: "2026-06-05", type: "install", user: "Field Team", summary: "Pilot install completed at Sugar House location." },
    ],
    notes: [{ id: "n5", date: "2026-06-20", author: "Maria Chen", text: "Stalled 24 days — needs a decision this week or deal is at risk." }],
    revenueHistory: [{ month: "Feb", value: 0 }, { month: "Mar", value: 0 }, { month: "Apr", value: 0 }, { month: "May", value: 0 }, { month: "Jun", value: 1800 }, { month: "Jul", value: 1800 }],
  },
  {
    key: "c7", name: "Solstice Coffee Co.", industry: "Coffee & Cafe", city: "Portland, OR",
    rep: "Josh Bell", stage: "Proposal", status: "attention", dealValue: 27000,
    createdDate: "2026-06-15", lastContact: "2026-07-06", nextFollowUp: "2026-07-14",
    interest: "8-location chain, wants usage analytics bundled in. Comparing 2 vendors.",
    businessType: "revenue_share", splitToLemo: 80, monthlyFee: null,
    contacts: [{ id: "p8", name: "Emma Ostrowski", role: "Operations Manager", email: "emma@solsticecoffee.com", phone: "(503) 555-0121", primary: true }],
    outlets: [{ id: "PO01", name: "Solstice – Pearl District", address: "1200 NW Everett St, Portland, OR", chairs: [
      { serial: "RX2-99881", type: "Smart Router X2", status: "online", installed: "2026-07-12", usageHistory: seedUsageHistory(0, 0, 3) },
    ] }],
    activity: [{ id: "a14", date: "2026-07-06", type: "email", user: "Josh Bell", summary: "Sent comparison sheet against their current provider." }],
    notes: [{ id: "n6", date: "2026-07-06", author: "Josh Bell", text: "Decision expected by end of month, keep proposal visible." }],
    revenueHistory: [{ month: "Feb", value: 0 }, { month: "Mar", value: 0 }, { month: "Apr", value: 0 }, { month: "May", value: 0 }, { month: "Jun", value: 0 }, { month: "Jul", value: 0 }],
  },
  {
    key: "c8", name: "Anchor Point Logistics", industry: "Warehousing", city: "Memphis, TN",
    rep: "Josh Bell", stage: "Lost", status: "healthy", dealValue: 18000,
    createdDate: "2026-04-20", lastContact: "2026-05-25", nextFollowUp: null,
    interest: "Went with an in-house IT solution instead. Revisit in 6 months.",
    businessType: "revenue_share", splitToLemo: 80, monthlyFee: null,
    contacts: [{ id: "p9", name: "Wayne Griggs", role: "IT Director", email: "wgriggs@anchorpointlog.com", phone: "(901) 555-0155" }],
    outlets: [],
    activity: [{ id: "a15", date: "2026-05-25", type: "call", user: "Josh Bell", summary: "Told us they're building an internal solution instead." }],
    notes: [{ id: "n7", date: "2026-05-25", author: "Josh Bell", text: "Set a reminder to check back in around November." }],
    revenueHistory: [{ month: "Feb", value: 0 }, { month: "Mar", value: 0 }, { month: "Apr", value: 0 }, { month: "May", value: 0 }, { month: "Jun", value: 0 }, { month: "Jul", value: 0 }],
  },
];

export function buildInitialCompanies() {
  // Assign real CO#### ids in a stable, deterministic order.
  return seedCompanies.map((c, i) => ({ ...c, id: "CO" + String(i + 1).padStart(4, "0") }));
}

export const TASKS = [
  { id: "t1", title: "Send redlined contract back to legal", company: "Brightside Diners", due: "2026-07-12", type: "email", done: false },
  { id: "t2", title: "Re-engage via LinkedIn — champion may have left", company: "Union Square Markets", due: "2026-07-13", type: "call", done: false },
  { id: "t3", title: "Follow up on 12-month term ask", company: "Ridgeline Fitness Clubs", due: "2026-07-14", type: "call", done: false },
  { id: "t4", title: "Check in on WiFi upgrade timeline", company: "Camden Hotels", due: "2026-07-14", type: "meeting", done: false },
  { id: "t5", title: "Confirm proposal received, answer questions", company: "Northgate Retail Group", due: "2026-07-17", type: "email", done: false },
  { id: "t6", title: "Site visit — 4th install of rollout", company: "Pacific Fuel Stops", due: "2026-07-18", type: "meeting", done: false },
];

export const CLOSED_WON_HISTORY = [29, 41, 22, 35, 30, 44, 27, 33, 38, 25, 31, 46, 28, 36];
export const CLOSED_LOST_COUNT = 6;

/* ---------- Reducer (Section 12: add/edit/delete everywhere) ---------- */

export function companiesReducer(state, action) {
  switch (action.type) {
    case "ADD_COMPANY": {
      const id = nextCompanyId(state);
      const company = {
        id, outlets: [], contacts: [], activity: [], notes: [],
        revenueHistory: [{ month: "Feb", value: 0 }, { month: "Mar", value: 0 }, { month: "Apr", value: 0 }, { month: "May", value: 0 }, { month: "Jun", value: 0 }, { month: "Jul", value: 0 }],
        stage: "Lead", status: "healthy", dealValue: 0,
        createdDate: TODAY.toISOString().slice(0, 10), lastContact: TODAY.toISOString().slice(0, 10), nextFollowUp: null,
        businessType: "revenue_share", splitToLemo: 80, monthlyFee: null,
        ...action.payload,
      };
      return [...state, company];
    }
    case "UPDATE_COMPANY":
      return state.map((c) => (c.id === action.id ? { ...c, ...action.payload } : c));
    case "ARCHIVE_COMPANY":
      return state.map((c) => (c.id === action.id ? { ...c, archived: true } : c));
    case "DELETE_COMPANY":
      return state.filter((c) => c.id !== action.id);

    case "MOVE_STAGE":
      return state.map((c) => (c.id === action.id ? { ...c, stage: action.stage } : c));

    case "ADD_OUTLET": {
      return state.map((c) => {
        if (c.id !== action.companyId) return c;
        const id = nextOutletId(state, action.payload.city || c.city);
        return { ...c, outlets: [...c.outlets, { id, chairs: [], ...action.payload }] };
      });
    }
    case "DELETE_OUTLET":
      return state.map((c) =>
        c.id === action.companyId ? { ...c, outlets: c.outlets.filter((o) => o.id !== action.outletId) } : c
      );

    case "ADD_CHAIR": {
      return state.map((c) => {
        if (c.id !== action.companyId) return c;
        return {
          ...c,
          outlets: c.outlets.map((o) =>
            o.id === action.outletId
              ? { ...o, chairs: [...o.chairs, { status: "online", usageHistory: [], ...action.payload }] }
              : o
          ),
        };
      });
    }
    case "UPDATE_CHAIR_STATUS": {
      return state.map((c) => {
        if (c.id !== action.companyId) return c;
        return {
          ...c,
          outlets: c.outlets.map((o) =>
            o.id !== action.outletId
              ? o
              : { ...o, chairs: o.chairs.map((d) => (d.serial === action.serial ? { ...d, status: action.status } : d)) }
          ),
        };
      });
    }
    case "RETIRE_CHAIR": {
      // Marks retired rather than deleting, so the serial is never reused for a new chair.
      return state.map((c) => {
        if (c.id !== action.companyId) return c;
        return {
          ...c,
          outlets: c.outlets.map((o) =>
            o.id !== action.outletId
              ? o
              : { ...o, chairs: o.chairs.map((d) => (d.serial === action.serial ? { ...d, status: "retired", retired: true } : d)) }
          ),
        };
      });
    }

    case "APPLY_IMPORT_SNAPSHOT": {
      // action.snapshot: { date, rows: [{companyId, companyName, contact, phone, businessType, monthlyFee, splitToLemo, outletId, outletName, city, serial, chairType, usageTotal}] }
      let next = state;
      const touchedKeys = new Set();
      for (const row of action.snapshot.rows) {
        next = applyImportRow(next, row, action.snapshot.date);
        const match = findCompanyMatch(next, row);
        if (match) touchedKeys.add(match.id);
      }
      // Keep the Revenue chart / Revenue page in sync with what the upload
      // just changed, so "Latest period" and the bar chart never disagree.
      next = next.map((c) => (touchedKeys.has(c.id) ? withUpdatedRevenueHistory(c, action.snapshot.date) : c));
      return next;
    }

    default:
      return state;
  }
}

export function normKey(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// A row matches an existing company if its ID matches (normalized), or —
// when no ID is given, or it doesn't match anything — its name matches.
// This is what keeps re-uploads from creating duplicate companies.
export function findCompanyMatch(companies, row) {
  const idKey = normKey(row.companyId);
  const nameKey = normKey(row.companyName);
  if (idKey) {
    const byId = companies.find((c) => normKey(c.id) === idKey);
    if (byId) return byId;
  }
  if (nameKey) {
    const byName = companies.find((c) => normKey(c.name) === nameKey);
    if (byName) return byName;
  }
  return null;
}

function usageAsOfLocal(chair, dateStr) {
  const hist = [...chair.usageHistory].sort((a, b) => a.date.localeCompare(b.date));
  let last = null;
  for (const h of hist) {
    if (h.date <= dateStr) last = h;
    else break;
  }
  return last ? last.total : null;
}

// Sum of each chair's usage gained since the start of the calendar month
// containing `dateStr`. Used to keep a Revenue-share company's revenue in
// sync with the latest upload, the same way companyUsageTotal does in calc.js
// (duplicated locally to avoid a store.js <-> calc.js import cycle).
function companyUsageThisMonth(company, dateStr) {
  const monthStart = dateStr.slice(0, 7) + "-01";
  let sum = 0;
  for (const o of company.outlets) {
    for (const d of o.chairs) {
      const end = usageAsOfLocal(d, dateStr);
      if (end == null) continue;
      const start = usageAsOfLocal(d, monthStart) ?? 0;
      sum += Math.max(0, end - start);
    }
  }
  return sum;
}

// After an import touches a company, refresh its revenueHistory's latest
// month so the Revenue chart / Revenue page total matches what "Latest
// period" on the profile page shows — both should be the same number.
function withUpdatedRevenueHistory(company, dateStr) {
  const amount =
    company.businessType === "enterprise"
      ? company.monthlyFee || 0
      : companyRevenue(company, companyUsageThisMonth(company, dateStr));
  const history = company.revenueHistory.length ? [...company.revenueHistory] : [{ month: "Jul", value: 0 }];
  history[history.length - 1] = { ...history[history.length - 1], value: amount };
  return { ...company, revenueHistory: history };
}

function applyImportRow(state, row, date) {
  let companies = state;
  let company = findCompanyMatch(companies, row);
  if (!company) {
    const id = row.companyId || nextCompanyId(companies);
    company = {
      id, name: row.companyName, industry: row.industry || "—", city: row.city || "",
      rep: "Unassigned", stage: "Won", status: "healthy", dealValue: 0,
      createdDate: date, lastContact: date, nextFollowUp: null,
      interest: "", businessType: row.businessType || "revenue_share",
      splitToLemo: row.splitToLemo ?? 80, monthlyFee: row.monthlyFee ?? null,
      contacts: row.contact ? [{ id: "p-" + id, name: row.contact, role: "Primary Contact", email: "", phone: row.phone || "", primary: true }] : [],
      outlets: [], activity: [], notes: [],
      revenueHistory: [{ month: "Feb", value: 0 }, { month: "Mar", value: 0 }, { month: "Apr", value: 0 }, { month: "May", value: 0 }, { month: "Jun", value: 0 }, { month: "Jul", value: 0 }],
    };
    companies = [...companies, company];
  } else {
    // Existing company matched by ID or name — update it in place rather than
    // creating a new record. The upload sets the baseline; reps can still
    // hand-edit anything afterward (Section 6 of the SOP).
    const existingId = company.id;
    companies = companies.map((c) => {
      if (c.id !== existingId) return c;
      const contacts = row.contact
        ? [
            { id: c.contacts[0]?.id || "p-" + c.id, name: row.contact, role: c.contacts[0]?.role || "Primary Contact", email: c.contacts[0]?.email || "", phone: row.phone || c.contacts[0]?.phone || "", primary: true },
            ...c.contacts.slice(1),
          ]
        : c.contacts;
      return {
        ...c,
        lastContact: date,
        industry: row.industry || c.industry,
        city: row.city || c.city,
        businessType: row.businessType || c.businessType,
        monthlyFee: row.businessType === "enterprise" ? (row.monthlyFee ?? c.monthlyFee) : c.monthlyFee,
        splitToLemo: row.businessType === "revenue_share" ? (row.splitToLemo ?? c.splitToLemo) : c.splitToLemo,
        contacts,
      };
    });
    company = companies.find((c) => c.id === existingId);
  }

  let outlet = company.outlets.find((o) => normKey(o.id) === normKey(row.outletId));
  if (!outlet) {
    outlet = { id: row.outletId || nextOutletId(companies, row.city), name: row.outletName || row.outletId, address: row.city || "", chairs: [] };
    companies = companies.map((c) => (c.id === company.id ? { ...c, outlets: [...c.outlets, outlet] } : c));
  }

  companies = companies.map((c) => {
    if (c.id !== company.id) return c;
    return {
      ...c,
      outlets: c.outlets.map((o) => {
        if (o.id !== outlet.id) return o;
        let chair = o.chairs.find((d) => normKey(d.serial) === normKey(row.serial));
        if (!chair) {
          chair = { serial: row.serial, type: row.chairType || "Chair", status: "online", installed: date, usageHistory: [] };
          return { ...o, chairs: [...o.chairs, { ...chair, usageHistory: [{ date, total: row.usageTotal ?? 0 }] }] };
        }
        return {
          ...o,
          chairs: o.chairs.map((d) =>
            normKey(d.serial) !== normKey(row.serial) ? d : { ...d, usageHistory: [...d.usageHistory.filter((h) => h.date !== date), { date, total: row.usageTotal ?? 0 }].sort((a, b) => a.date.localeCompare(b.date)) }
          ),
        };
      }),
    };
  });

  return companies;
}
