import { supabase } from "../supabaseClient.js";

const SELECT = `
  *,
  author:profiles!notes_author_id_fkey(id, name),
  targetUser:profiles!notes_target_user_id_fkey(id, name),
  company:companies(id, name)
`;

export async function fetchNotes() {
  const { data, error } = await supabase.from("notes").select(SELECT).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// author_id is deliberately left out of the payload — its column default
// (auth.uid()) is what makes it tamper-proof (see migration 031).
export async function createNote({ body, company_id, target_user_id, target_region }) {
  const { error } = await supabase.from("notes").insert({
    body,
    company_id: company_id || null,
    target_user_id: target_user_id || null,
    target_region: target_region || null,
  });
  if (error) throw error;
}

export async function deleteNote(id) {
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
}
