import { supabase } from "../supabaseClient.js";

export async function fetchRegionColors() {
  const { data, error } = await supabase.from("region_colors").select("*").order("region");
  if (error) throw error;
  return data;
}

// Also handles renaming/recoloring an existing region (upsert on the
// region name) — the UI only ever calls this for a genuinely new region
// or a color change, never to rename one (see CompaniesPage.jsx).
export async function upsertRegionColor(region, color) {
  const { error } = await supabase.from("region_colors").upsert({ region, color }, { onConflict: "region" });
  if (error) throw error;
}

export async function deleteRegionColor(region) {
  const { error } = await supabase.from("region_colors").delete().eq("region", region);
  if (error) throw error;
}
