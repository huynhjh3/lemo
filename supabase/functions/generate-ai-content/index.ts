// Drafts a message (cold call / follow up / meeting / email / text) or an
// account briefing for one company, using Claude, and logs the result to
// ai_generations (migration 036) so the tool can learn the rep's voice
// over time.
//
// Everything here — the caller's own JWT, never the service-role key —
// reads companies/communications_log/notes/ai_generations through their
// own RLS. This is deliberate: it means "which companies can this person
// generate about" and "whose past drafts count as their own voice" are
// enforced by the same RLS rules as everywhere else in the app, instead of
// duplicating those access rules in this function.
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

const TYPE_LABELS: Record<string, string> = {
  briefing: "an internal account briefing for a rep about to reach out",
  cold_call: "a cold-call outreach email",
  follow_up: "a follow-up email",
  meeting: "an email to schedule or recap a meeting",
  email: "a general email",
  text_message: "a short text message",
  other: "a message",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !caller) return json({ error: "Not authenticated" }, 401);

  const body = await req.json().catch(() => ({}));
  const { company_id, type } = body;
  if (!company_id || !type) return json({ error: "company_id and type are required" }, 400);
  if (!(type in TYPE_LABELS)) return json({ error: "Invalid type" }, 400);

  const { data: company, error: companyErr } = await callerClient
    .from("companies")
    .select("name, industry, stage")
    .eq("id", company_id)
    .maybeSingle();
  if (companyErr || !company) return json({ error: "Company not found or not accessible" }, 404);

  const { data: commsLog } = await callerClient
    .from("communications_log")
    .select("occurred_at, type, notes, contact_name")
    .eq("company_id", company_id)
    .order("occurred_at", { ascending: false })
    .limit(10);

  const { data: notes } = await callerClient
    .from("notes")
    .select("body, created_at")
    .eq("company_id", company_id)
    .order("created_at", { ascending: false })
    .limit(10);

  // "Voice" examples: this author's own recent, human-edited drafts of the
  // same message type. ai_generations' own RLS (select: author-or-owner)
  // already scopes this to the caller's own rows, so no extra author_id
  // filter is needed here to keep it private to them.
  const { data: pastDrafts } = await callerClient
    .from("ai_generations")
    .select("edited_text")
    .eq("type", type)
    .not("edited_text", "is", null)
    .order("created_at", { ascending: false })
    .limit(5);

  const contextLines = [
    `Company: ${company.name}${company.industry ? ` (${company.industry})` : ""}`,
    company.stage ? `Pipeline stage: ${company.stage}` : null,
    ...(commsLog ?? []).map((c: any) => `- [${c.type}] ${c.occurred_at}${c.contact_name ? ` with ${c.contact_name}` : ""}: ${c.notes}`),
    ...(notes ?? []).map((n: any) => `- Note (${n.created_at}): ${n.body}`),
  ].filter(Boolean);

  const contextBlock = contextLines.length ? contextLines.join("\n") : "(No communications log or notes on file yet for this company.)";

  const voiceBlock = (pastDrafts ?? []).length
    ? `\n\nHere are examples of how this rep has actually written similar messages before — match their tone, structure, and phrasing:\n\n${
        (pastDrafts as any[]).map((d, i) => `Example ${i + 1}:\n${d.edited_text}`).join("\n\n")
      }`
    : "";

  const isBriefing = type === "briefing";
  const systemPrompt = isBriefing
    ? "You summarize a company's account history into a short, 3-5 sentence internal briefing for a sales rep about to make contact. Be concrete and specific — cite recent activity, deal stage, and anything that needs attention before the call. Do not invent facts that aren't in the provided context."
    : `You draft ${TYPE_LABELS[type]} on behalf of a sales rep at a wellness-equipment company, based on their account history. Output only the message body — no subject line, no preamble, no placeholders like [Name]. If a detail (like a contact's name) isn't in the context, write around it rather than inventing one.`;

  const userPrompt = `${contextBlock}${voiceBlock}\n\n${isBriefing ? "Write the briefing." : "Draft the message."}`;

  const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      thinking: { type: "disabled" },
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!aiRes.ok) {
    const errBody = await aiRes.text();
    return json({ error: `AI generation failed: ${errBody}` }, 502);
  }
  const aiData = await aiRes.json();
  const generatedText = aiData.content?.[0]?.text;
  if (!generatedText) return json({ error: "AI returned no content" }, 502);

  // Inserted via the caller's own client, not the service role — author_id
  // defaults to auth.uid() (migration 036), and the insert policy re-checks
  // company_id is one they can actually see.
  const { data: row, error: insertErr } = await callerClient
    .from("ai_generations")
    .insert({ company_id, type, generated_text: generatedText })
    .select()
    .single();
  if (insertErr) return json({ error: insertErr.message }, 400);

  return json({ ok: true, generation: row });
});
