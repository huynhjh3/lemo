import { supabase } from "../supabaseClient.js";

const COMPANY_SELECT = `
  *,
  rep:profiles!companies_rep_id_fkey(id, name),
  contacts(*),
  outlets(*, devices(*, device_usage_uploads(*))),
  activity_log(*, user:profiles!activity_log_user_id_fkey(id, name)),
  communications_log(*, contact:contacts(id, name), createdByProfile:profiles!communications_log_created_by_fkey(id, name)),
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

// contact_id is optional — a communications-log entry can link to one of
// the company's tracked Contacts, or just carry a free-text contact_name
// for someone who isn't tracked yet (same optional-link/free-text-fallback
// shape as showroom_bookings' company_id/prospect_name).
export async function addCommunicationLogEntry(companyId, fields) {
  const { error } = await supabase.from("communications_log").insert({ company_id: companyId, ...fields });
  if (error) throw error;
}

export async function updateCommunicationLogEntry(id, fields) {
  const { error } = await supabase.from("communications_log").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteCommunicationLogEntry(id) {
  const { error } = await supabase.from("communications_log").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteActivity(id) {
  const { error } = await supabase.from("activity_log").delete().eq("id", id);
  if (error) throw error;
}

export async function addRevenueEntry(companyId, period, amount) {
  const { error } = await supabase
    .from("revenue_entries")
    .upsert({ company_id: companyId, period, amount }, { onConflict: "company_id,period" });
  if (error) throw error;
}
