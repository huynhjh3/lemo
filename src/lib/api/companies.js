import { supabase } from "../supabaseClient.js";

const COMPANY_SELECT = `
  *,
  rep:profiles!companies_rep_id_fkey(id, name),
  contacts(*),
  outlets(*, devices(*, device_usage_uploads(*)), pre_install_checklists(*)),
  activity_log(*, user:profiles!activity_log_user_id_fkey(id, name)),
  notes(*, author:profiles!notes_author_id_fkey(id, name)),
  revenue_entries(*),
  revenue_csv_uploads(*)
`;

export async function fetchCompanies() {
  const { data, error } = await supabase.from("companies").select(COMPANY_SELECT).order("created_at");
  if (error) throw error;
  return data;
}

export async function createCompany(fields) {
  const { data, error } = await supabase.from("companies").insert(fields).select().single();
  if (error) throw error;
  return data;
}

export async function updateCompany(id, fields) {
  const { data, error } = await supabase.from("companies").update(fields).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCompany(id) {
  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) throw error;
}

export async function updateOutlet(id, fields) {
  const { error } = await supabase.from("outlets").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteOutlet(id) {
  const { error } = await supabase.from("outlets").delete().eq("id", id);
  if (error) throw error;
}

export async function updateDevice(id, fields) {
  const { error } = await supabase.from("devices").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteDevice(id) {
  const { error } = await supabase.from("devices").delete().eq("id", id);
  if (error) throw error;
}

export async function createContact(companyId, fields) {
  const { error } = await supabase.from("contacts").insert({ company_id: companyId, ...fields });
  if (error) throw error;
}

export async function updateContact(id, fields) {
  const { error } = await supabase.from("contacts").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteContact(id) {
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) throw error;
}

export async function createOutlet(companyId, fields) {
  const { data, error } = await supabase
    .from("outlets")
    .insert({ company_id: companyId, ...fields })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createDevice(outletId, fields) {
  const { error } = await supabase.from("devices").insert({ outlet_id: outletId, ...fields });
  if (error) throw error;
}

export async function addNote(companyId, authorId, body) {
  const { error } = await supabase.from("notes").insert({ company_id: companyId, author_id: authorId, body });
  if (error) throw error;
}

export async function updateNote(id, body) {
  const { error } = await supabase.from("notes").update({ body }).eq("id", id);
  if (error) throw error;
}

export async function deleteNote(id) {
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteActivity(id) {
  const { error } = await supabase.from("activity_log").delete().eq("id", id);
  if (error) throw error;
}

// completed_at is explicitly reset to null on every save (not just on
// insert) — editing a checklist after it was marked complete un-completes
// it, since a stale "complete" would otherwise hide details that changed
// after the fact. created_by is deliberately left out of the payload: its
// column default (auth.uid()) only fires on the INSERT half of the upsert,
// so it's set once by whoever first fills the checklist out and never
// overwritten by a later editor.
export async function upsertPreInstallChecklist(outletId, fields) {
  const { error } = await supabase
    .from("pre_install_checklists")
    .upsert({ outlet_id: outletId, ...fields, completed_at: null }, { onConflict: "outlet_id" });
  if (error) throw error;
}

export async function completePreInstallChecklist(id) {
  const { error } = await supabase
    .from("pre_install_checklists")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function addRevenueEntry(companyId, period, amount) {
  const { error } = await supabase
    .from("revenue_entries")
    .upsert({ company_id: companyId, period, amount }, { onConflict: "company_id,period" });
  if (error) throw error;
}
