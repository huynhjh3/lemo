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

// PostgREST returns at most 1000 rows per request, so page through.
export async function fetchSubscribers() {
  const rows = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await supabase.from("subscribers").select("*").order("created_at", { ascending: false }).range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

// Two pools of one-time codes: "welcome" (sent at sign-up) and "bonus" (the monthly extra for
// subscribers who stay).
export async function fetchCouponCounts() {
  const count = async (kind, unusedOnly) => {
    let q = supabase.from("coupon_codes").select("id", { count: "exact", head: true }).eq("kind", kind);
    if (unusedOnly) q = q.is("assigned_to", null);
    const { count: c, error } = await q;
    if (error) throw error;
    return c || 0;
  };
  const [wt, wu, bt, bu] = await Promise.all([count("welcome", false), count("welcome", true), count("bonus", false), count("bonus", true)]);
  return { welcome: { total: wt, unused: wu }, bonus: { total: bt, unused: bu } };
}

// Codes already in a pool are skipped, so re-pasting a batch is harmless.
export async function addCouponCodes(codes, kind = "welcome") {
  const rows = codes.map((code) => ({ code, kind }));
  const { error } = await supabase.from("coupon_codes").upsert(rows, { onConflict: "code", ignoreDuplicates: true });
  if (error) throw error;
}

// Moves up to n UNUSED codes from one pool to the other. Returns how many actually moved.
export async function moveUnusedCodes(from, to, n) {
  const { data, error } = await supabase.from("coupon_codes").select("id").eq("kind", from).is("assigned_to", null).limit(n);
  if (error) throw error;
  if (!data.length) return 0;
  const { error: upErr } = await supabase.from("coupon_codes").update({ kind: to }).in("id", data.map((r) => r.id));
  if (upErr) throw upErr;
  return data.length;
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

export async function fetchUnmatchedEmails() {
  const { data, error } = await supabase.from("inbound_emails").select("*").eq("status", "unmatched").order("received_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data;
}
export async function updateInboundEmail(id, fields) {
  const { error } = await supabase.from("inbound_emails").update(fields).eq("id", id);
  if (error) throw error;
}

export async function fetchNewCounts() {
  const emails = await supabase.from("inbound_emails").select("id", { count: "exact", head: true }).eq("status", "unmatched");
  if (emails.error) throw emails.error;
  const leads = await supabase.from("web_leads").select("id", { count: "exact", head: true }).eq("status", "new");
  const apps = await supabase.from("bd_applications").select("id", { count: "exact", head: true }).eq("status", "new");
  if (leads.error) throw leads.error;
  if (apps.error) throw apps.error;
  return (leads.count || 0) + (apps.count || 0) + (emails.count || 0);
}
