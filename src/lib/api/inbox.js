import { supabase } from "../supabaseClient.js";

export async function fetchWebLeads() {
  const { data, error } = await supabase.from("web_leads").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data;
}
export async function updateWebLead(id, fields) {
  const { error } = await supabase.from("web_leads").update(fields).eq("id", id);
  if (error) throw error;
}

export async function fetchBdApplications() {
  const { data, error } = await supabase.from("bd_applications").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data;
}
export async function updateBdApplication(id, fields) {
  const { error } = await supabase.from("bd_applications").update(fields).eq("id", id);
  if (error) throw error;
}

export async function fetchSubscribers() {
  const { data, error } = await supabase.from("subscribers").select("*").order("created_at", { ascending: false }).limit(500);
  if (error) throw error;
  return data;
}

export async function fetchCouponCounts() {
  const total = await supabase.from("coupon_codes").select("id", { count: "exact", head: true });
  const unused = await supabase.from("coupon_codes").select("id", { count: "exact", head: true }).is("assigned_to", null);
  if (total.error) throw total.error;
  if (unused.error) throw unused.error;
  return { total: total.count || 0, unused: unused.count || 0 };
}

// Codes already in the pool are skipped, so re-pasting a batch is harmless.
export async function addCouponCodes(codes) {
  const rows = codes.map((code) => ({ code }));
  const { error } = await supabase.from("coupon_codes").upsert(rows, { onConflict: "code", ignoreDuplicates: true });
  if (error) throw error;
}

// PostgREST returns at most 1000 rows per request, so page through.
export async function fetchLandingEvents(sinceIso) {
  const rows = [];
  for (let from = 0; from < 100000; from += 1000) {
    let q = supabase.from("landing_events").select("session_id, event, source, created_at").order("created_at").range(from, from + 999);
    if (sinceIso) q = q.gte("created_at", sinceIso);
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

export async function fetchNewCounts() {
  const leads = await supabase.from("web_leads").select("id", { count: "exact", head: true }).eq("status", "new");
  const apps = await supabase.from("bd_applications").select("id", { count: "exact", head: true }).eq("status", "new");
  if (leads.error) throw leads.error;
  if (apps.error) throw apps.error;
  return (leads.count || 0) + (apps.count || 0);
}
