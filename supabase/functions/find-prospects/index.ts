// Finds real, currently-operating businesses that match the profile of
// companies already installed, using Claude's server-side web_search tool
// — not a custom scraper. web_search runs through Anthropic's own search
// infrastructure (with citations), so this never hits target sites (Yelp,
// Google Maps, LinkedIn, etc.) directly the way a hand-rolled scraper
// would — avoiding both the ToS risk of scraping those sites and the
// engineering fragility of building a real crawler.
//
// The "installed profile" (top industries/regions) is computed client-side
// from data the caller already has loaded — it's just the companies at
// stage='Installed' that THEIR OWN role can already see (owner sees all,
// a bd_consultant sees their own book, etc.), so this naturally respects
// each person's existing visibility scope with no new RLS to write.
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

function extractJsonArray(content: any[] | undefined) {
  const text = (content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;

  // Auth-gated so this can't be hit anonymously to burn API spend — this
  // function makes no DB reads/writes of its own (the profile is passed
  // in already computed), so the only thing to protect is the AI call.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !caller) return json({ error: "Not authenticated" }, 401);

  const body = await req.json().catch(() => ({}));
  const { industry, location, installedProfile } = body;
  if (!industry || !location) return json({ error: "industry and location are required" }, 400);

  const profileLine = installedProfile?.industries?.length
    ? `Their installed customer base is mostly in: ${installedProfile.industries.join(", ")}, concentrated in: ${(installedProfile.regions ?? []).join(", ") || "various regions"}.`
    : "";

  const systemPrompt = `You are a B2B sales research assistant for a wellness/relaxation equipment company (massage chairs and similar installs in commercial spaces). Given a profile of their already-successful installed customers and a target industry/location, use web search to find REAL, currently operating businesses that would be a good fit. Only include businesses you actually found via search — never invent one. Respond with ONLY a JSON array, no markdown fencing, no other prose: [{"name": string, "city": string, "website": string or null, "rationale": string (one sentence, why this business fits)}]. Return at most 5.`;

  const userPrompt = `${profileLine}\n\nFind up to 5 real ${industry} businesses in ${location} that would be a good prospect for wellness/relaxation equipment, similar to their existing installed customers.`;

  const messages: any[] = [{ role: "user", content: userPrompt }];
  let finalResponse: any = null;

  // web_search is server-executed — Claude's own search loop runs inside
  // one response. If it hits its internal 10-iteration cap mid-search, the
  // API returns stop_reason "pause_turn"; resuming means re-sending the
  // conversation as-is (no extra "continue" message needed), bounded here
  // to 3 rounds so a stuck search can't run away on cost.
  for (let i = 0; i < 3; i++) {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 2048,
        thinking: { type: "adaptive" },
        system: systemPrompt,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }],
        messages,
      }),
    });
    if (!aiRes.ok) {
      const errBody = await aiRes.text();
      return json({ error: `Prospect search failed: ${errBody}` }, 502);
    }
    const aiData = await aiRes.json();
    finalResponse = aiData;
    if (aiData.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: aiData.content });
  }

  const prospects = extractJsonArray(finalResponse?.content);
  if (!prospects) return json({ error: "Couldn't parse a prospect list from the AI's response — try again." }, 502);

  return json({ ok: true, prospects: prospects.slice(0, 5) });
});
