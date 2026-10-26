import { supabase } from "../supabaseClient.js";
import { invokeFunction } from "./functions.js";
import JSZip from "jszip";
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

// Reads an "issue bundle" — a .zip holding issue.json ({ subject, content }) plus an
// images/ folder. Any picture field that names a file (not an https:// link) is
// uploaded to the public bucket and swapped for its URL, so a whole issue can be
// handed over as one file instead of typed into the form. Returns { subject, content }.
export async function readIssueBundle(file) {
  const zip = await JSZip.loadAsync(file);
  const entry = zip.file("issue.json") || Object.values(zip.files).find((f) => !f.dir && /(^|\/)issue\.json$/.test(f.name));
  if (!entry) throw new Error("That file doesn't have an issue.json inside — is it the right zip?");
  let issue;
  try { issue = JSON.parse(await entry.async("string")); } catch { throw new Error("issue.json couldn't be read."); }
  if (!issue || typeof issue.subject !== "string" || typeof issue.content !== "object") throw new Error("issue.json needs a subject and content.");
  const uploaded = new Map();
  const resolve = async (name) => {
    if (!name || /^https?:\/\//i.test(name)) return name || "";
    if (uploaded.has(name)) return uploaded.get(name);
    const pic = zip.file(`images/${name}`) || Object.values(zip.files).find((f) => !f.dir && f.name.endsWith(`/${name}`));
    if (!pic) throw new Error(`The picture "${name}" is named in the issue but isn't in the zip's images folder.`);
    const blob = await pic.async("blob");
    const url = await uploadNewsletterImage(new File([blob], name, { type: /\.png$/i.test(name) ? "image/png" : "image/jpeg" }));
    uploaded.set(name, url);
    return url;
  };
  const content = issue.content;
  content.hero_image_url = await resolve(content.hero_image_url);
  for (const story of content.stories || []) story.image_url = await resolve(story.image_url);
  return { subject: issue.subject, content };
}
