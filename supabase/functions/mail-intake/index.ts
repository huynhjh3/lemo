// Receives mail from the shared CRM mailbox. A Google Apps Script running in
// that Gmail account (see docs/crm-mailbox-script.gs) posts new messages here
// with a shared secret in X-Webhook-Secret — there's no user login, so deploy
// with --no-verify-jwt:
//   npx supabase functions deploy mail-intake --no-verify-jwt
//
// Secrets: MAIL_WEBHOOK_SECRET (required). Optional: CRM_MAILBOX (the shared
// mailbox's own address, ignored when it shows up as a sender/recipient),
// RESEND_VERIFIED_DOMAIN (default lemowellness.com — mail from this domain is
// "ours", i.e. outbound).
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// Two kinds of script post here: the shared CRM mailbox's (everything it
// receives) and each team member's own (docs/crm-gmail-script.gs — only mail
// to/from saved contacts, or threads they labelled "CRM"). A personal script
// also asks for the list of saved contact emails ({"action":"contacts"}) so
// it can filter before anything leaves their inbox.
//
// Inbound (from someone outside the team): matched to a contact by email and
// logged as an Email on that company's Communications Log (which also resets
// its "last contact" clock). Outbound copies (a team member BCC'd the
// mailbox): matched on the recipient. Anything unmatched is kept for an Owner
// to place from Inbox -> Replies.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const EMAIL_IN_TEXT = /[^\s<>"',;()]+@[^\s<>"',;()]+\.[^\s<>"',;()]+/g;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const emails = (s: string) => Array.from(new Set((s.match(EMAIL_IN_TEXT) ?? []).map((e) => e.toLowerCase())));
// Drops the quoted history under a reply. Gmail often wraps its "On <date>
// <name> <email> wrote:" header across two lines, so match across a newline.
const QUOTE_START = /(^|\n)\s*(On [^\n]{0,160}(\n[^\n]{0,160})?\bwrote:|-{2,}\s*Original Message|From:\s|>)/i;
const newText = (t: string) => {
  const cut = t.search(QUOTE_START);
  return (cut >= 0 ? t.slice(0, cut) : t).trim();
};
// A team member forwarding a contact's reply to the mailbox ("Fwd: Re: …").
// Reads the original sender, subject and text out of the forwarded block
// (Gmail's "---------- Forwarded message ---------" header, or any "From:" line).
function parseForward(raw: string) {
  const text = raw.replace(/\r/g, "").replace(/[\u202f\u00a0]/g, " ");
  const marker = text.search(/-{3,}\s*Forwarded message\s*-{3,}/i);
  let start = -1;
  if (marker >= 0) start = text.indexOf("\n", marker) + 1;
  else { const f = text.search(/^From:\s/im); if (f >= 0) start = f; }
  if (start <= 0) return null;
  const lines = text.slice(start).split("\n");
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  const h: Record<string, string> = {};
  for (; i < lines.length && lines[i].trim(); i++) {
    const mm = lines[i].match(/^(From|Date|Sent|Subject|To|Cc):\s*(.*)$/i);
    if (mm) h[mm[1].toLowerCase()] = mm[2].trim();
  }
  const from = emails(h.from ?? "")[0];
  if (!from) return null;
  return { from, fromHeader: h.from ?? "", subject: h.subject ?? "", body: lines.slice(i).join("\n") };
}
// Machine mail that should never reach an Owner's queue.
const NOISE = /(^|[._-])(no-?reply|donotreply|do-not-reply|mailer-daemon|postmaster|bounce|notifications?)([._-]|@)/i;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const secret = Deno.env.get("MAIL_WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret) return json({ error: "Unauthorized" }, 401);

  let body: { messages?: Record<string, unknown>[]; action?: string } = {};
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  if ((body as { action?: string }).action === "contacts") {
    const out = new Set<string>();
    for (let from = 0; from < 20000; from += 1000) {
      const { data } = await admin.from("contacts").select("email").not("email", "is", null).range(from, from + 999);
      for (const r of data ?? []) { const e = (r.email ?? "").trim().toLowerCase(); if (e) out.add(e); }
      if ((data?.length ?? 0) < 1000) break;
    }
    return json({ emails: [...out] });
  }

  const messages = Array.isArray(body.messages) ? body.messages.slice(0, 100) : [];

  const domain = (Deno.env.get("RESEND_VERIFIED_DOMAIN") ?? "lemowellness.com").toLowerCase();
  const mailbox = (Deno.env.get("CRM_MAILBOX") ?? "").trim().toLowerCase();
  const isOurs = (e: string) => e.endsWith(`@${domain}`) || (!!mailbox && e === mailbox);

  const counts = { logged: 0, unmatched: 0, duplicate: 0, skipped: 0 };
  type Contact = { id: string; company_id: string; name: string; email: string };
  const findContact = async (addr: string): Promise<Contact | null> => {
    const { data } = await admin.from("contacts").select("id, company_id, name, email").ilike("email", addr).limit(1);
    return data?.length ? data[0] : null;
  };

  for (const m of messages) {
    const messageId = str(m.message_id, 200);
    let from = emails(str(m.from, 400))[0];
    if (!messageId || !from) { counts.skipped++; continue; }

    // Forwarded to the mailbox by a teammate: credit the original sender instead.
    const fwdRaw = str(m.forwarded, 12000);
    const fwd = fwdRaw && isOurs(from) ? parseForward(fwdRaw) : null;
    if (fwd) from = fwd.from;

    const { data: seen } = await admin.from("inbound_emails").select("id").eq("message_id", messageId).maybeSingle();
    if (seen) { counts.skipped++; continue; }

    const to = fwd ? [] : [...emails(str(m.to, 2000)), ...emails(str(m.cc, 2000))].filter((e) => e !== from);
    // Mail from our own domain is team mail (a BCC copy) — unless the sender is a
    // saved contact, in which case it's a reply from that contact.
    const senderContact = isOurs(from) ? await findContact(from) : null;
    const outbound = isOurs(from) && !senderContact;
    if (!outbound && NOISE.test(from)) { counts.skipped++; continue; }

    const subject = (fwd?.subject || str(m.subject, 300).replace(/^\s*(fwd?|fw):\s*/i, "")).slice(0, 300) || "(no subject)";
    const snippet = newText(fwd ? fwd.body : str(m.body, 8000)).slice(0, 5000);
    const when = new Date(str(m.date, 40) || Date.now());
    const receivedAt = isNaN(when.getTime()) ? new Date().toISOString() : when.toISOString();
    const fromName = (fwd ? fwd.fromHeader : str(m.from, 400)).replace(EMAIL_IN_TEXT, "").replace(/[<>"]/g, "").trim() || null;

    // Who is the outside party? The sender for inbound, the recipient for outbound.
    const candidates = outbound ? to.filter((e) => !isOurs(e)) : [from];
    if (!candidates.length) { counts.skipped++; continue; } // e.g. a "send a test to me" deck
    let contact: Contact | null = senderContact;
    for (const addr of candidates) {
      if (contact) break;
      contact = await findContact(addr);
    }

    // The same message can arrive through more than one inbox (the shared
    // mailbox AND a teammate's own) — log it once.
    {
      const lo = new Date(new Date(receivedAt).getTime() - 120_000).toISOString();
      const hi = new Date(new Date(receivedAt).getTime() + 120_000).toISOString();
      const { data: twin } = await admin.from("inbound_emails").select("id")
        .eq("from_email", from).eq("subject", subject).gte("received_at", lo).lte("received_at", hi)
        .in("status", ["logged", "unmatched", "duplicate"]).limit(1);
      if (twin?.length) { counts.duplicate++; continue; }
    }

    const row = {
      message_id: messageId, direction: outbound ? "outbound" : "inbound", from_email: from, from_name: fromName,
      to_emails: to.join(", ") || null, subject, snippet: snippet || null, received_at: receivedAt,
    };

    if (!contact) {
      await admin.from("inbound_emails").insert({ ...row, status: "unmatched" });
      counts.unmatched++;
      continue;
    }

    // A deck the CRM itself sent is already on the log — don't log its BCC copy twice.
    if (outbound) {
      const since = new Date(new Date(receivedAt).getTime() - 24 * 3600_000).toISOString();
      const { data: sent } = await admin.from("deck_emails").select("id")
        .eq("company_id", contact.company_id).ilike("to_email", contact.email)
        .eq("subject", subject).gte("created_at", since).limit(1);
      if (sent?.length) {
        await admin.from("inbound_emails").insert({ ...row, status: "duplicate", company_id: contact.company_id, contact_id: contact.id });
        counts.duplicate++;
        continue;
      }
    }

    const notes = outbound
      ? `Emailed ${contact.name} — "${subject}"${snippet ? `\n\n${snippet}` : ""}`
      : `Reply from ${contact.name} — "${subject}"${snippet ? `\n\n${snippet}` : ""}`;
    const { error: logErr } = await admin.from("communications_log").insert({
      company_id: contact.company_id, contact_id: contact.id, occurred_at: receivedAt, type: "email", notes, photo_urls: [],
    });
    if (logErr) {
      await admin.from("inbound_emails").insert({ ...row, status: "unmatched", company_id: contact.company_id, contact_id: contact.id });
      counts.unmatched++;
      continue;
    }
    await admin.from("inbound_emails").insert({ ...row, status: "logged", company_id: contact.company_id, contact_id: contact.id });
    counts.logged++;

    // A reply is the one thing worth a follow-up task (sending alone isn't). One
    // open reply task per company is enough, however many messages come in.
    if (!outbound) {
      const { data: open } = await admin.from("tasks").select("id").eq("company_id", contact.company_id).eq("done", false).ilike("title", "Reply from%").limit(1);
      if (!open?.length) {
        const { data: company } = await admin.from("companies").select("name, rep_id").eq("id", contact.company_id).maybeSingle();
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
        await admin.from("tasks").insert({
          company_id: contact.company_id,
          title: `Reply from ${contact.name}${company?.name ? ` (${company.name})` : ""} — follow up`,
          type: "email", due_date: today, assigned_to: company?.rep_id ?? null,
        });
      }
    }
  }

  return json({ ok: true, ...counts });
});
