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
    try {
      const parsed = await error.context?.json();
      if (parsed?.error) message = parsed.error;
    } catch {
      // context wasn't JSON (e.g. a network-level failure) — fall back to error.message
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
