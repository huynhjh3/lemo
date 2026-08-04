import { supabase } from "../supabaseClient.js";

export async function upsertCsvRevenue(rows) {
  if (!rows.length) return;
  const { error } = await supabase
    .from("revenue_csv_uploads")
    .upsert(rows, { onConflict: "company_id,upload_date" });
  if (error) throw error;
}
