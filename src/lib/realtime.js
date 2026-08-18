import { supabase } from "./supabaseClient.js";

// Subscribes to postgres_changes on every table in `tables` and calls
// `onChange` (debounced) whenever any row in any of them changes. Used
// instead of merging individual realtime payloads into local state — the
// app already does a full RLS-scoped refetch after every one of its own
// mutations (see useCrmData's withRefresh), so pointing that same
// `refresh` function at realtime events keeps one data-loading path
// instead of two. Returns an unsubscribe function for cleanup.
export function subscribeToTables(channelName, tables, onChange, debounceMs = 300) {
  let timer = null;
  const debounced = () => {
    clearTimeout(timer);
    timer = setTimeout(onChange, debounceMs);
  };

  // supabase-js dedupes `.channel()` by topic name — a second caller using
  // the same channelName gets back the SAME already-joined channel object,
  // and calling `.on()` on an already-joined channel throws synchronously
  // (crashed the whole app once already, with no error boundary to catch
  // it — see TeamPage's former duplicate useAppSettings() call). Only the
  // first caller for a given topic actually binds/subscribes/tears down;
  // later callers become harmless no-ops instead of a crash.
  const channel = supabase.channel(channelName);
  const owns = channel.state === "closed";
  if (owns) {
    tables.forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, debounced);
    });
    channel.subscribe();
  }

  return () => {
    clearTimeout(timer);
    if (owns) supabase.removeChannel(channel);
  };
}
