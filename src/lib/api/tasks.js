import { supabase } from "../supabaseClient.js";

export async function fetchTasks() {
  const { data, error } = await supabase
    .from("tasks")
    .select("*, company:companies(id, name)")
    .order("due_date");
  if (error) throw error;
  return data;
}

export async function createTask(fields) {
  const { error } = await supabase.from("tasks").insert(fields);
  if (error) throw error;
}

export async function completeTask(id, done = true) {
  const { error } = await supabase.from("tasks").update({ done }).eq("id", id);
  if (error) throw error;
}
