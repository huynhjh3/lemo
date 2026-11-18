// What the rest of the pipeline says about a company's industry, for the AI steps (reply
// triage, Brief me). Counts of why deals in the segment stopped, plus a few past replies a
// person CONFIRMED with the response that went out and where that company is now. Names,
// emails and phone numbers are stripped here in code before anything reaches a model, and
// patterns are only reported once there are enough examples to mean something.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Same ids as src/lib/declineReasons.js.
export const REASONS: Record<string, string> = {
  aesthetics: "aesthetics / look", flat_no: "flat no", has_vendor: "already has a vendor", cost: "cost / revenue share",
  landlord: "landlord or approval needed", timing: "timing / not now", placement: "space / placement", no_response: "no response", other: "other",
};

const EMAIL_RE = /[^\s<>"',;()]+@[^\s<>"',;()]+\.[^\s<>"',;()]+/g;
const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/g;
export const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const clip = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

// Replaces the given names (and any email or phone number) with neutral tokens.
function redactor(names: string[]) {
  const list = [...new Set(names.map((n) => (n ?? "").trim()).filter((n) => n.length > 2))].sort((a, b) => b.length - a.length);
  const re = list.length ? new RegExp(`\\b(?:${list.map(esc).join("|")})\\b`, "gi") : null;
  return (t: unknown) => {
    let out = String(t ?? "");
    if (re) out = out.replace(re, "[name]");
    return out.replace(EMAIL_RE, "[email]").replace(PHONE_RE, "[phone]");
  };
}

// "Reply from NAME — "subject"\n\nbody"  ->  { subject, body }
export function splitReply(notes: string) {
  const [head, ...rest] = (notes ?? "").split(/\n\s*\n/);
  const m = head.match(/^Reply from .*? — "(.*)"\s*$/s);
  return { subject: m ? m[1] : "", body: rest.join("\n\n").trim() };
}

export const POSITIVE = new Set(["Proposal", "Negotiation", "Installed"]);

export async function segmentInsights(
  admin: SupabaseClient,
  a: { companyId: string; industry: string | null },
): Promise<{ segmentBlock: string; examplesBlock: string; wonCount: number; reasonedCount: number }> {
  const none = { segmentBlock: "", examplesBlock: "", wonCount: 0, reasonedCount: 0 };
  if (!a.industry) return none;
  const { data: seg } = await admin.from("companies").select("id, name, stage, decline_reason")
    .eq("industry", a.industry).neq("id", a.companyId).limit(300);
  const segment = seg ?? [];
  const reasoned = segment.filter((c: any) => c.stage === "Stay in Contact" && c.decline_reason);
  const wonCount = segment.filter((c: any) => POSITIVE.has(c.stage)).length;

  let segmentBlock = "";
  if (reasoned.length >= 3) {
    const counts: Record<string, number> = {};
    for (const c of reasoned) counts[c.decline_reason] = (counts[c.decline_reason] ?? 0) + 1;
    const parts = Object.entries(counts).sort((x, y) => y[1] - x[1]).map(([r, n]) => `${REASONS[r] ?? r}: ${n}`);
    segmentBlock = `Other ${a.industry} prospects that stopped (${reasoned.length}), by reason: ${parts.join(", ")}. ${wonCount} others are at Proposal, Negotiation or Installed.`;
  }

  let examplesBlock = "";
  const ids = segment.map((c: any) => c.id);
  if (ids.length) {
    const { data: past } = await admin.from("communications_log")
      .select("company_id, notes, triage_label, triage_reason, draft_body, draft_edited, occurred_at")
      .in("company_id", ids).not("triage_confirmed_at", "is", null).not("draft_body", "is", null)
      .order("occurred_at", { ascending: false }).limit(60);
    const byId = new Map(segment.map((c: any) => [c.id, c]));
    const rows = (past ?? []) as any[];
    const good = rows.filter((r) => POSITIVE.has(byId.get(r.company_id)?.stage));
    const rest = rows.filter((r) => !POSITIVE.has(byId.get(r.company_id)?.stage));
    const pick = [...good.slice(0, 3), ...rest.slice(0, 3)];
    if (pick.length) {
      const pickIds = [...new Set(pick.map((r) => r.company_id))];
      const { data: ppl } = await admin.from("contacts").select("name").in("company_id", pickIds);
      const names = [
        ...pickIds.map((id) => (byId.get(id) as any)?.name ?? ""),
        ...(ppl ?? []).flatMap((p: any) => [p.name ?? "", String(p.name ?? "").split(/\s+/)[0]]),
      ];
      const red = redactor(names);
      examplesBlock = pick.map((r, i) => {
        const c: any = byId.get(r.company_id);
        const outcome = POSITIVE.has(c?.stage)
          ? `worked: that company is now at ${c.stage}`
          : `that company is now at ${c?.stage ?? "unknown"}${c?.decline_reason ? ` (${REASONS[c.decline_reason] ?? c.decline_reason})` : ""}`;
        return `Example ${i + 1} (${r.triage_label}${r.triage_reason ? `, ${REASONS[r.triage_reason] ?? r.triage_reason}` : ""}; ${outcome})\n  They wrote: ${clip(red(splitReply(r.notes).body), 300)}\n  We replied: ${clip(red(r.draft_edited || r.draft_body), 500)}`;
      }).join("\n");
    }
  }
  return { segmentBlock, examplesBlock, wonCount, reasonedCount: reasoned.length };
}
