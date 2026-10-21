// Emails a generated deck (as a .pptx attachment) through Resend and records
// the send. The API key must never reach the browser, so this runs
// server-side.
//
// Needs one secret (set once): npx supabase secrets set RESEND_API_KEY=...
// Optional: RESEND_VERIFIED_DOMAIN (defaults to lemowellness.com) — mail is
// sent "from" the caller's own address when it's on that verified domain,
// otherwise from hello@ on it. Replies always go to the caller's real
// address, and the caller is BCC'd a copy.
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user }, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !user || !user.email) return json({ error: "Not authenticated" }, 401);

  let body: { generated_deck_id?: string; to?: string; subject?: string; message?: string } = {};
  try { body = await req.json(); } catch { /* handled below */ }
  const to = (body.to ?? "").trim();
  const subject = (body.subject ?? "").trim();
  const message = (body.message ?? "").trim();
  if (!body.generated_deck_id) return json({ error: "generated_deck_id is required" }, 400);
  if (!EMAIL.test(to)) return json({ error: "Enter a valid email address to send to." }, 400);
  if (!subject) return json({ error: "Add a subject." }, 400);
  if (!message) return json({ error: "Add a message." }, 400);

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return json({ error: "Email isn't set up yet — add the RESEND_API_KEY secret." }, 501);

  // Read through the caller's own client so RLS decides whether they may use this deck.
  const { data: deck } = await callerClient
    .from("generated_decks")
    .select("id, company_id, file_name, pptx_path")
    .eq("id", body.generated_deck_id)
    .maybeSingle();
  if (!deck) return json({ error: "Deck not found" }, 404);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: profile } = await admin.from("profiles").select("name").eq("id", user.id).maybeSingle();
  // Hand Resend a short-lived link to the file and let it fetch the
  // attachment itself — reading and base64-encoding a deck inside this
  // function blew its compute limit (HTTP 546).
  const { data: signed, error: signErr } = await admin.storage.from("generated-decks").createSignedUrl(deck.pptx_path, 3600);
  if (signErr || !signed?.signedUrl) return json({ error: "Couldn't prepare the deck file" }, 500);

  const domain = (Deno.env.get("RESEND_VERIFIED_DOMAIN") ?? "lemowellness.com").toLowerCase();
  const callerOnDomain = user.email.toLowerCase().endsWith(`@${domain}`);
  const fromAddress = callerOnDomain ? user.email : `hello@${domain}`;
  const senderName = profile?.name || user.email;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${senderName} <${fromAddress}>`,
      to: [to],
      bcc: [user.email],
      reply_to: user.email,
      subject,
      text: message,
      attachments: [{ filename: `${deck.file_name}.pptx`, path: signed.signedUrl }],
    }),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    return json({ error: `Email wasn't sent: ${result?.message ?? result?.error ?? res.status}` }, 502);
  }

  await admin.from("deck_emails").insert({
    generated_deck_id: deck.id,
    company_id: deck.company_id,
    to_email: to,
    subject,
    resend_id: result?.id ?? null,
    sent_by: user.id,
  });

  return json({ id: result?.id ?? null });
});
