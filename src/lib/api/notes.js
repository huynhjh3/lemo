import { supabase } from "../supabaseClient.js";

const SELECT = `
  *,
  author:profiles!notes_author_id_fkey(id, name),
  targetUser:profiles!notes_target_user_id_fkey(id, name),
  company:companies(id, name),
  comments:note_comments(*, author:profiles!note_comments_author_id_fkey(id, name)),
  reads:note_reads(read_at)
`;

// `reads` only ever contains the current user's own row (note_reads' RLS
// is select-own-only) — see transform.js for how that's turned into readAt.
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

// user_id is left out of the payload (see migration 032) for the same
// tamper-proof-default reason notes.author_id is.
export async function markNoteRead(noteId) {
  const { error } = await supabase.from("note_reads").upsert({ note_id: noteId, read_at: new Date().toISOString() }, { onConflict: "note_id,user_id" });
  if (error) throw error;
}

export async function createNoteComment({ note_id, body }) {
  const { error: commentError } = await supabase.from("note_comments").insert({ note_id, body });
  if (commentError) throw commentError;
  // Posting a reply counts as having read the thread (decided explicitly,
  // see memory) — clears it from the commenter's own HPA immediately.
  await markNoteRead(note_id);
}

export async function deleteNoteComment(id) {
  const { error } = await supabase.from("note_comments").delete().eq("id", id);
  if (error) throw error;
}
