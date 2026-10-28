// Emails a reminder to everyone with a confirmed spot at an event. Owner only (the
// Resend key must never reach the browser). Sent one email per guest through
// Resend's batch endpoint, then stamps each guest's reminded_at.
//
// Needs RESEND_API_KEY (already set). Optional: RESEND_VERIFIED_DOMAIN (default
// lemowellness.com). SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY are injected.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderEventEmail, type EventInfo } from "../_shared/event-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user }, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !user) return json({ error: "Not authenticated" }, 401);
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "owner") return json({ error: "Only an Owner can send reminders." }, 403);

  let body: { event_id?: string; note?: string; test?: boolean } = {};
  try { body = await req.json(); } catch { return json({ error: "Invalid request" }, 400); }
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return json({ error: "Email isn't set up yet — add the RESEND_API_KEY secret." }, 501);
  if (!body.event_id) return json({ error: "event_id is required" }, 400);

  const { data: ev } = await admin.from("events").select("*").eq("id", body.event_id).maybeSingle();
  if (!ev) return json({ error: "Event not found" }, 404);
  const from = `Lemo Wellness <hello@${(Deno.env.get("RESEND_VERIFIED_DOMAIN") ?? "lemowellness.com").toLowerCase()}>`;
  const info: EventInfo = ev;

  // "Send a test to me": one sample reminder to the signed-in Owner, nobody else, no stamping.
  if (body.test) {
    const m = renderEventEmail("reminder", { firstName: "there", ev: info, guests: 2, note: body.note });
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [user.email], subject: `[Test] ${m.subject}`, html: m.html, text: m.text }),
    });
    if (!r.ok) return json({ error: `Test wasn't sent: ${(await r.json().catch(() => ({})))?.message ?? r.status}` }, 502);
    return json({ ok: true, sent_to: user.email });
  }

  const { data: guests } = await admin.from("event_rsvps").select("id, name, email, guests").eq("event_id", ev.id).eq("status", "confirmed");
  if (!guests?.length) return json({ error: "No one has a confirmed spot yet." }, 400);

  let sent = 0, failed = 0, lastError = "";
  for (let i = 0; i < guests.length; i += 100) {
    const chunk = guests.slice(i, i + 100);
    const messages = chunk.map((g) => {
      const m = renderEventEmail("reminder", { firstName: g.name.split(" ")[0], ev: info, guests: g.guests, note: body.note });
      return { from, to: [g.email], subject: m.subject, html: m.html, text: m.text };
    });
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(messages),
    });
    if (res.ok) {
      sent += chunk.length;
      await admin.from("event_rsvps").update({ reminded_at: new Date().toISOString() }).in("id", chunk.map((g) => g.id));
    } else { failed += chunk.length; lastError = (await res.json().catch(() => ({})))?.message ?? `HTTP ${res.status}`; }
    if (i + 100 < guests.length) await sleep(600);
  }
  if (sent === 0) return json({ error: `Nothing was sent: ${lastError}` }, 502);
  return json({ ok: true, sent, failed, ...(failed ? { warning: `${failed} weren't sent: ${lastError}` } : {}) });
});
