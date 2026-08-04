import { supabase } from "../supabaseClient.js";

export async function fetchRecentActivity(limit = 20) {
  const { data, error } = await supabase
    .from("activity_log")
    .select("*, company:companies(id, name), user:profiles(id, name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
