// Receives everything the public landing page (lemowellness.com/connect)
// reports: page views and clicks, "talk to us" requests, newsletter
// sign-ups (which get a one-time code by email), and BD consultant
// applications. The page's own backend calls this with a shared secret in
// the X-Webhook-Secret header — there is no user login here, so deploy it
// with --no-verify-jwt:
//   npx supabase functions deploy landing-intake --no-verify-jwt
//
// Secrets: LANDING_WEBHOOK_SECRET (required), RESEND_API_KEY (to email codes
// and notifications). Optional: NOTIFY_EMAIL (where new leads/applications are
// announced), RESEND_AUDIENCE_ID (adds newsletter sign-ups to a Resend
// audience), RESEND_VERIFIED_DOMAIN (default lemowellness.com),
// COUPON_INSTRUCTIONS (how to redeem — shown in the welcome email).
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const CLICK_EVENTS = ["view", "click_contact", "click_newsletter", "click_bd"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const secret = Deno.env.get("LANDING_WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret) return json({ error: "Unauthorized" }, 401);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const type = str(body.type, 20);
  const session = str(body.session_id, 64) || "unknown";
  const source = str(body.source, 60) || null;
  const domain = (Deno.env.get("RESEND_VERIFIED_DOMAIN") ?? "lemowellness.com").toLowerCase();
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const notifyTo = (Deno.env.get("NOTIFY_EMAIL") ?? "").trim();

  const recordEvent = (event: string) => admin.from("landing_events").insert({ session_id: session, event, source });

  async function sendEmail(to: string, subject: string, text: string, fromName = "Lemo Wellness", html?: string) {
    if (!resendKey) { console.error("sendEmail skipped: RESEND_API_KEY is not set"); return false; }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${fromName} <hello@${domain}>`, to: [to], subject, text, ...(html ? { html } : {}) }),
    });
    // Logged (not thrown) so a sign-up still succeeds, but a failed email shows up in the function's logs.
    if (!res.ok) console.error(`sendEmail to ${to} failed: HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 300)}`);
    return res.ok;
  }
  const notify = (subject: string, lines: string[]) =>
    notifyTo && EMAIL.test(notifyTo) ? sendEmail(notifyTo, subject, lines.join("\n"), "Lemo CRM") : Promise.resolve(false);

  // Honeypot: a hidden field real people never fill in.
  if (str(body.website, 200)) return json({ ok: true });

  if (type === "event") {
    const event = str(body.event, 30);
    if (!CLICK_EVENTS.includes(event)) return json({ error: "Unknown event" }, 400);
    await recordEvent(event);
    return json({ ok: true });
  }

  if (type === "contact") {
    const name = str(body.name, 120), email = str(body.email, 200).toLowerCase();
    if (!name || !EMAIL.test(email)) return json({ error: "Name and a valid email are required." }, 400);
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { data: dup } = await admin.from("web_leads").select("id").eq("email", email).gte("created_at", since).limit(1);
    if (!dup?.length) {
      await admin.from("web_leads").insert({
        name, email, phone: str(body.phone, 40) || null, company: str(body.company, 160) || null,
        title: str(body.title, 120) || null, message: str(body.message, 2000) || null, source,
      });
      await notify(`New web lead: ${name}`, [
        `${name} (${email}) asked to talk.`, body.company ? `Company: ${str(body.company, 160)}` : "",
        body.phone ? `Phone: ${str(body.phone, 40)}` : "", body.message ? `Message: ${str(body.message, 2000)}` : "",
        "", "Review it in the CRM → Inbox.",
      ].filter(Boolean));
    }
    await recordEvent("submit_contact");
    return json({ ok: true });
  }

  if (type === "bd") {
    const name = str(body.name, 120), email = str(body.email, 200).toLowerCase();
    if (!name || !EMAIL.test(email)) return json({ error: "Name and a valid email are required." }, 400);
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { data: dup } = await admin.from("bd_applications").select("id").eq("email", email).gte("created_at", since).limit(1);
    if (!dup?.length) {
      await admin.from("bd_applications").insert({
        name, email, phone: str(body.phone, 40) || null, city: str(body.city, 120) || null,
        experience: str(body.experience, 3000) || null, why: str(body.why, 3000) || null,
        linkedin: str(body.linkedin, 300) || null, source,
      });
      await notify(`New BD consultant application: ${name}`, [
        `${name} (${email}) applied.`, body.city ? `City: ${str(body.city, 120)}` : "", "", "Review it in the CRM → Inbox.",
      ].filter(Boolean));
    }
    await recordEvent("submit_bd");
    return json({ ok: true });
  }

  if (type === "newsletter") {
    const email = str(body.email, 200).toLowerCase(), name = str(body.name, 120);
    if (!EMAIL.test(email)) return json({ error: "A valid email is required." }, 400);
    if (body.consent !== true) return json({ error: "Please agree to receive the newsletter." }, 400);

    let { data: sub } = await admin.from("subscribers").select("*").eq("email", email).maybeSingle();
    if (!sub) {
      const { data: created, error } = await admin.from("subscribers").insert({ email, name: name || null, source }).select().single();
      if (error || !created) return json({ error: "Couldn't save your sign-up. Please try again." }, 500);
      sub = created;
    } else if (sub.unsubscribed_at) {
      await admin.from("subscribers").update({ unsubscribed_at: null, consented_at: new Date().toISOString() }).eq("id", sub.id);
    }

    let code: string | null = sub.coupon_code ?? null;
    if (!code) {
      const { data: assigned } = await admin.rpc("assign_next_coupon", { p_subscriber: sub.id });
      code = (assigned as string | null) ?? null;
      if (code) await admin.from("subscribers").update({ coupon_code: code, coupon_assigned_at: new Date().toISOString() }).eq("id", sub.id);
    }

    const first = (name || sub.name || "").split(" ")[0];
    const how = Deno.env.get("COUPON_INSTRUCTIONS") ?? "1. Go to any Lemo chair.\n2. Use the screen on the left side of the chair.\n3. Enter your one-time code.";
    const unsub = `${Deno.env.get("SUPABASE_URL")}/functions/v1/unsubscribe?s=${sub.id}`;
    const greeting = first ? `Hi ${first}` : "Hi";
    const text = code
      ? `${greeting},\n\nWelcome to the Lemo newsletter! Here's your free 10-minute massage code:\n\n${code}\n\nHow to use it:\n${how}\n\nEach code works once. You'll hear from us about once a month.\n\nLemo Wellness | lemowellness.com\nUnsubscribe: ${unsub}`
      : `${greeting},\n\nWelcome to the Lemo newsletter! We're getting your free 10-minute massage code ready and will email it to you shortly.\n\nYou'll hear from us about once a month.\n\nLemo Wellness | lemowellness.com\nUnsubscribe: ${unsub}`;
    const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const F = "font-family:'Poppins',Helvetica,Arial,sans-serif;";
    const html = `<!doctype html><html><body style="margin:0;background:#EFE7DE;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFE7DE;"><tr><td align="center" style="padding:22px 12px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#fff;border-radius:18px;overflow:hidden;">
<tr><td align="center" style="background:#FEF1E4;padding:28px 32px 22px;"><img src="https://lemocrm.lemowellness.com/lemo-logo.png" width="110" alt="Lemo" style="display:block;width:110px;height:auto;margin:0 auto;border:0;">
<p style="margin:18px 0 0;${F}font-size:26px;font-weight:800;color:#1A1512;line-height:1.15;">Your free 10-minute massage</p></td></tr>
<tr><td style="padding:28px 36px 8px;${F}font-size:15px;line-height:1.65;color:#3A322C;">
<p style="margin:0 0 14px;">${esc(greeting)},</p>
<p style="margin:0 0 18px;">Welcome to the Lemo newsletter, and thanks for signing up! ${code ? "Here’s your code:" : "We’re getting your free code ready and will email it to you shortly."}</p>
${code ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="background:#FEF1E4;border:2px dashed #E8601C;border-radius:14px;padding:20px;"><span style="${F}font-size:32px;font-weight:800;letter-spacing:4px;color:#E8601C;">${esc(code)}</span><br><span style="${F}font-size:12px;color:#6B5F55;">One-time code · good for one free 10-minute massage</span></td></tr></table>
<p style="margin:22px 0 6px;${F}font-weight:700;color:#1A1512;">How to use it</p>
<p style="margin:0 0 14px;">${esc(how).replace(/\n/g, "<br>")}</p>` : ""}
<p style="margin:0 0 6px;">You’ll hear from us about once a month: new chairs and locations, what we’ve been up to, and what’s moving in wellness.</p>
</td></tr>
<tr><td align="center" style="background:#1A1512;padding:22px 32px;${F}font-size:11.5px;line-height:1.7;color:#BFB3A6;">Lemo Inc. · 5151 California Ave, Irvine, CA 92617<br><a href="https://lemowellness.com" style="color:#FF8A50;">lemowellness.com</a> · <a href="${unsub}" style="color:#FF8A50;">Unsubscribe</a></td></tr>
</table></td></tr></table></body></html>`;
    await sendEmail(email, "Your free 10-minute massage from Lemo", text, "Lemo Wellness", html);
    if (!code) await notify("Out of coupon codes", [`${email} signed up for the newsletter but there were no unused codes left.`, "Add more in the CRM → Inbox → Newsletter."]);

    const audience = Deno.env.get("RESEND_AUDIENCE_ID");
    if (audience && resendKey) {
      await fetch(`https://api.resend.com/audiences/${audience}/contacts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email, first_name: first || undefined, unsubscribed: false }),
      }).catch(() => {});
    }

    await recordEvent("submit_newsletter");
    return json({ ok: true, code_sent: !!code });
  }

  return json({ error: "Unknown type" }, 400);
});
