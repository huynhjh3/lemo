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

export function createUser({ email, name, role, region, company_id }) {
  return invoke("create", {
    email, name, role, region, company_id,
    redirectTo: window.location.origin + window.location.pathname,
  });
}

export function deleteUser(id) {
  return invoke("delete", { id });
}
