// "Why we lose": the reasons a company ends up in Stay in Contact, plus a
// keyword scan of the communications log that SUGGESTS one (the rep confirms
// with a click, nothing is ever set silently).

export const REASONS = [
  {
    id: "aesthetics", label: "Aesthetics / look",
    keywords: [
      "aesthetic", "ugly", "eyesore", "unsightly", "tacky", "not the look", "the look of", "our look", "how it looks",
      "how they look", "how the chair looks", "looks bulky", "look bulky", "bulky", "clunky", "clutter", "cluttered",
      "appearance", "decor", "décor", "interior design", "brand image", "brand standards",
      "brand guidelines", "brand identity", "our brand", "image of the center", "image of the mall", "image of our",
      "doesn't fit our", "doesn't fit with our", "does not fit our", "doesn't match", "does not match", "don't match",
      "not our style", "not our vibe", "vibe", "upscale", "high-end", "high end", "luxury", "curated", "polished",
      "clean look", "clean aesthetic", "corridor", "walkway", "sightline", "sight line", "kiosk look", "looks like a kiosk",
      "looks cheap", "cheap looking", "cheap-looking", "plastic", "dated", "old-fashioned", "garish",
    ],
  },
  {
    id: "flat_no", label: "Flat no",
    keywords: [
      "not interested", "no interest", "no thanks", "no thank you", "not for us", "not a fit", "not a good fit",
      "isn't a fit", "is not a fit", "not the right fit", "pass on", "we'll pass", "we will pass", "going to pass",
      "decline", "declined", "declining", "respectfully decline", "turn down", "turned down", "turning down",
      "said no", "they said no", "flat out", "flat-out", "hard no", "definite no", "firm no", "rejected", "rejection",
      "not moving forward", "will not be moving forward", "won't be moving forward", "not going to move forward",
      "not pursuing", "no longer pursuing", "not going to happen", "unsubscribe", "stop emailing", "stop contacting",
      "remove me", "take me off", "do not contact", "don't contact", "don't email", "do not email", "we're good",
      "we are good", "all set", "not looking", "not something we", "not something that", "doesn't interest",
    ],
  },
  {
    id: "has_vendor", label: "Already has a vendor",
    keywords: [
      "smarte carte", "smartecarte", "brookstone", "relaxation station", "already have", "already has", "already offer",
      "already provide", "already working with", "already partnered", "already contracted", "already under contract",
      "existing vendor", "current vendor", "existing provider", "current provider", "another vendor", "other vendor",
      "another provider", "other provider", "have a vendor", "have a provider", "have a partner", "existing partner",
      "exclusive", "exclusivity", "exclusive agreement", "exclusive contract", "under contract", "locked in", "locked into",
      "contract with", "competitor", "competing", "we have massage", "has massage chairs", "have massage chairs",
      "existing massage", "same service", "similar service", "similar product", "massage chairs already",
    ],
  },
  {
    id: "cost", label: "Cost / revenue share",
    keywords: [
      "too expensive", "expensive", "pricey", "pricing", "budget", "can't afford", "cannot afford", "afford",
      "not worth", "isn't worth", "not worth the", "too low", "low revenue", "not enough revenue", "not enough money",
      "better split", "higher split", "higher percentage", "bigger percentage", "bigger cut", "better terms",
      "split isn't", "split is too", "percentage is too", "rev share is too", "revenue share is too", "roi",
      "return on investment", "can't justify", "cannot justify", "hard to justify", "not profitable", "won't make money",
      "doesn't make sense financially", "financially", "cost too much", "costs too much", "too costly", "costly",
      "minimum guarantee", "guaranteed minimum", "want a guarantee", "fixed rent too", "rent is too",
      "deposit is", "not enough income", "not enough return",
    ],
  },
  {
    id: "landlord", label: "Landlord / approval needed",
    keywords: [
      "landlord", "the owner", "corporate office", "headquarters", "head office",
      "home office", "parent company", "management company", "property management", "property manager", "reit",
      "regional manager", "regional director", "district manager", "above my pay", "above my level", "not my decision",
      "not my call", "decision maker", "decision-maker", "higher up", "higher-up", "board approval", "the board",
      "committee", "need approval", "needs approval", "requires approval", "must approve", "have to approve",
      "sign off", "sign-off", "signoff", "legal team", "leasing agreement", "lease restricts",
      "tenant policy", "tenant rules", "tenant agreement", "insurance", "liability", "permit",
      "compliance", "zoning", "hoa", "homeowners association", "association rules", "mall policy", "center policy",
    ],
  },
  {
    id: "timing", label: "Timing / not now",
    keywords: [
      "not right now", "not now", "not at this time", "not at the moment", "bad timing", "wrong time", "timing",
      "next year", "next quarter", "next month", "next season", "after the holidays", "after holiday", "after the new year",
      "in the new year", "after the first of the year", "revisit", "circle back", "check back", "touch base later",
      "reach out later", "reach back out", "get back to you", "come back to", "in the spring", "in the summer",
      "in the fall", "in the winter", "in q1", "in q2", "in q3", "in q4", "q1", "q2", "budget cycle", "next budget",
      "renovation", "renovating", "remodel", "remodeling", "construction", "under construction",
      "reopening", "re-opening", "grand opening", "tenant change", "restructuring", "new management",
      "busy season", "too busy", "swamped", "slammed", "not a priority", "other priorities", "on hold", "hold off",
      "holding off", "put on hold", "paused", "later this year", "down the road", "down the line",
    ],
  },
  {
    id: "placement", label: "Space / placement",
    keywords: [
      "no space", "no room", "not enough space", "not enough room", "don't have space", "don't have room",
      "no available space", "square footage", "square feet", "floor plan", "layout", "footprint",
      "nowhere to put", "no place to put", "where to put", "where we would put", "where it would go", "no good spot",
      "no spot", "wrong location", "outlet", "outlets", "electrical", "plug",
      "foot traffic", "low traffic", "no traffic", "not enough traffic", "ghost town", "ada",
      "wheelchair", "clearance", "aisle", "tight space", "cramped", "too small", "can't fit", "cannot fit", "won't fit",
      "doesn't fit the space", "doesn't fit in the space", "storage", "back of house", "hallway", "lobby", "vestibule",
      "security camera", "unsupervised", "unattended", "vandal", "theft", "stolen", 
    ],
  },
  {
    id: "no_response", label: "No response",
    keywords: [
      "no response", "no reply", "no answer", "never responded", "never replied", "never heard back", "haven't heard back",
      "didn't respond", "did not respond", "didn't reply", "did not reply", "not responding", "unresponsive", "ghost",
      "ghosted", "went silent", "gone silent", "radio silence", "stopped responding", "stopped replying", "no call back",
      "no callback", "didn't call back", "never called back", "left a message", "left message", "left a voicemail",
      "left voicemail", "voicemail", "went to voicemail", "no one answered", "nobody answered", "no luck reaching",
    ],
  },
  { id: "other", label: "Other", keywords: [] },
];

export const reasonLabel = (id) => REASONS.find((r) => r.id === id)?.label || "";

const norm = (s) => String(s || "").toLowerCase().replace(/[‘’′]/g, "'").replace(/[“”]/g, '"');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Whole-word-ish match so "ada" doesn't hit "adapt" and "q1" doesn't hit "sq1".
const hit = (text, kw) => new RegExp(`(^|[^a-z0-9])${escapeRe(norm(kw))}([^a-z0-9]|$)`).test(text);

// Looks at the most recent entries of the company's communications log (skipping the
// "Emailed …" lines the mailbox reader writes for OUR outgoing mail, since our own
// pitch wording would otherwise look like an objection) and returns the reason whose
// keywords appear most, with the phrase that matched. null when nothing matches.
export function suggestReason(company, { entries = 12 } = {}) {
  const log = (company?.communicationsLog || [])
    .filter((c) => !/^Emailed /.test(c.notes || ""))
    .slice(0, entries);
  if (log.length === 0) return null;
  const text = norm(log.map((c) => c.notes).join("\n"));
  let best = null;
  for (const r of REASONS) {
    const matched = r.keywords.filter((k) => hit(text, k));
    if (matched.length === 0) continue;
    // Longer phrases are more specific, so weight a match by its word count.
    const score = matched.reduce((n, k) => n + Math.min(3, k.trim().split(/\s+/).length), 0);
    if (!best || score > best.score) best = { id: r.id, score, phrase: matched.sort((a, b) => b.length - a.length)[0] };
  }
  return best ? { id: best.id, phrase: best.phrase } : null;
}

// Counts for the "Why we lose" card. `industry` of "" means every segment.
export function declineStats(companies, industry = "") {
  const declined = companies.filter((c) => c.stage === "Stay in Contact" && (!industry || c.industry === industry));
  const byReason = REASONS.map((r) => ({ ...r, companies: declined.filter((c) => c.declineReason === r.id) }))
    .filter((r) => r.companies.length > 0)
    .sort((a, b) => b.companies.length - a.companies.length);
  const unlabeled = declined.filter((c) => !c.declineReason);
  return { total: declined.length, byReason, unlabeled };
}
