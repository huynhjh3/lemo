import { supabase } from "../supabaseClient.js";
import { invokeFunction } from "./functions.js";

export async function fetchEvents() {
  const { data, error } = await supabase.from("events").select("*").order("starts_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function saveEvent(id, fields) {
  const { error } = id
    ? await supabase.from("events").update(fields).eq("id", id)
    : await supabase.from("events").insert(fields);
  if (error) {
    if (error.code === "23505") throw new Error("That event link name is already used by another event.");
    throw error;
  }
}

export async function deleteEvent(id) {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchRsvps() {
  const { data, error } = await supabase.from("event_rsvps").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function updateRsvp(id, fields) {
  const { error } = await supabase.from("event_rsvps").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteRsvp(id) {
  const { error } = await supabase.from("event_rsvps").delete().eq("id", id);
  if (error) throw error;
}

// test: true sends one sample reminder to the signed-in Owner only.
export const sendReminder = ({ eventId, note, test = false }) => invokeFunction("send-event-reminder", { event_id: eventId, note, test });
