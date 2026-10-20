import { supabase } from "../supabaseClient.js";
import { invokeFunction } from "./functions.js";
import { PPTX_MIME } from "../deckPersonalize.js";

const TEMPLATES = "deck-templates";
const GENERATED = "generated-decks";

export async function fetchTemplates() {
  const { data, error } = await supabase.from("deck_templates").select("*").order("created_at");
  if (error) throw error;
  return data;
}

export async function uploadTemplate({ name, kind, placeholder, file }) {
  const path = `${crypto.randomUUID()}.pptx`;
  const { error: upErr } = await supabase.storage.from(TEMPLATES).upload(path, file, { contentType: PPTX_MIME });
  if (upErr) throw upErr;
  const { error } = await supabase.from("deck_templates").insert({ name, kind, placeholder, storage_path: path });
  if (error) {
    await supabase.storage.from(TEMPLATES).remove([path]);
    throw error;
  }
}

export async function deleteTemplate(template) {
  const { error } = await supabase.from("deck_templates").delete().eq("id", template.id);
  if (error) throw error;
  await supabase.storage.from(TEMPLATES).remove([template.storage_path]);
}

export async function downloadTemplate(path) {
  const { data, error } = await supabase.storage.from(TEMPLATES).download(path);
  if (error) throw error;
  return data.arrayBuffer();
}

export async function saveGeneratedDeck({ templateId, companyId, fileName, blob }) {
  const path = `${companyId}/${crypto.randomUUID()}.pptx`;
  const { error: upErr } = await supabase.storage.from(GENERATED).upload(path, blob, { contentType: PPTX_MIME });
  if (upErr) throw upErr;
  const { data, error } = await supabase
    .from("generated_decks")
    .insert({ template_id: templateId, company_id: companyId, file_name: fileName, pptx_path: path })
    .select()
    .single();
  if (error) {
    await supabase.storage.from(GENERATED).remove([path]);
    throw error;
  }
  return data;
}

export async function fetchGeneratedDecks(limit = 25) {
  const { data, error } = await supabase
    .from("generated_decks")
    .select("*, company:companies(id, name), creator:profiles!generated_decks_created_by_fkey(name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function convertToPdf(generatedDeckId) {
  const data = await invokeFunction("convert-deck", { generated_deck_id: generatedDeckId });
  return data.pdf_path;
}

// A one-hour link that downloads the file under `fileName`.
export async function signedDownloadUrl(path, fileName) {
  const { data, error } = await supabase.storage.from(GENERATED).createSignedUrl(path, 3600, { download: fileName });
  if (error) throw error;
  return data.signedUrl;
}
