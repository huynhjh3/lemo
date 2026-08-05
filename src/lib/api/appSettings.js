import { supabase } from "../supabaseClient.js";

export async function fetchAppSettings() {
  const { data, error } = await supabase.from("app_settings").select("*").single();
  if (error) throw error;
  return data;
}

// No .eq() filter needed — app_settings only ever has the one seeded row
// (there's no insert policy, so nothing can ever create a second one).
export async function updateAppSettings(fields) {
  const { error } = await supabase.from("app_settings").update(fields);
  if (error) throw error;
}
