import { supabase } from "../supabaseClient.js";

// On a non-2xx response, supabase-js gives us `error` (a FunctionsHttpError)
// with `data: null` — the function's own {error: "..."} JSON body only comes
// through via error.context, a raw Response we still need to parse.
async function invoke(action, payload) {
  const { data, error } = await supabase.functions.invoke("manage-user", {
    body: { action, ...payload },
  });
  if (error) {
    const body = await error.context?.json?.().catch(() => null);
    throw new Error(body?.error || error.message);
  }
  return data;
}

// approval_id is only required for owner/geo_partner roles (see
// master_admin_approvals, migration 029) — the Edge Function re-derives
// email/name/region from the approved request itself for those, so
// passing them here too is harmless, not load-bearing.
export function createUser({ email, name, role, region, company_id, approval_id }) {
  return invoke("create", {
    email, name, role, region, company_id, approval_id,
    redirectTo: window.location.origin + window.location.pathname,
  });
}

// Always requires approval_id now — any account deletion needs a second,
// different Master Admin's approval first.
export function deleteUser(approval_id) {
  return invoke("delete", { approval_id });
}
