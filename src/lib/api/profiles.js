import { supabase } from "../supabaseClient.js";

export async function fetchProfiles() {
  const { data, error } = await supabase.from("profiles").select("id, name, role, region, is_master_admin").order("name");
  if (error) throw error;
  return data;
}

// profiles_update_self (schema.sql) already restricts this to your own
// row — userId is just which row to target, not an access check.
export async function updateMyIntroTemplate(userId, introTemplate) {
  const { error } = await supabase.from("profiles").update({ intro_template: introTemplate }).eq("id", userId);
  if (error) throw error;
}
