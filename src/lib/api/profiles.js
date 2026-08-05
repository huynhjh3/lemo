import { supabase } from "../supabaseClient.js";

export async function fetchProfiles() {
  const { data, error } = await supabase.from("profiles").select("id, name, role, region").order("name");
  if (error) throw error;
  return data;
}
