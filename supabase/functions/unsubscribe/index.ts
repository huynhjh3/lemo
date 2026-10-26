// The "Unsubscribe" link in every newsletter. Public — a subscriber is not
// signed in — so deploy with --no-verify-jwt:
//   npx supabase functions deploy unsubscribe --no-verify-jwt
// The link carries the subscriber's id (an unguessable UUID). Opening it marks
// them unsubscribed; mail apps' one-click unsubscribe POSTs to the same URL.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  const id = new URL(req.url).searchParams.get("s") ?? "";
  if (!UUID.test(id)) return page("Link not recognized", "This unsubscribe link doesn’t look right. Reply to any Lemo email and we’ll take you off the list.");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  await admin.from("subscribers").update({ unsubscribed_at: new Date().toISOString() }).eq("id", id).is("unsubscribed_at", null);
  // One-click unsubscribe (a POST from the mail app) only needs a 200.
  if (req.method === "POST") return new Response("ok", { status: 200 });
  return page("You’re unsubscribed", "You won’t get the Lemo newsletter anymore. If this was a mistake, just sign up again at one of our chairs.");
});
