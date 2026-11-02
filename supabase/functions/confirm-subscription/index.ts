// The "Confirm my email" link in the newsletter sign-up email. Public — the subscriber
// isn't signed in — so deploy with --no-verify-jwt:
//   npx supabase functions deploy confirm-subscription --no-verify-jwt
// Opening the link confirms the subscriber, then sends their one-time code and welcome
// email. The page just tells them to watch their inbox. Confirming twice is harmless.
// Secrets: RESEND_API_KEY. Optional: RESEND_VERIFIED_DOMAIN, NOTIFY_EMAIL, COUPON_INSTRUCTIONS,
// RESEND_AUDIENCE_ID. SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { makeMailer } from "../_shared/mailer.ts";
import { sendWelcome, type Subscriber } from "../_shared/welcome.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const page = (title: string, msg: string) => new Response(
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#FEF1E4;font-family:Poppins,Helvetica,Arial,sans-serif;color:#1A1512;">
<div style="max-width:440px;margin:12vh auto;padding:0 20px;text-align:center;">
<img src="https://lemocrm.lemowellness.com/lemo-logo.png" width="110" alt="Lemo" style="margin-bottom:18px">
<h1 style="font-size:24px;margin:0 0 10px;">${title}</h1><p style="font-size:15px;line-height:1.6;color:#4A4038;">${msg}</p>
<p style="font-size:13px;color:#6B5F55;margin-top:24px;"><a href="https://lemowellness.com" style="color:#E8601C;">lemowellness.com</a></p></div></body></html>`,
  { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  if (!UUID.test(token)) return page("Link not recognized", "This confirmation link doesn’t look right. Try signing up again at one of our chairs, or reply to any Lemo email and we’ll help.");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: sub } = await admin.from("subscribers").select("*").eq("confirm_token", token).maybeSingle();
  if (!sub) return page("Link not recognized", "We couldn’t find that sign-up. Try signing up again at one of our chairs, or reply to any Lemo email and we’ll help.");

  const done = page("You’re confirmed!", "Thank you. Keep an eye out for our email in your inbox.");
  if (sub.confirmed_at && !sub.unsubscribed_at) return done; // already confirmed: nothing to send again

  await admin.from("subscribers").update({ confirmed_at: new Date().toISOString(), unsubscribed_at: null }).eq("id", sub.id);
  const mailer = makeMailer({
    resendKey: Deno.env.get("RESEND_API_KEY"),
    domain: (Deno.env.get("RESEND_VERIFIED_DOMAIN") ?? "lemowellness.com").toLowerCase(),
    notifyTo: (Deno.env.get("NOTIFY_EMAIL") ?? "").trim(),
  });
  await sendWelcome(admin, mailer, sub as Subscriber);
  return done;
});
