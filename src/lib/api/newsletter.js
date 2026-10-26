import { supabase } from "../supabaseClient.js";
import { invokeFunction } from "./functions.js";
import { compressImage } from "../images.js";

const IMAGES = "newsletter-images";

export async function fetchIssues() {
  const { data, error } = await supabase
    .from("newsletter_issues").select("id, subject, status, recipients_count, sent_at, updated_at")
    .order("updated_at", { ascending: false }).limit(50);
  if (error) throw error;
  return data;
}

export async function fetchIssue(id) {
  const { data, error } = await supabase.from("newsletter_issues").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

// Creates a draft, or updates one (RLS only lets an Owner edit a draft — a sent issue is a record).
export async function saveIssue({ id, subject, content }) {
  if (id) {
    const { data, error } = await supabase.from("newsletter_issues")
      .update({ subject, content, updated_at: new Date().toISOString() }).eq("id", id).select("id").single();
    if (error) throw error;
    return data.id;
  }
  const { data, error } = await supabase.from("newsletter_issues").insert({ subject, content }).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function deleteIssue(id) {
  const { error } = await supabase.from("newsletter_issues").delete().eq("id", id);
  if (error) throw error;
}

export async function previewIssue(content) {
  const { html } = await invokeFunction("send-newsletter", { action: "preview", content });
  return html;
}
export const sendTest = ({ subject, content }) => invokeFunction("send-newsletter", { action: "test", subject, content });
export const sendIssue = (issueId) => invokeFunction("send-newsletter", { action: "send", issue_id: issueId });

// Email images must load for people who aren't signed in, so they go in a public bucket.
export async function uploadNewsletterImage(file) {
  const blob = await compressImage(file, { maxDim: 1400, quality: 0.82 });
  const path = `${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(IMAGES).upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return supabase.storage.from(IMAGES).getPublicUrl(path).data.publicUrl;
}
