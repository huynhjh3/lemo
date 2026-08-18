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

  const channel = supabase.channel(channelName);
  tables.forEach((table) => {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, debounced);
  });
  channel.subscribe();

  return () => {
    clearTimeout(timer);
    supabase.removeChannel(channel);
  };
}
