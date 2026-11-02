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
// Supabase's default function address shows any HTML a function returns as plain text, so we
// send the visitor to a real page instead. The pages live in the CRM repo's public/newsletter folder.
const PAGES = "https://lemocrm.lemowellness.com/newsletter";
const go = (file: string) => new Response(null, { status: 302, headers: { Location: `${PAGES}/${file}` } });

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  if (!UUID.test(token)) return go("link-problem.html");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: sub } = await admin.from("subscribers").select("*").eq("confirm_token", token).maybeSingle();
  if (!sub) return go("link-problem.html");

  const done = go("confirmed.html");
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
