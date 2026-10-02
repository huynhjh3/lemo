import { supabase } from "../supabaseClient.js";

export async function fetchDailyUpdates(sinceDateKey) {
  const { data, error } = await supabase
    .from("daily_updates")
    .select("update_date, context")
    .gte("update_date", sinceDateKey)
    .order("update_date", { ascending: false });
  if (error) throw error;
  return data;
}

export async function saveDailyUpdate(dateKey, context) {
  const { error } = await supabase
    .from("daily_updates")
    .upsert({ update_date: dateKey, context, updated_at: new Date().toISOString() }, { onConflict: "update_date" });
  if (error) throw error;
}
