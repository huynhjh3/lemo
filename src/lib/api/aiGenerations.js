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

// The most recent saved brief for a company (the Overview card shows it and
// only calls the AI again when the user clicks Brief me / Refresh).
export async function fetchLatestBriefing(companyId) {
  const { data, error } = await supabase
    .from("ai_generations")
    .select("id, generated_text, created_at")
    .eq("company_id", companyId)
    .eq("type", "briefing")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
