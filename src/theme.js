import {
  PhoneCall, Mail as MailIcon, Users, Wrench, StickyNote, Pencil,
} from "lucide-react";

// Lemo US Brand Playbook palette (Obsidian / Ember / Charcoal / Warm White / Ash / Iron).
// `teal` (healthy/positive) and `red` (risk/negative) aren't in the 8-swatch brand palette —
// the guide covers marketing materials, not a 3-state UI status system — so they're warm,
// brand-adjacent extensions (muted sage / brick) rather than the cold teal/red used before.
export const T = {
  bg: "#0C0A09",        // Obsidian
  surface: "#1C1916",   // Charcoal
  surface2: "#2E2B28",  // Iron
  border: "#2E2B28",    // Iron
  borderSoft: "#241F1C",
  text: "#F2EDE6",      // Warm White
  textDim: "#A79E93",
  textFaint: "#6E655B",
  amber: "#E85D20",     // Ember — brand accent, CTAs, data callouts
  teal: "#7C9A6E",       // muted sage — healthy/positive (brand-adjacent extension)
  red: "#B23B2E",        // muted brick — risk/negative (brand-adjacent extension)
  fontDisplay: "'Lora', serif",
  fontBody: "'Poppins', sans-serif",
  fontMono: "'IBM Plex Mono', monospace",
};

export const STATUS_META = {
  healthy: { color: T.teal, label: "Healthy" },
  attention: { color: T.amber, label: "Needs Attention" },
  risk: { color: T.red, label: "At Risk" },
};

export const STAGE_ORDER = ["Lead", "Contacted", "Proposal", "Negotiation", "Installed", "Stay in Contact"];
export const STAGE_PROB = { Lead: 0.1, Contacted: 0.25, Proposal: 0.5, Negotiation: 0.75, Installed: 1, "Stay in Contact": 0 };

export const ACTIVITY_ICON = {
  call: PhoneCall, email: MailIcon, meeting: Users, install: Wrench, note: StickyNote, system: Pencil,
};

export const ROLE_LABELS = { owner: "Owner", bd_consultant: "BD Consultant", partner: "Partner", geo_partner: "Geo Partner" };

export const INDUSTRY_OPTIONS = [
  "Casino", "Airport", "Hotel & Hospitality", "Shopping Center", "Healthcare",
  "Manufacturing", "Office", "Coworking Space", "Fitness & Wellness", "Spa & Salon",
  "Retail", "Restaurant & Food Service", "Residential & Apartments", "Senior Living",
  "University & Education", "Corporate Campus", "Transportation Hub", "Entertainment Venue",
];
