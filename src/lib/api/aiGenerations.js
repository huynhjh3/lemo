import { supabase } from "../supabaseClient.js";
import { invokeFunction } from "./functions.js";

export async function generateAiContent({ company_id, type }) {
  const data = await invokeFunction("generate-ai-content", { company_id, type });
  return data.generation;
}

// Saving an edit is what marks a generation as a real "voice" example for
// future prompts (see generate-ai-content) — an untouched, never-saved
// draft never contributes one.
export async function saveAiGenerationEdit(id, editedText) {
  const { error } = await supabase
    .from("ai_generations")
    .update({ edited_text: editedText, edited_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
