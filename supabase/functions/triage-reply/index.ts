// Labels a logged reply and writes (or rewrites) its draft. Called from the company page:
//   - "Write a draft" on a reply nobody has triaged yet (older mail, or the batch limit)
//   - "Rewrite" after a person changed the label or reason
// The caller's own JWT first proves they can see the log entry (the same RLS as everywhere
// else in the app); the AI work and the write then use the service role, because the
// shared code also reads segment patterns across companies the caller may not own.
//   npx supabase functions deploy triage-reply
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { LABELS, triageLogEntry, upsertReplyTask, type Label } from "../_shared/triage.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user }, error: authErr } = await caller.auth.getUser();
  if (authErr || !user) return json({ error: "Not authenticated" }, 401);

  const body = await req.json().catch(() => ({}));
  const logId = typeof body.log_id === "string" ? body.log_id : "";
  if (!logId) return json({ error: "log_id is required" }, 400);
  const label = (LABELS as readonly string[]).includes(body.label) ? (body.label as Label) : undefined;
  const reason = typeof body.reason === "string" && body.reason ? body.reason : null;

  const { data: visible } = await caller.from("communications_log").select("id, company_id").eq("id", logId).maybeSingle();
  if (!visible) return json({ error: "That entry wasn't found, or isn't yours to change." }, 404);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const out = await triageLogEntry(admin, logId, { fixedLabel: label, fixedReason: label ? reason : null });
  if (!out.ok) return json({ error: out.skipped ? "AI isn't switched on yet." : out.error }, out.skipped ? 503 : 502);

  const [{ data: company }, { data: entry }] = await Promise.all([
    admin.from("companies").select("name, rep_id").eq("id", visible.company_id).maybeSingle(),
    admin.from("communications_log").select("contact:contacts(name)").eq("id", logId).maybeSingle(),
  ]);
  await upsertReplyTask(admin, {
    companyId: visible.company_id, logId, contactName: (entry as any)?.contact?.name ?? "", companyName: company?.name ?? "",
    repId: company?.rep_id ?? null, result: out.result, createIfMissing: false,
  });
  return json({ ok: true, result: out.result });
});
