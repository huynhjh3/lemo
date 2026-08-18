import { supabase } from "../supabaseClient.js";

export async function findProspects({ industry, location, installedProfile }) {
  const { data, error } = await supabase.functions.invoke("find-prospects", {
    body: { industry, location, installedProfile },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.prospects;
}
