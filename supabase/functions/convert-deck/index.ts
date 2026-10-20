// Converts a generated deck (PPTX) to PDF through CloudConvert and stores the
// result next to it. The browser can't render PowerPoint faithfully, and the
// API key must never reach it, so this runs server-side.
//
// Needs one secret (set once): npx supabase secrets set CLOUDCONVERT_API_KEY=...
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user }, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !user) return json({ error: "Not authenticated" }, 401);

  let body: { generated_deck_id?: string } = {};
  try { body = await req.json(); } catch { /* handled below */ }
  if (!body.generated_deck_id) return json({ error: "generated_deck_id is required" }, 400);

  // Read through the caller's own client, so RLS decides whether they may
  // touch this deck at all.
  const { data: deck } = await callerClient
    .from("generated_decks")
    .select("id, company_id, file_name, pptx_path")
    .eq("id", body.generated_deck_id)
    .maybeSingle();
  if (!deck) return json({ error: "Deck not found" }, 404);

  const apiKey = Deno.env.get("CLOUDCONVERT_API_KEY");
  if (!apiKey) {
    return json({ error: "PDF conversion isn't set up yet — add the CLOUDCONVERT_API_KEY secret (see the setup notes)." }, 501);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: file, error: dlErr } = await admin.storage.from("generated-decks").download(deck.pptx_path);
  if (dlErr || !file) return json({ error: "Couldn't read the deck file" }, 500);
  const base64 = encodeBase64(new Uint8Array(await file.arrayBuffer()));

  // CloudConvert's sync endpoint returns once the whole job has finished.
  const jobRes = await fetch("https://sync.api.cloudconvert.com/v2/jobs", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      tasks: {
        upload: { operation: "import/base64", file: base64, filename: "deck.pptx" },
        convert: { operation: "convert", input: "upload", input_format: "pptx", output_format: "pdf" },
        export: { operation: "export/url", input: "convert" },
      },
    }),
  });
  const job = await jobRes.json();
  const tasks = job?.data?.tasks ?? [];
  const failed = tasks.find((t: { status: string }) => t.status === "error");
  if (!jobRes.ok || failed || job?.data?.status !== "finished") {
    return json({ error: `PDF conversion failed: ${failed?.message ?? job?.message ?? "unknown error"}` }, 502);
  }
  const pdfUrl = tasks.find((t: { name: string }) => t.name === "export")?.result?.files?.[0]?.url;
  if (!pdfUrl) return json({ error: "PDF conversion returned no file" }, 502);

  const pdfRes = await fetch(pdfUrl);
  if (!pdfRes.ok) return json({ error: "Couldn't fetch the converted PDF" }, 502);
  const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());

  const pdfPath = `${deck.company_id}/${crypto.randomUUID()}.pdf`;
  const { error: upErr } = await admin.storage.from("generated-decks").upload(pdfPath, pdfBytes, { contentType: "application/pdf" });
  if (upErr) return json({ error: "Couldn't save the PDF" }, 500);
  await admin.from("generated_decks").update({ pdf_path: pdfPath }).eq("id", deck.id);

  return json({ pdf_path: pdfPath });
});
