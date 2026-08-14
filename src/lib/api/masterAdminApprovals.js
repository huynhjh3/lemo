import { supabase } from "../supabaseClient.js";

const SELECT = "*, requestedByProfile:profiles!master_admin_approvals_requested_by_fkey(id, name)";

export async function fetchPendingApprovals() {
  const { data, error } = await supabase
    .from("master_admin_approvals")
    .select(SELECT)
    .eq("status", "pending")
    .order("created_at");
  if (error) throw error;
  return data;
}

// requested_by is never sent — its column default (auth.uid()) fills it
// in server-side, same trick as pre_install_checklists.created_by.
export async function requestMaintenanceOn() {
  const { error } = await supabase.from("master_admin_approvals").insert({ action_type: "maintenance_on", payload: {} });
  if (error) throw error;
}

export async function requestDeleteUser(userId, userName) {
  const { error } = await supabase
    .from("master_admin_approvals")
    .insert({ action_type: "delete_user", payload: { user_id: userId, user_name: userName } });
  if (error) throw error;
}

export async function requestInvite(role, { email, name, region }) {
  const actionType = role === "owner" ? "invite_owner" : "invite_geo_partner";
  const { error } = await supabase
    .from("master_admin_approvals")
    .insert({ action_type: actionType, payload: { email, name, region: region || null } });
  if (error) throw error;
}

// approverId is passed explicitly (not defaulted) — the DB trigger
// (prevent_self_approval, migration 029) validates it actually is the
// caller and isn't the original requester, but the column itself needs a
// real value up front to update.
export async function approveRequest(id, approverId) {
  const { error } = await supabase
    .from("master_admin_approvals")
    .update({ status: "approved", approved_by: approverId })
    .eq("id", id);
  if (error) throw error;
}

export async function rejectRequest(id, approverId) {
  const { error } = await supabase
    .from("master_admin_approvals")
    .update({ status: "rejected", approved_by: approverId })
    .eq("id", id);
  if (error) throw error;
}
