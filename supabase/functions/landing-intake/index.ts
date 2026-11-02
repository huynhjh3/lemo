// Receives everything the public landing page (lemowellness.com/connect)
// reports: page views and clicks, "talk to us" requests, newsletter
// sign-ups (which get a one-time code by email), and BD consultant
// applications. The page's own backend calls this with a shared secret in
// the X-Webhook-Secret header — there is no user login here, so deploy it
// with --no-verify-jwt:
//   npx supabase functions deploy landing-intake --no-verify-jwt
//
// Secrets: LANDING_WEBHOOK_SECRET (required), RESEND_API_KEY (to email codes
// and notifications). Optional: NOTIFY_EMAIL (where new leads/applications are
// announced), RESEND_AUDIENCE_ID (adds newsletter sign-ups to a Resend
// audience), RESEND_VERIFIED_DOMAIN (default lemowellness.com),
// COUPON_INSTRUCTIONS (how to redeem — shown in the welcome email).
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { makeMailer } from "../_shared/mailer.ts";
import { sendConfirmation, sendWelcome, type Subscriber } from "../_shared/welcome.ts";
import { renderEventEmail, icsBase64, whenText, type EventInfo } from "../_shared/event-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const CLICK_EVENTS = ["view", "click_contact", "click_newsletter", "click_bd", "click_rsvp"];
const COMING_AS = ["Prospective partner", "Venue partner", "BD consultant", "Friend of Lemo"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const secret = Deno.env.get("LANDING_WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret) return json({ error: "Unauthorized" }, 401);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const type = str(body.type, 20);
  const session = str(body.session_id, 64) || "unknown";
  const source = str(body.source, 60) || null;
  const domain = (Deno.env.get("RESEND_VERIFIED_DOMAIN") ?? "lemowellness.com").toLowerCase();
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const notifyTo = (Deno.env.get("NOTIFY_EMAIL") ?? "").trim();

  const recordEvent = (event: string) => admin.from("landing_events").insert({ session_id: session, event, source });

  // Which influencer (if any) sent this person? A promo code someone typed is deliberate, so
  // it wins over the link they happened to arrive through.
  async function resolveInfluencer(src: string | null, promo: string): Promise<string | null> {
    if (promo) {
      const { data } = await admin.from("influencers").select("id").eq("active", true).ilike("promo_code", promo).maybeSingle();
      if (data) return data.id;
    }
    if (src) {
      const { data } = await admin.from("influencers").select("id").eq("active", true).eq("slug", src.toLowerCase()).maybeSingle();
      if (data) return data.id;
    }
    return null;
  }

  const { sendEmail, notify } = makeMailer({ resendKey, domain, notifyTo });

  // Newsletter sign-up with double opt-in. A new address gets ONLY a "confirm your email" message;
  // the one-time code and welcome email are sent when they click it (confirm-subscription). Used by
  // the newsletter form and by an RSVP that ticks the newsletter box.
  //   pending  -> we need them to confirm (confirmation just sent, or one went out in the last hour)
  //   already  -> already confirmed and subscribed (their welcome is re-sent at most once a day)
  async function subscribeNewsletter(email: string, name: string): Promise<{ ok: boolean; status: "pending" | "already" | "error" }> {
    const now = Date.now();
    const sinceMs = (iso: string | null) => (iso ? now - Date.parse(iso) : Infinity);
    let { data: sub } = await admin.from("subscribers").select("*").eq("email", email).maybeSingle();

    if (!sub) {
      const { data: created, error } = await admin.from("subscribers")
        .insert({ email, name: name || null, source, influencer_id: await resolveInfluencer(source, "") }).select().single();
      if (error || !created) return { ok: false, status: "error" };
      if (await sendConfirmation({ sendEmail, notify }, created as Subscriber)) await admin.from("subscribers").update({ confirm_sent_at: new Date().toISOString() }).eq("id", created.id);
      return { ok: true, status: "pending" };
    }

    if (sub.unsubscribed_at || !sub.confirmed_at) {
      // Coming back after unsubscribing means confirming again. They keep any code they already had.
      if (sub.unsubscribed_at) {
        await admin.from("subscribers").update({ unsubscribed_at: null, confirmed_at: null, consented_at: new Date().toISOString() }).eq("id", sub.id);
      }
      // At most one confirmation email an hour per address, so nobody can be mail-bombed through the form.
      if (sinceMs(sub.confirm_sent_at) > 3600_000) {
        if (await sendConfirmation({ sendEmail, notify }, sub as Subscriber)) await admin.from("subscribers").update({ confirm_sent_at: new Date().toISOString() }).eq("id", sub.id);
      }
      return { ok: true, status: "pending" };
    }

    if (sinceMs(sub.welcome_sent_at) > 86400_000) await sendWelcome(admin, { sendEmail, notify }, sub as Subscriber, resendKey);
    return { ok: true, status: "already" };
  }

  // Honeypot: a hidden field real people never fill in.
  if (str(body.website, 200)) return json({ ok: true });

  if (type === "event") {
    const event = str(body.event, 30);
    if (!CLICK_EVENTS.includes(event)) return json({ error: "Unknown event" }, 400);
    await recordEvent(event);
    return json({ ok: true });
  }

  if (type === "contact") {
    const name = str(body.name, 120), email = str(body.email, 200).toLowerCase();
    if (!name || !EMAIL.test(email)) return json({ error: "Name and a valid email are required." }, 400);
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { data: dup } = await admin.from("web_leads").select("id").eq("email", email).gte("created_at", since).limit(1);
    if (!dup?.length) {
      const promo = str(body.promo_code, 40).toUpperCase().replace(/[^A-Z0-9]/g, "");
      const influencerId = await resolveInfluencer(source, promo);
      await admin.from("web_leads").insert({
        name, email, phone: str(body.phone, 40) || null, company: str(body.company, 160) || null,
        title: str(body.title, 120) || null, message: str(body.message, 2000) || null, source,
        promo_code: promo || null, influencer_id: influencerId,
      });
      await notify(`New web lead: ${name}`, [
        `${name} (${email}) asked to talk.`, body.company ? `Company: ${str(body.company, 160)}` : "",
        body.phone ? `Phone: ${str(body.phone, 40)}` : "", body.message ? `Message: ${str(body.message, 2000)}` : "",
        "", "Review it in the CRM → Inbox.",
      ].filter(Boolean));
    }
    await recordEvent("submit_contact");
    return json({ ok: true });
  }

  if (type === "bd") {
    const name = str(body.name, 120), email = str(body.email, 200).toLowerCase();
    if (!name || !EMAIL.test(email)) return json({ error: "Name and a valid email are required." }, 400);
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { data: dup } = await admin.from("bd_applications").select("id").eq("email", email).gte("created_at", since).limit(1);
    if (!dup?.length) {
      await admin.from("bd_applications").insert({
        name, email, phone: str(body.phone, 40) || null, city: str(body.city, 120) || null,
        experience: str(body.experience, 3000) || null, why: str(body.why, 3000) || null,
        linkedin: str(body.linkedin, 300) || null, source,
      });
      await notify(`New BD consultant application: ${name}`, [
        `${name} (${email}) applied.`, body.city ? `City: ${str(body.city, 120)}` : "", "", "Review it in the CRM → Inbox.",
      ].filter(Boolean));
    }
    await recordEvent("submit_bd");
    return json({ ok: true });
  }

  if (type === "newsletter") {
    const email = str(body.email, 200).toLowerCase(), name = str(body.name, 120);
    if (!EMAIL.test(email)) return json({ error: "A valid email is required." }, 400);
    if (body.consent !== true) return json({ error: "Please agree to receive the newsletter." }, 400);

    const r = await subscribeNewsletter(email, name);
    if (!r.ok) return json({ error: "Couldn't save your sign-up. Please try again." }, 500);
    await recordEvent("submit_newsletter");
    // status: "pending" = check your email to confirm; "already" = you're already on the list.
    return json({ ok: true, status: r.status, code_sent: false });
  }

  // ---- Events: the /connect page asks what's open, and posts RSVPs ----------------------------
  // "current" = the next event that hasn't started yet, so the website never needs changing per event.
  const eventBySlug = (slug: string) => slug.toLowerCase() === "current"
    ? admin.from("events").select("*").eq("active", true).gt("starts_at", new Date().toISOString()).order("starts_at").limit(1).maybeSingle()
    : admin.from("events").select("*").eq("active", true).eq("slug", slug.toLowerCase()).maybeSingle();
  // Guests already holding a confirmed spot (waitlist and cancelled don't count), optionally ignoring one person.
  async function confirmedGuests(eventId: string, exceptEmail?: string) {
    const { data } = await admin.from("event_rsvps").select("guests, email").eq("event_id", eventId).eq("status", "confirmed");
    return (data ?? []).filter((r) => r.email !== exceptEmail).reduce((n, r) => n + r.guests, 0);
  }
  const rsvpClosed = (ev: { starts_at: string; ends_at: string | null; rsvp_closes_at: string | null }) =>
    Date.now() > Date.parse(ev.rsvp_closes_at ?? ev.ends_at ?? ev.starts_at);

  if (type === "event_info") {
    const { data: ev } = await eventBySlug(str(body.event, 40));
    if (!ev) return json({ open: false });
    const used = await confirmedGuests(ev.id);
    const spotsLeft = ev.capacity ? Math.max(0, ev.capacity - used) : null;
    const { date, time } = whenText(ev);
    return json({
      open: !rsvpClosed(ev), slug: ev.slug, name: ev.name, date_text: date, time_text: time, venue: ev.venue, address: ev.address,
      details: ev.details, spots_left: spotsLeft, full: spotsLeft === 0,
    });
  }

  if (type === "rsvp") {
    const name = str(body.name, 120), email = str(body.email, 200).toLowerCase();
    if (!name || !EMAIL.test(email)) return json({ error: "Your name and a valid email are required." }, 400);
    const { data: ev } = await eventBySlug(str(body.event, 40));
    if (!ev) return json({ error: "This event isn't taking RSVPs right now." }, 400);
    if (rsvpClosed(ev)) return json({ error: "RSVPs for this event are closed." }, 400);

    const guests = Math.min(6, Math.max(1, Math.floor(Number(body.guests)) || 1));
    const comingAs = COMING_AS.includes(str(body.coming_as, 40)) ? str(body.coming_as, 40) : null;
    const company = str(body.company, 160) || null;
    const { data: existing } = await admin.from("event_rsvps").select("*").eq("event_id", ev.id).eq("email", email).maybeSingle();

    const used = await confirmedGuests(ev.id, email);
    const fits = !ev.capacity || used + guests <= ev.capacity;
    // Someone already confirmed or checked in keeps their spot; a cancelled guest re-RSVPing is treated as new.
    const keep = existing && (existing.status === "attended" || (existing.status === "confirmed" && fits));
    const status = keep ? existing.status : fits ? "confirmed" : "waitlist";

    const row = {
      event_id: ev.id, name, email, company, guests, coming_as: comingAs, notes: str(body.notes, 1000) || null, source,
      influencer_id: await resolveInfluencer(source, ""), newsletter_opt_in: body.newsletter === true, status,
    };
    const { error: saveErr } = existing
      ? await admin.from("event_rsvps").update(row).eq("id", existing.id)
      : await admin.from("event_rsvps").insert(row);
    if (saveErr) return json({ error: "Couldn't save your RSVP. Please try again." }, 500);

    // Only email people the first time (or when their status changed), so a double-click doesn't send twice.
    if (!existing || existing.status !== status) {
      const first = name.split(" ")[0];
      const info: EventInfo = ev;
      const mail = renderEventEmail(status === "waitlist" ? "waitlist" : "confirmed", { firstName: first, ev: info, guests });
      await sendEmail(email, mail.subject, mail.text, "Lemo Wellness", mail.html,
        status === "confirmed" ? [{ filename: "lemo-event.ics", content: icsBase64(info) }] : undefined);
    }

    if (body.newsletter === true) await subscribeNewsletter(email, name);

    // A prospective partner is also a sales lead, so they show up in Web leads like any other inquiry.
    if (comingAs === "Prospective partner") {
      const since = new Date(Date.now() - 7 * 86400_000).toISOString();
      const { data: dup } = await admin.from("web_leads").select("id").eq("email", email).gte("created_at", since).limit(1);
      if (!dup?.length) {
        await admin.from("web_leads").insert({
          name, email, company, source, influencer_id: row.influencer_id,
          message: `RSVP'd to ${ev.name} (${guests} ${guests === 1 ? "guest" : "guests"}).`,
        });
      }
    }

    if (!existing) await notify(`New RSVP: ${name}`, [`${name} (${email}) RSVP'd to ${ev.name}: ${guests} ${guests === 1 ? "guest" : "guests"}${status === "waitlist" ? " (waitlist)" : ""}.`, comingAs ? `Coming as: ${comingAs}` : "", company ? `Company: ${company}` : "", "", "See the guest list in the CRM → Inbox → Events."].filter(Boolean));
    await recordEvent("submit_rsvp");
    const left = ev.capacity ? Math.max(0, ev.capacity - (await confirmedGuests(ev.id))) : null;
    return json({ ok: true, status, spots_left: left });
  }

  return json({ error: "Unknown type" }, 400);
});
