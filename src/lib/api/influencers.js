import { supabase } from "../supabaseClient.js";

export async function fetchInfluencers() {
  const { data, error } = await supabase.from("influencers").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createInfluencer(fields) {
  const { error } = await supabase.from("influencers").insert(fields);
  if (error) {
    if (error.code === "23505") throw new Error("That link name or promo code is already used by another influencer.");
    throw error;
  }
}

export async function updateInfluencer(id, fields) {
  const { error } = await supabase.from("influencers").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteInfluencer(id) {
  const { error } = await supabase.from("influencers").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchReferrals() {
  const { data, error } = await supabase.from("influencer_referrals").select("*");
  if (error) throw error;
  return data;
}

// One referrer per company: recording another replaces the first (an Owner correcting it by hand).
export async function setReferral({ companyId, influencerId, how = "manual" }) {
  const { error } = await supabase.from("influencer_referrals")
    .upsert({ company_id: companyId, influencer_id: influencerId, how }, { onConflict: "company_id" });
  if (error) throw error;
}

// Used when a web lead is added to the pipeline: keep the referrer the lead arrived with,
// but never overwrite one an Owner already set by hand.
export async function addReferralIfNone({ companyId, influencerId, how }) {
  const { error } = await supabase.from("influencer_referrals")
    .upsert({ company_id: companyId, influencer_id: influencerId, how }, { onConflict: "company_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function removeReferral(companyId) {
  const { error } = await supabase.from("influencer_referrals").delete().eq("company_id", companyId);
  if (error) throw error;
}
