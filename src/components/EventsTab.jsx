import React, { useCallback, useEffect, useMemo, useState } from "react";
import { T } from "../theme.js";
import * as api from "../lib/api/events.js";
import { slugify } from "../lib/influencerStats.js";

const inputStyle = { background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody };
const BLANK = { name: "", slug: "", starts: "", ends: "", venue: "", address: "", details: "", capacity: "", closes: "" };

// datetime-local inputs work in the viewer's own time zone; the database stores UTC.
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso); const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
const fmtWhen = (iso) => new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

const STATUS_COLOR = { confirmed: T.teal, attended: T.amber, waitlist: T.yellow, cancelled: T.textFaint };

function EventCard({ ev, rsvps, onEdit, onChanged, setError }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [confirmSend, setConfirmSend] = useState(false);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const guestsOf = (statuses) => rsvps.filter((r) => statuses.includes(r.status)).reduce((n, r) => n + r.guests, 0);
  const held = guestsOf(["confirmed", "attended"]);
  const counts = {
    rsvps: rsvps.filter((r) => r.status !== "cancelled").length, held, waitlist: guestsOf(["waitlist"]), attended: guestsOf(["attended"]),
  };
  const left = ev.capacity ? Math.max(0, ev.capacity - held) : null;
  const confirmedCount = rsvps.filter((r) => r.status === "confirmed" || r.status === "attended").length;

  const run = async (label, fn) => {
    setBusy(label); setError(null); setMsg(null);
    try { await fn(); await onChanged(); } catch (e) { setError(e.message || "Something went wrong."); } finally { setBusy(null); }
  };
  const copy = async (text, done) => {
    try { await navigator.clipboard.writeText(text); setMsg(done); setTimeout(() => setMsg(null), 2000); } catch { setError("Couldn't copy. Try again."); }
  };
  const csv = () => ["Name,Email,Company,Guests,Coming as,Status,Source,Notes",
    ...rsvps.map((r) => [r.name, r.email, r.company, r.guests, r.coming_as, r.status, r.source, r.notes].map(csvCell).join(","))].join("\n");

  return (
    <div className="rounded-lg p-3 flex flex-col gap-3" style={{ background: T.surface2, border: `1px solid ${T.borderSoft}`, opacity: ev.active ? 1 : 0.65 }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-medium" style={{ color: T.text }}>{ev.name}{!ev.active && <span className="ml-2 text-[10px] uppercase" style={{ color: T.red }}>closed</span>}</div>
          <div className="text-xs" style={{ color: T.textFaint }}>{fmtWhen(ev.starts_at)}{ev.venue ? ` · ${ev.venue}` : ""} · page code <span style={{ fontFamily: T.fontMono }}>{ev.slug}</span></div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <button onClick={() => onEdit(ev)} style={{ color: T.amber }}>Edit</button>
          <button onClick={() => setOpen((o) => !o)} style={{ color: T.textDim }}>{open ? "Hide guests" : "Guest list"}</button>
        </div>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))" }}>
        {[["RSVPs", counts.rsvps], ["Guests held", ev.capacity ? `${counts.held} / ${ev.capacity}` : counts.held], ["Spots left", left ?? "∞"], ["Waitlist", counts.waitlist], ["Attended", counts.attended]].map(([label, value]) => (
          <div key={label}><div style={{ fontFamily: T.fontMono, fontSize: 18, color: label === "Spots left" && left === 0 ? T.red : T.text }}>{value}</div><div className="text-[10px] uppercase tracking-wide" style={{ color: T.textFaint }}>{label}</div></div>
        ))}
      </div>

      {open && (
        <div className="flex flex-col gap-3 pt-2" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
          {rsvps.length === 0 && <p className="text-xs" style={{ color: T.textFaint }}>No RSVPs yet.</p>}
          {rsvps.map((r) => (
            <div key={r.id} className="grid items-center gap-2 text-xs" style={{ gridTemplateColumns: "minmax(0,1.6fr) 44px minmax(0,1fr) 84px auto" }}>
              <span className="truncate" style={{ color: T.text }} title={`${r.email}${r.notes ? ` · ${r.notes}` : ""}`}>{r.name}{r.company ? <span style={{ color: T.textFaint }}> · {r.company}</span> : null}<span className="block truncate" style={{ color: T.textFaint }}>{r.email}</span></span>
              <span style={{ fontFamily: T.fontMono, color: T.textDim }}>{r.guests}×</span>
              <span className="truncate" style={{ color: T.textFaint }}>{r.coming_as || "—"}{r.source ? ` · ${r.source}` : ""}</span>
              <span style={{ color: STATUS_COLOR[r.status], fontFamily: T.fontMono, textTransform: "uppercase", fontSize: 10 }}>{r.status}</span>
              <span className="flex items-center gap-2 justify-end">
                {r.status === "confirmed" && <button onClick={() => run("rsvp", () => api.updateRsvp(r.id, { status: "attended" }))} style={{ color: T.teal }}>Attended</button>}
                {r.status === "waitlist" && <button onClick={() => run("rsvp", () => api.updateRsvp(r.id, { status: "confirmed" }))} style={{ color: T.teal }}>Confirm</button>}
                {r.status === "attended" && <button onClick={() => run("rsvp", () => api.updateRsvp(r.id, { status: "confirmed" }))} style={{ color: T.textFaint }}>Undo</button>}
                {r.status === "cancelled" && <button onClick={() => run("rsvp", () => api.updateRsvp(r.id, { status: "confirmed" }))} style={{ color: T.textFaint }}>Reinstate</button>}
                {(r.status === "confirmed" || r.status === "waitlist") && <button onClick={() => run("rsvp", () => api.updateRsvp(r.id, { status: "cancelled" }))} style={{ color: T.textFaint }}>Cancel</button>}
                {r.status === "cancelled" && <button onClick={() => run("rsvp", () => api.deleteRsvp(r.id))} style={{ color: T.red }}>Delete</button>}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <button onClick={() => copy(csv(), "Guest list copied. Paste it into a spreadsheet.")} style={{ color: T.amber }}>Copy guest list</button>
            <button onClick={() => copy(`https://lemowellness.com/connect?src=event`, "Link copied.")} style={{ color: T.textDim }}>Copy event link</button>
            {msg && <span style={{ color: T.teal }}>{msg}</span>}
          </div>

          <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: T.surface, border: `1px solid ${T.borderSoft}` }}>
            <div className="text-[11px] uppercase tracking-wide" style={{ color: T.textFaint }}>Reminder email to confirmed guests</div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional note added to the reminder, e.g. “Parking is behind the building.”" className="text-sm rounded-lg px-3 py-2 outline-none" style={{ ...inputStyle, resize: "vertical" }} />
            <div className="flex items-center gap-3 flex-wrap text-xs">
              <button disabled={!!busy} onClick={() => run("test", async () => { const r = await api.sendReminder({ eventId: ev.id, note, test: true }); setMsg(`Test sent to ${r.sent_to}.`); })} className="px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${T.border}`, color: T.textDim }}>{busy === "test" ? "Sending…" : "Send a test to me"}</button>
              {!confirmSend ? (
                <button disabled={!!busy || confirmedCount === 0} onClick={() => setConfirmSend(true)} className="px-3 py-1.5 rounded-lg font-medium" style={{ border: `1px solid ${T.amber}`, color: T.amber, opacity: confirmedCount === 0 ? 0.5 : 1 }}>
                  {confirmedCount === 0 ? "No confirmed guests yet" : `Send reminder to ${rsvps.filter((r) => r.status === "confirmed").length} guests…`}
                </button>
              ) : (
                <span className="flex items-center gap-2" style={{ color: T.text }}>
                  Send the reminder now?
                  <button disabled={!!busy} onClick={() => run("send", async () => { const r = await api.sendReminder({ eventId: ev.id, note }); setConfirmSend(false); setMsg(`Reminder sent to ${r.sent} ${r.sent === 1 ? "guest" : "guests"}.${r.warning ? ` ${r.warning}` : ""}`); })} className="px-3 py-1.5 rounded-lg font-medium" style={{ background: T.red, color: "#fff" }}>{busy === "send" ? "Sending…" : "Yes, send"}</button>
                  <button onClick={() => setConfirmSend(false)} style={{ color: T.textFaint }}>Cancel</button>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <button onClick={() => run("active", () => api.saveEvent(ev.id, { active: !ev.active }))} style={{ color: T.textDim }}>{ev.active ? "Close RSVPs (hide from the page)" : "Reopen RSVPs"}</button>
            {rsvps.length === 0 && <button onClick={() => run("delete", () => api.deleteEvent(ev.id))} style={{ color: T.red }}>Delete event</button>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EventsTab() {
  const [events, setEvents] = useState([]);
  const [rsvps, setRsvps] = useState([]);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null); // null = not editing; otherwise the fields (+ id when editing)
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const [e, r] = await Promise.all([api.fetchEvents(), api.fetchRsvps()]); setEvents(e); setRsvps(r); } catch (err) { setError(err.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const byEvent = useMemo(() => {
    const m = new Map(); rsvps.forEach((r) => m.set(r.event_id, [...(m.get(r.event_id) || []), r])); return m;
  }, [rsvps]);

  const startEdit = (ev) => {
    setSlugTouched(true); setError(null);
    setForm({ id: ev.id, name: ev.name, slug: ev.slug, starts: toLocalInput(ev.starts_at), ends: toLocalInput(ev.ends_at), venue: ev.venue || "", address: ev.address || "", details: ev.details || "", capacity: ev.capacity ?? "", closes: toLocalInput(ev.rsvp_closes_at) });
  };
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const save = async () => {
    setBusy(true); setError(null);
    try {
      if (!form.name.trim()) throw new Error("Add the event's name.");
      if (!form.starts) throw new Error("Pick the date and time it starts.");
      const slug = slugify(form.slug || form.name);
      if (!slug) throw new Error("Add a page code (letters and numbers).");
      if (form.ends && new Date(form.ends) <= new Date(form.starts)) throw new Error("The end time must be after the start time.");
      await api.saveEvent(form.id, {
        name: form.name.trim(), slug, starts_at: fromLocalInput(form.starts), ends_at: fromLocalInput(form.ends),
        venue: form.venue.trim() || null, address: form.address.trim() || null, details: form.details.trim() || null,
        capacity: Number(form.capacity) > 0 ? Math.floor(Number(form.capacity)) : null, rsvp_closes_at: fromLocalInput(form.closes),
      });
      setForm(null); await load();
    } catch (e) { setError(e.message || "Couldn't save that event."); } finally { setBusy(false); }
  };

  const field = (label, node) => <label className="flex flex-col gap-1 text-[11px]" style={{ color: T.textFaint }}>{label}{node}</label>;
  const inp = (key, placeholder, type = "text", extra) => (
    <input type={type} value={form[key]} onChange={(e) => set({ [key]: e.target.value, ...(extra ? extra(e.target.value) : {}) })} placeholder={placeholder} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs" style={{ color: T.textFaint, maxWidth: 560 }}>
          Create an event, and the RSVP card on lemowellness.com/connect shows it while it’s open. Guests get a confirmation email with a calendar invite. When the event is full, new RSVPs go on the waitlist. You see the guest list here, check people in, and send reminders.
        </p>
        {!form && <button onClick={() => { setForm(BLANK); setSlugTouched(false); setError(null); }} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: T.amber, color: T.bg }}>New event</button>}
      </div>
      {error && <p className="text-sm" style={{ color: T.red }}>{error}</p>}

      {form && (
        <div className="rounded-lg p-3 flex flex-col gap-3" style={{ background: T.surface, border: `1px solid ${T.amber}55` }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {field("Event name", inp("name", "Lemo Recharge Night", "text", (v) => (slugTouched ? {} : { slug: slugify(v) })))}
            {field("Page code (used by the website)", (
              <input value={form.slug} onChange={(e) => { setSlugTouched(true); set({ slug: slugify(e.target.value) }); }} placeholder="recharge-night" className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {field("Starts", inp("starts", "", "datetime-local"))}
            {field("Ends (optional)", inp("ends", "", "datetime-local"))}
            {field("RSVPs close (blank = when it starts)", inp("closes", "", "datetime-local"))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {field("Venue", inp("venue", "Venue name"))}
            {field("Address", inp("address", "123 Main St, Irvine, CA"))}
            {field("Capacity (guests, blank = no limit)", inp("capacity", "60", "number"))}
          </div>
          {field("What to expect (shown on the page and in the emails)", (
            <textarea value={form.details} onChange={(e) => set({ details: e.target.value })} rows={3} placeholder="Try the chairs, meet the team, light bites." className="text-sm rounded-lg px-3 py-2 outline-none" style={{ ...inputStyle, resize: "vertical" }} />
          ))}
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: T.amber, color: T.bg, opacity: busy ? 0.5 : 1 }}>{busy ? "Saving…" : form.id ? "Save changes" : "Create event"}</button>
            <button onClick={() => setForm(null)} className="text-xs" style={{ color: T.textFaint }}>Cancel</button>
          </div>
        </div>
      )}

      {events.length === 0 && !form && <p className="text-sm" style={{ color: T.textFaint }}>No events yet. Click “New event” when your event is approved.</p>}
      {events.map((ev) => <EventCard key={ev.id} ev={ev} rsvps={byEvent.get(ev.id) || []} onEdit={startEdit} onChanged={load} setError={setError} />)}
    </div>
  );
}
