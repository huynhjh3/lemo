// Per-influencer numbers for the Inbox -> Influencers tab. Everything here is computed
// from data the CRM already loads (companies + their revenue), the influencer's
// referrals, and the landing page's visit events — no separate tracking.
import { computeLandingStats } from "./landingStats.js";

export const LINK_BASE = "https://lemowellness.com/connect";

// ?src is what the CRM reads; the utm_* tags are what Google Analytics reads.
export function trackedLink(inf) {
  const q = new URLSearchParams({ src: inf.slug, utm_source: inf.platform || "instagram", utm_medium: "influencer", utm_campaign: inf.slug });
  return `${LINK_BASE}?${q.toString()}`;
}

export function slugify(text) {
  return (text || "").toLowerCase().replace(/^@/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

export function describeCommission(inf) {
  if (inf.commission_type === "flat_per_install") return `$${Number(inf.commission_value).toLocaleString()} for each installed company`;
  if (inf.commission_type === "percent_revenue") {
    return `${Number(inf.commission_value)}% of recorded revenue${inf.commission_months ? ` for each company's first ${inf.commission_months} months` : ""}`;
  }
  return "No commission set";
}

// Revenue the CRM has for one company, optionally only its first N months with revenue.
function companyRevenue(company, firstMonths) {
  const months = (company.revenueHistory || []).map((m) => Number(m?.value) || 0);
  const live = months.filter((v) => v > 0);
  return (firstMonths ? live.slice(0, firstMonths) : live).reduce((s, v) => s + v, 0);
}

export function computeInfluencerStats({ influencers, referrals, companies, events, leads }) {
  const byId = new Map(companies.map((c) => [c.id, c]));
  return influencers.map((inf) => {
    const refs = referrals.filter((r) => r.influencer_id === inf.id);
    const referred = refs.map((r) => ({ ref: r, company: byId.get(r.company_id) })).filter((x) => x.company);
    const installed = referred.filter((x) => x.company.stage === "Installed");
    const revenue = referred.reduce((s, x) => s + companyRevenue(x.company), 0);
    let commission = 0;
    if (inf.commission_type === "flat_per_install") commission = installed.length * Number(inf.commission_value);
    else if (inf.commission_type === "percent_revenue") {
      commission = referred.reduce((s, x) => s + (companyRevenue(x.company, inf.commission_months) * Number(inf.commission_value)) / 100, 0);
    }
    const funnel = computeLandingStats(events, { source: inf.slug });
    return {
      inf,
      visits: funnel.views,
      signups: funnel.options.find((o) => o.key === "newsletter")?.submits || 0,
      inquiries: leads.filter((l) => l.influencer_id === inf.id).length,
      referred, installed: installed.length, revenue,
      commission: Math.round(commission * 100) / 100,
    };
  });
}

export function statementText(row, asOf = new Date()) {
  const d = asOf.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const money = (n) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return [
    `Lemo referral summary: ${row.inf.name} (as of ${d})`,
    "",
    `Visits from your link: ${row.visits}`,
    `Newsletter sign-ups: ${row.signups}`,
    `Inquiries: ${row.inquiries}`,
    `Companies referred: ${row.referred.length} (${row.installed} installed)`,
    `Commission terms: ${describeCommission(row.inf)}`,
    `Commission earned so far: ${money(row.commission)}`,
    "",
    "Questions? Reply to this email.",
  ].join("\n");
}
