import { supabase } from "../supabaseClient.js";

export async function fetchTasks() {
  const { data, error } = await supabase
    .from("tasks")
    .select("*, company:companies(id, name), pre_install_checklists(*)")
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

export async function updateTask(id, fields) {
  const { error } = await supabase.from("tasks").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteTask(id) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

// completed_at is explicitly reset to null on every save (not just on
// insert) — editing a checklist after it was marked complete un-completes
// it, since a stale "complete" would otherwise hide details that changed
// after the fact. created_by is deliberately left out of the payload: its
// column default (auth.uid()) only fires on the INSERT half of the upsert,
// so it's set once by whoever first fills the checklist out and never
// overwritten by a later editor.
export async function upsertPreInstallChecklist(taskId, fields) {
  const { error } = await supabase
    .from("pre_install_checklists")
    .upsert(
      {
        task_id: taskId, ...fields,
        completed_at: null, submitted_for_install_at: null, submitted_by: null,
        approved_for_install_at: null, approved_by: null,
        bypassed_at: null, bypassed_by: null,
      },
      { onConflict: "task_id" }
    );
  if (error) throw error;
}

export async function completePreInstallChecklist(id) {
  const { error } = await supabase
    .from("pre_install_checklists")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// A separate, later step than completing the checklist — this is what
// turns it into a work order Owners see as a High Priority Action.
export async function submitPreInstallChecklistForInstall(id, userId) {
  const { error } = await supabase
    .from("pre_install_checklists")
    .update({ submitted_for_install_at: new Date().toISOString(), submitted_by: userId })
    .eq("id", id);
  if (error) throw error;
}

// The Owner explicitly signing off on a submitted work order — this is
// what clears it off the "Work Order" High Priority Action, not the
// company's stage later moving to Installed.
export async function approvePreInstallChecklist(id, userId) {
  const { error } = await supabase
    .from("pre_install_checklists")
    .update({ approved_for_install_at: new Date().toISOString(), approved_by: userId })
    .eq("id", id);
  if (error) throw error;
}

// Owner-only override for a task that doesn't need a checklist at all
// (already installed, predates this feature, etc.) — an upsert, same as
// upsertPreInstallChecklist, since it needs to work even when no checklist
// row exists yet for that task. Unlike a normal save, this doesn't touch
// (or require) any of the other fields.
export async function bypassPreInstallChecklist(taskId, userId) {
  const { error } = await supabase
    .from("pre_install_checklists")
    .upsert(
      { task_id: taskId, bypassed_at: new Date().toISOString(), bypassed_by: userId },
      { onConflict: "task_id" }
    );
  if (error) throw error;
}

export async function undoBypassPreInstallChecklist(id) {
  const { error } = await supabase
    .from("pre_install_checklists")
    .update({ bypassed_at: null, bypassed_by: null })
    .eq("id", id);
  if (error) throw error;
}
