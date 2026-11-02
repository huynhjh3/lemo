// The "Unsubscribe" link in every newsletter. Public — a subscriber is not
// signed in — so deploy with --no-verify-jwt:
//   npx supabase functions deploy unsubscribe --no-verify-jwt
// The link carries the subscriber's id (an unguessable UUID). Opening it marks
// them unsubscribed; mail apps' one-click unsubscribe POSTs to the same URL.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Supabase's default function address shows any HTML a function returns as plain text, so we
// send the visitor to a real page instead (public/newsletter in the CRM repo).
const PAGES = "https://lemocrm.lemowellness.com/newsletter";
const go = (file: string) => new Response(null, { status: 302, headers: { Location: `${PAGES}/${file}` } });

Deno.serve(async (req) => {
  const id = new URL(req.url).searchParams.get("s") ?? "";
  if (!UUID.test(id)) return go("link-problem.html");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  await admin.from("subscribers").update({ unsubscribed_at: new Date().toISOString() }).eq("id", id).is("unsubscribed_at", null);
  // One-click unsubscribe (a POST from the mail app) only needs a 200.
  if (req.method === "POST") return new Response("ok", { status: 200 });
  return go("unsubscribed.html");
});
