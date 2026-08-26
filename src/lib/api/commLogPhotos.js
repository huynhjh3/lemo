import { supabase } from "../supabaseClient.js";

const BUCKET = "communications-log-photos";

// Path is "<company_id>/<uuid>.jpg" — the company_id prefix is what the
// storage.objects RLS policies (migration 042) key off of.
export async function uploadCommLogPhoto(companyId, blob) {
  const path = `${companyId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return path;
}

export async function deleteCommLogPhotos(paths) {
  if (!paths?.length) return;
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) throw error;
}

// Bucket is private, so every read goes through a signed URL — the request
// itself is RLS-checked (same policy as uploading), so a path someone
// shouldn't see just fails to sign rather than silently serving the file.
export async function getSignedPhotoUrls(paths) {
  if (!paths?.length) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  if (error) throw error;
  const map = {};
  data.forEach((d) => { if (d.signedUrl) map[d.path] = d.signedUrl; });
  return map;
}
