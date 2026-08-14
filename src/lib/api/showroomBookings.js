import { supabase } from "../supabaseClient.js";

export async function fetchShowroomBookings() {
  const { data, error } = await supabase
    .from("showroom_bookings")
    .select("*, company:companies(id, name), bookedByProfile:profiles!showroom_bookings_booked_by_fkey(id, name)")
    .order("start_at");
  if (error) throw error;
  return data;
}

// 23P01 = Postgres exclusion_violation — the GiST exclusion constraint
// (migration 025) is what actually prevents the double-booking; this just
// turns that into a message a BD consultant can read instead of a raw
// Postgres error code.
export async function createShowroomBooking(fields) {
  const { error } = await supabase.from("showroom_bookings").insert(fields);
  if (error) {
    if (error.code === "23P01") throw new Error("That time slot overlaps an existing showroom booking.");
    throw error;
  }
}

export async function deleteShowroomBooking(id) {
  const { error } = await supabase.from("showroom_bookings").delete().eq("id", id);
  if (error) throw error;
}
