// The two emails in the newsletter sign-up, shared by landing-intake (sends the
// confirmation) and confirm-subscription (sends the welcome once they confirm).
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderNewsletter, type Content } from "./newsletter-template.ts";
import type { Mailer } from "./mailer.ts";

export type Subscriber = { id: string; email: string; name: string | null; coupon_code: string | null; confirm_token: string };
const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const F = "font-family:'Poppins',Helvetica,Arial,sans-serif;";
const LOGO = "https://lemocrm.lemowellness.com/lemo-logo.png";
const shell = (title: string, body: string, footer: string) => `<!doctype html><html><body style="margin:0;background:#EFE7DE;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFE7DE;"><tr><td align="center" style="padding:22px 12px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#fff;border-radius:18px;overflow:hidden;">
<tr><td align="center" style="background:#FEF1E4;padding:28px 32px 22px;"><img src="${LOGO}" width="110" alt="Lemo" style="display:block;width:110px;height:auto;margin:0 auto;border:0;">
<p style="margin:18px 0 0;${F}font-size:26px;font-weight:800;color:#1A1512;line-height:1.15;">${title}</p></td></tr>
<tr><td style="padding:28px 36px 8px;${F}font-size:15px;line-height:1.65;color:#3A322C;">${body}</td></tr>
<tr><td align="center" style="background:#1A1512;padding:22px 32px;${F}font-size:11.5px;line-height:1.7;color:#BFB3A6;">${footer}</td></tr>
</table></td></tr></table></body></html>`;
const ADDRESS = "Lemo Inc. · 5151 California Ave, Irvine, CA 92617";

// Step 1: "confirm your email". Contains NO code — the code is the reward for confirming.
export async function sendConfirmation(mailer: Mailer, sub: Subscriber): Promise<boolean> {
  const first = (sub.name || "").split(" ")[0];
  const greeting = first ? `Hi ${first}` : "Hi";
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/confirm-subscription?t=${sub.confirm_token}`;
  const text = `${greeting},\n\nThanks for signing up for the Lemo newsletter! Please confirm your email address by opening this link:\n\n${url}\n\nOnce you confirm, we'll send your free 10-minute massage code.\n\nIf you didn't sign up, you can ignore this email and nothing will happen.\n\nLemo Wellness | lemowellness.com`;
  const html = shell("Confirm your email", `<p style="margin:0 0 14px;">${esc(greeting)},</p>
<p style="margin:0 0 18px;">Thanks for signing up for the Lemo newsletter! Please confirm your email address, and we’ll send your free 10-minute massage code.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 20px;"><tr><td align="center" bgcolor="#E8601C" style="background:#E8601C;border-radius:99px;"><a href="${url}" style="display:inline-block;padding:14px 34px;${F}font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">Confirm my email</a></td></tr></table>
<p style="margin:0 0 6px;font-size:13px;color:#6B5F55;">If you didn’t sign up, you can ignore this email and nothing will happen.</p>`,
    `${esc(ADDRESS)}<br><a href="https://lemowellness.com" style="color:#FF8A50;">lemowellness.com</a>`);
  return mailer.sendEmail(sub.email, "Confirm your email to get your free massage", text, "Lemo Wellness", html);
}

// Step 2, after they confirm: hand out their one-time code and send the welcome email.
export async function sendWelcome(admin: SupabaseClient, mailer: Mailer, sub: Subscriber, resendKey?: string): Promise<boolean> {
  let code: string | null = sub.coupon_code ?? null;
  if (!code) {
    const { data: assigned } = await admin.rpc("assign_next_coupon", { p_subscriber: sub.id });
    code = (assigned as string | null) ?? null;
    if (code) await admin.from("subscribers").update({ coupon_code: code, coupon_assigned_at: new Date().toISOString() }).eq("id", sub.id);
  }
  const first = (sub.name || "").split(" ")[0];
  const how = Deno.env.get("COUPON_INSTRUCTIONS") ?? "1. Go to any Lemo chair.\n2. Use the screen on the left side of the chair.\n3. Enter your one-time code.";
  const unsub = `${Deno.env.get("SUPABASE_URL")}/functions/v1/unsubscribe?s=${sub.id}`;
  const greeting = first ? `Hi ${first}` : "Hi";
  const text = code
    ? `${greeting},\n\nWelcome to the Lemo newsletter! Here's your free 10-minute massage code:\n\n${code}\n\nHow to use it:\n${how}\n\nEach code works once. You'll hear from us about once a month.\n\nLemo Wellness | lemowellness.com\nUnsubscribe: ${unsub}`
    : `${greeting},\n\nWelcome to the Lemo newsletter! We're getting your free 10-minute massage code ready and will email it to you shortly.\n\nYou'll hear from us about once a month.\n\nLemo Wellness | lemowellness.com\nUnsubscribe: ${unsub}`;
  const html = shell("Your free 10-minute massage", `<p style="margin:0 0 14px;">${esc(greeting)},</p>
<p style="margin:0 0 18px;">Welcome to the Lemo newsletter, and thanks for confirming! ${code ? "Here’s your code:" : "We’re getting your free code ready and will email it to you shortly."}</p>
${code ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="background:#FEF1E4;border:2px dashed #E8601C;border-radius:14px;padding:20px;"><span style="${F}font-size:32px;font-weight:800;letter-spacing:4px;color:#E8601C;">${esc(code)}</span><br><span style="${F}font-size:12px;color:#6B5F55;">One-time code · good for one free 10-minute massage</span></td></tr></table>
<p style="margin:22px 0 6px;${F}font-weight:700;color:#1A1512;">How to use it</p>
<p style="margin:0 0 14px;">${esc(how).replace(/\n/g, "<br>")}</p>` : ""}
<p style="margin:0 0 6px;">You’ll hear from us about once a month: new chairs and locations, what we’ve been up to, and what’s moving in wellness.</p>`,
    `${esc(ADDRESS)}<br><a href="https://lemowellness.com" style="color:#FF8A50;">lemowellness.com</a> · <a href="${unsub}" style="color:#FF8A50;">Unsubscribe</a>`);

  // If an issue is marked as the welcome email in the CRM (Inbox -> Newsletter issues), that is
  // what a new subscriber gets, with their own code in it. Otherwise the simple one above goes out.
  const { data: welcome } = await admin.from("newsletter_issues").select("subject, content").eq("is_welcome", true).maybeSingle();
  let sent: boolean;
  if (welcome) {
    const w = renderNewsletter(welcome.content as Content, { firstName: first || undefined, unsubscribeUrl: unsub, welcome: true, code });
    sent = await mailer.sendEmail(sub.email, welcome.subject, w.text, "Lemo Wellness", w.html);
  } else {
    sent = await mailer.sendEmail(sub.email, "Your free 10-minute massage from Lemo", text, "Lemo Wellness", html);
  }
  if (sent) await admin.from("subscribers").update({ welcome_sent_at: new Date().toISOString() }).eq("id", sub.id);
  if (!code) await mailer.notify("Out of coupon codes", [`${sub.email} confirmed their newsletter sign-up but there were no unused codes left.`, "Add more in the CRM → Inbox → Newsletter."]);

  const audience = Deno.env.get("RESEND_AUDIENCE_ID"), key = resendKey ?? Deno.env.get("RESEND_API_KEY");
  if (audience && key) {
    await fetch(`https://api.resend.com/audiences/${audience}/contacts`, {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: sub.email, first_name: first || undefined, unsubscribed: false }),
    }).catch(() => {});
  }
  return sent;
}
