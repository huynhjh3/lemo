// Emails for event RSVPs, shared by landing-intake (confirmation / waitlist) and
// send-event-reminder (reminder). Pure functions; times are shown in Pacific time.

export type EventInfo = { id: string; name: string; starts_at: string; ends_at: string | null; venue: string | null; address: string | null; details: string | null };
const TZ = "America/Los_Angeles";
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const F = "font-family:'Poppins',Helvetica,Arial,sans-serif;";
const ADDRESS = "Lemo Inc. · 5151 California Ave, Irvine, CA 92617";

export function whenText(ev: Pick<EventInfo, "starts_at" | "ends_at">) {
  const s = new Date(ev.starts_at);
  const date = s.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: TZ });
  const t = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ });
  const time = ev.ends_at ? `${t(s)} – ${t(new Date(ev.ends_at))}` : t(s);
  return { date, time };
}

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// A calendar invite (.ics) as a base64 string, ready for an email attachment.
export function icsBase64(ev: EventInfo): string {
  const start = new Date(ev.starts_at);
  const end = ev.ends_at ? new Date(ev.ends_at) : new Date(start.getTime() + 2 * 3600_000);
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Lemo Wellness//RSVP//EN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${ev.id}@lemowellness.com`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(ev.name)}`,
    ...(ev.venue || ev.address ? [`LOCATION:${icsText([ev.venue, ev.address].filter(Boolean).join(", "))}`] : []),
    ...(ev.details ? [`DESCRIPTION:${icsText(ev.details)}`] : []),
    "END:VEVENT", "END:VCALENDAR",
  ];
  const bytes = new TextEncoder().encode(lines.join("\r\n"));
  let bin = ""; bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

type Kind = "confirmed" | "waitlist" | "reminder";
export function renderEventEmail(kind: Kind, o: { firstName?: string; ev: EventInfo; guests: number; note?: string }) {
  const { date, time } = whenText(o.ev);
  const where = [o.ev.venue, o.ev.address].filter(Boolean).join(" · ");
  const hi = o.firstName ? `Hi ${o.firstName}` : "Hi";
  const title = kind === "confirmed" ? `You’re in${o.firstName ? `, ${o.firstName}` : ""}!` : kind === "waitlist" ? "You’re on the waitlist" : `See you ${date.split(",")[0]}!`;
  const lead = kind === "confirmed"
    ? `Thanks for RSVPing. We’ve saved ${o.guests === 1 ? "your spot" : `${o.guests} spots`} at ${o.ev.name}.`
    : kind === "waitlist"
    ? `${o.ev.name} is full right now, so we’ve added you to the waitlist. If a spot opens we’ll email you right away.`
    : `A quick reminder that ${o.ev.name} is coming up. We’ve saved ${o.guests === 1 ? "your spot" : `${o.guests} spots`}.`;
  const tail = kind === "waitlist"
    ? "No need to do anything else."
    : "Can’t make it? Just reply to this email and we’ll free up your spot" + (o.guests > 1 ? "s" : "") + ".";
  const subject = kind === "confirmed" ? `You’re confirmed: ${o.ev.name}` : kind === "waitlist" ? `You’re on the waitlist: ${o.ev.name}` : `Reminder: ${o.ev.name}, ${date}`;
  const row = (label: string, value: string) => `<tr><td style="padding:6px 0;${F}font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#6B5F55;width:80px;vertical-align:top;">${label}</td><td style="padding:6px 0;${F}font-size:15px;font-weight:600;color:#1A1512;">${value}</td></tr>`;
  const html = `<!doctype html><html><body style="margin:0;background:#EFE7DE;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFE7DE;"><tr><td align="center" style="padding:22px 12px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#fff;border-radius:18px;overflow:hidden;">
<tr><td align="center" style="background:#FEF1E4;padding:28px 32px 22px;"><img src="https://lemocrm.lemowellness.com/lemo-logo.png" width="110" alt="Lemo" style="display:block;width:110px;height:auto;margin:0 auto;border:0;">
<p style="margin:18px 0 0;${F}font-size:26px;font-weight:800;color:#1A1512;line-height:1.15;">${esc(title)}</p></td></tr>
<tr><td style="padding:26px 36px 8px;${F}font-size:15px;line-height:1.65;color:#3A322C;">
<p style="margin:0 0 12px;">${esc(hi)},</p><p style="margin:0 0 18px;">${esc(lead)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#FEF1E4;border:2px dashed #E8601C;border-radius:14px;padding:14px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%">
${row("When", `${esc(date)}<br><span style="font-weight:400;">${esc(time)}</span>`)}${where ? row("Where", esc(where)) : ""}${kind !== "waitlist" ? row("Guests", String(o.guests)) : ""}
</table></td></tr></table>
${o.ev.details ? `<p style="margin:18px 0 0;">${esc(o.ev.details).replace(/\n/g, "<br>")}</p>` : ""}
${o.note?.trim() ? `<p style="margin:18px 0 0;padding:12px 16px;background:#FEF1E4;border-radius:12px;">${esc(o.note.trim()).replace(/\n/g, "<br>")}</p>` : ""}
${kind === "confirmed" ? `<p style="margin:18px 0 0;">A calendar invite is attached. Open it to add the event to your calendar.</p>` : ""}
<p style="margin:18px 0 6px;">${esc(tail)}</p></td></tr>
<tr><td align="center" style="background:#1A1512;padding:22px 32px;${F}font-size:11.5px;line-height:1.7;color:#BFB3A6;">${esc(ADDRESS)}<br><a href="https://lemowellness.com" style="color:#FF8A50;">lemowellness.com</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = [`${hi},`, "", lead, "", `When: ${date}, ${time}`, ...(where ? [`Where: ${where}`] : []), ...(kind !== "waitlist" ? [`Guests: ${o.guests}`] : []),
    ...(o.ev.details ? ["", o.ev.details] : []), ...(o.note?.trim() ? ["", o.note.trim()] : []), "", tail, "", ADDRESS].join("\n");
  return { subject, html, text };
}
