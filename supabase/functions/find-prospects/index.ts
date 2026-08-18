// Finds real businesses matching an industry/location using OpenStreetMap's
// free, keyless public services — Nominatim (geocoding) and Overpass
// (tagged-data search) — instead of an LLM. No API key, no cost, and
// unlike scraping Google Maps/Yelp/LinkedIn directly, both of these are
// public services explicitly designed and permitted for exactly this kind
// of programmatic query (their usage policy just asks for a descriptive
// User-Agent and reasonable rate limits, not a signup/key).
//
// Trade-off worth knowing: OSM's business data is crowd-sourced, so
// coverage is less complete than Google/Yelp in some areas — this finds
// real, correctly-tagged places, just not necessarily every business that
// exists nearby.
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

const USER_AGENT = "LemoCRM-Prospecting/1.0 (+https://lemocrm.lemowellness.com)";

// Best-effort mapping from this app's own industry taxonomy (theme.js's
// INDUSTRY_OPTIONS) to OpenStreetMap tags — OSM's vocabulary doesn't mirror
// ours 1:1. `null` as a value means "has this key, any value" (e.g. any
// office=*).
const INDUSTRY_OSM_TAGS: Record<string, Array<[string, string | null]>> = {
  "Casino": [["amenity", "casino"]],
  "Airport": [["aeroway", "aerodrome"]],
  "Hotel & Hospitality": [["tourism", "hotel"], ["tourism", "motel"]],
  "Shopping Center": [["shop", "mall"]],
  "Healthcare": [["amenity", "hospital"], ["amenity", "clinic"]],
  "Manufacturing": [["landuse", "industrial"]],
  "Office": [["office", null]],
  "Coworking Space": [["office", "coworking"]],
  "Fitness & Wellness": [["leisure", "fitness_centre"]],
  "Spa & Salon": [["leisure", "spa"], ["shop", "beauty"]],
  "Retail": [["shop", null]],
  "Restaurant & Food Service": [["amenity", "restaurant"], ["amenity", "fast_food"]],
  "Residential & Apartments": [["building", "apartments"]],
  "Senior Living": [["amenity", "social_facility"]],
  "University & Education": [["amenity", "university"], ["amenity", "college"]],
  "Corporate Campus": [["office", "company"]],
  "Transportation Hub": [["railway", "station"], ["aeroway", "terminal"], ["amenity", "bus_station"]],
  "Entertainment Venue": [["amenity", "cinema"], ["amenity", "nightclub"]],
};

async function geocode(location: string) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(location)}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const results = await res.json();
  if (!results?.length) return null;
  return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
}

function buildOverpassQuery(tags: Array<[string, string | null]>, lat: number, lon: number, radiusMeters = 20000) {
  const clauses = tags.flatMap(([key, value]) => {
    const filter = value ? `["${key}"="${value}"]` : `["${key}"]`;
    return [
      `node${filter}(around:${radiusMeters},${lat},${lon});`,
      `way${filter}(around:${radiusMeters},${lat},${lon});`,
    ];
  });
  return `[out:json][timeout:25];(${clauses.join("")});out center 80;`;
}

async function queryOverpass(query: string) {
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "User-Agent": USER_AGENT, "Content-Type": "text/plain" },
    body: query,
  });
  if (!res.ok) throw new Error(`Business search failed (${res.status})`);
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Auth-gated so this can't be hammered anonymously — Nominatim/Overpass
  // are shared public infrastructure with fair-use policies, not something
  // to expose to unauthenticated traffic through our own endpoint.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !caller) return json({ error: "Not authenticated" }, 401);

  const body = await req.json().catch(() => ({}));
  const { industry, location } = body;
  if (!industry || !location) return json({ error: "industry and location are required" }, 400);

  const tags = INDUSTRY_OSM_TAGS[industry];
  if (!tags) return json({ error: `No search mapping for industry "${industry}" yet` }, 400);

  let point: { lat: number; lon: number } | null;
  try {
    point = await geocode(location);
  } catch (err) {
    return json({ error: (err as Error).message }, 502);
  }
  if (!point) return json({ error: `Couldn't find "${location}" — try a more specific city/region` }, 404);

  let overpassData: any;
  try {
    overpassData = await queryOverpass(buildOverpassQuery(tags, point.lat, point.lon));
  } catch (err) {
    return json({ error: (err as Error).message }, 502);
  }

  const prospects = (overpassData.elements ?? [])
    .filter((el: any) => el.tags?.name)
    .map((el: any) => ({
      name: el.tags.name,
      city: el.tags["addr:city"] || el.tags["addr:suburb"] || location,
      website: el.tags.website || el.tags["contact:website"] || null,
      rationale: `Tagged as ${industry.toLowerCase()} in OpenStreetMap near ${location}.`,
    }))
    // A place can match as both a node and a way — de-dupe by name.
    .filter((p: any, i: number, arr: any[]) => arr.findIndex((q) => q.name === p.name) === i)
    .slice(0, 20);

  if (!prospects.length) {
    return json({ error: "No businesses found matching that industry/location in OpenStreetMap — try a broader location or a different industry." }, 404);
  }

  return json({ ok: true, prospects });
});
