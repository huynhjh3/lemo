// Previews, test-sends, and sends the monthly newsletter ("The Recharge Report").
// Owner only. The Resend API key must never reach the browser, so this runs
// server-side.
//
// Needs RESEND_API_KEY (already set for send-deck). Optional:
//   RESEND_VERIFIED_DOMAIN (default lemowellness.com) — mail goes out as
//     hello@<domain>;
//   NEWSLETTER_REPLY_TO (default hello@<domain>) — where "reply to this email" lands.
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically.
//
// Actions:
//   preview — { action, content }                 -> { html }
//   test    — { action, subject, content }        -> mails the signed-in Owner
//   send    — { action, issue_id }                -> mails every subscriber who has
//             not unsubscribed, from the SAVED draft (so what was previewed is what
//             goes out), then marks the issue sent. An issue can only be sent once.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderNewsletter, type Content } from "./template.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const BATCH = 100; // Resend's batch endpoint takes up to 100 messages per call

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user }, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !user || !user.email) return json({ error: "Not authenticated" }, 401);

  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: profile } = await admin.from("profiles").select("role, name").eq("id", user.id).maybeSingle();
  if (profile?.role !== "owner") return json({ error: "Only an Owner can send the newsletter." }, 403);

  let body: { action?: string; content?: Content; subject?: string; issue_id?: string } = {};
  try { body = await req.json(); } catch { return json({ error: "Invalid request" }, 400); }
  const action = body.action;

  const domain = (Deno.env.get("RESEND_VERIFIED_DOMAIN") ?? "lemowellness.com").toLowerCase();
  const from = `Lemo Wellness <hello@${domain}>`;
  const replyTo = (Deno.env.get("NEWSLETTER_REPLY_TO") ?? `hello@${domain}`).trim();
  const unsubUrl = (id: string) => `${supabaseUrl}/functions/v1/unsubscribe?s=${id}`;
  const apiKey = Deno.env.get("RESEND_API_KEY");

  if (action === "preview") {
    const { html } = renderNewsletter(body.content ?? {}, { firstName: "[First name]", unsubscribeUrl: "#" });
    return json({ html });
  }

  if (!apiKey) return json({ error: "Email isn't set up yet — add the RESEND_API_KEY secret." }, 501);

  if (action === "test") {
    const subject = (body.subject ?? "").trim();
    if (!subject) return json({ error: "Add a subject first." }, 400);
    const first = (profile?.name ?? "").trim().split(/\s+/)[0] || "there";
    const { html, text } = renderNewsletter(body.content ?? {}, { firstName: first, unsubscribeUrl: "#" });
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [user.email], reply_to: replyTo, subject: `[Test] ${subject}`, html, text }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) return json({ error: `Test wasn't sent: ${result?.message ?? result?.error ?? res.status}` }, 502);
    return json({ ok: true, sent_to: user.email });
  }

  if (action === "send") {
    if (!body.issue_id) return json({ error: "issue_id is required" }, 400);
    // Claim the draft so a double-click (or two Owners) can't send it twice.
    const { data: claimed } = await admin.from("newsletter_issues")
      .update({ status: "sending", updated_at: new Date().toISOString() })
      .eq("id", body.issue_id).eq("status", "draft").select("id, subject, content").maybeSingle();
    if (!claimed) return json({ error: "That issue isn't a draft any more — it may already have been sent." }, 409);

    const subs: { id: string; email: string; name: string | null }[] = [];
    for (let from_ = 0; from_ < 50000; from_ += 1000) {
      const { data } = await admin.from("subscribers").select("id, email, name").is("unsubscribed_at", null).order("created_at").range(from_, from_ + 999);
      subs.push(...(data ?? []));
      if ((data?.length ?? 0) < 1000) break;
    }
    if (!subs.length) {
      await admin.from("newsletter_issues").update({ status: "draft" }).eq("id", claimed.id);
      return json({ error: "There are no subscribers to send to yet." }, 400);
    }

    let sent = 0, failed = 0, lastError = "";
    for (let i = 0; i < subs.length; i += BATCH) {
      const chunk = subs.slice(i, i + BATCH);
      const messages = chunk.map((s) => {
        const url = unsubUrl(s.id);
        const { html, text } = renderNewsletter(claimed.content as Content, { firstName: (s.name ?? "").trim().split(/\s+/)[0] || undefined, unsubscribeUrl: url });
        return {
          from, to: [s.email], reply_to: replyTo, subject: claimed.subject, html, text,
          headers: { "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        };
      });
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(messages),
      });
      if (res.ok) sent += chunk.length;
      else { failed += chunk.length; const r = await res.json().catch(() => ({})); lastError = r?.message ?? r?.error ?? `HTTP ${res.status}`; }
      if (i + BATCH < subs.length) await sleep(600); // stay under Resend's rate limit
    }

    if (sent === 0) {
      await admin.from("newsletter_issues").update({ status: "draft" }).eq("id", claimed.id);
      return json({ error: `Nothing was sent: ${lastError}` }, 502);
    }
    // Even a partial send is recorded as sent, so a retry can't mail the same people twice.
    await admin.from("newsletter_issues").update({ status: "sent", sent_at: new Date().toISOString(), recipients_count: sent }).eq("id", claimed.id);
    return json({ ok: true, sent, failed, ...(failed ? { warning: `${failed} weren't sent: ${lastError}` } : {}) });
  }

  return json({ error: "Unknown action" }, 400);
});
