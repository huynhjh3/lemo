import { supabase } from "../supabaseClient.js";

// supabase-js's functions.invoke() wraps ANY non-2xx response from an Edge
// Function in a generic "Edge Function returned a non-2xx status code"
// error — the actual JSON body our functions return (e.g. { error: "..." })
// is only reachable via error.context (the raw Response object), which has
// to be read separately. Without this, every real error message from
// generate-ai-content / find-prospects was getting silently discarded and
// replaced with that one generic string in the UI.
export async function invokeFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = error.message;
    const status = error.context?.status;
    try {
      // Our own functions answer { error }; Supabase's gateway answers
      // { message } / { msg } (bad token, function crashed, over its limits).
      const raw = await error.context?.text();
      try {
        const parsed = JSON.parse(raw);
        const detail = parsed?.error || parsed?.message || parsed?.msg;
        if (detail) message = detail;
      } catch {
        if (raw) message = raw.slice(0, 300);
      }
    } catch {
      // no readable response (e.g. a network-level failure) — keep error.message
    }
    throw new Error(status ? `${message} (HTTP ${status})` : message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
