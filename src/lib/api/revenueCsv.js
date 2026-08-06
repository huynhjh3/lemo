import { supabase } from "../supabaseClient.js";

export async function upsertCsvRevenue(companyRows, deviceRows = []) {
  if (companyRows.length) {
    const { error } = await supabase
      .from("revenue_csv_uploads")
      .upsert(companyRows, { onConflict: "company_id,upload_date" });
    if (error) throw error;
  }
  if (deviceRows.length) {
    const { error } = await supabase
      .from("device_usage_uploads")
      .upsert(deviceRows, { onConflict: "device_id,upload_date" });
    if (error) throw error;
  }
}
