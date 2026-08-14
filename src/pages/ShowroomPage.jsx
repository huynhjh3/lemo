import React, { useState } from "react";
import { Calendar, CalendarPlus, Trash2 } from "lucide-react";
import { T } from "../theme.js";
import { Card, CardTitle } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const inputStyle = { background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody };

const fmtBookingDate = (iso) => new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const fmtBookingTime = (iso) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export default function ShowroomPage({ companies, showroomBookings, createShowroomBooking, deleteShowroomBooking }) {
  const { profile } = useAuth();
  const [deleteError, setDeleteError] = useState(null);
  const upcoming = showroomBookings.filter((b) => new Date(b.endAt) >= new Date());

  const remove = async (b) => {
    if (!window.confirm(`Cancel the showroom booking for ${fmtBookingDate(b.startAt)}, ${fmtBookingTime(b.startAt)}?`)) return;
    setDeleteError(null);
    try {
      await deleteShowroomBooking(b.id);
    } catch (err) {
      setDeleteError(err.message || "Couldn't cancel — try again.");
    }
  };

  return (
    <div>
      <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }} className="mb-5">Showroom</h1>
      <div className="flex flex-col gap-4">
        <BookSlotCard companies={companies} createShowroomBooking={createShowroomBooking} />
        <Card>
          <CardTitle icon={Calendar}>Upcoming Bookings</CardTitle>
          {deleteError && <p className="text-xs mb-3" style={{ color: T.red }}>{deleteError}</p>}
          {upcoming.length === 0 ? (
            <p className="text-xs" style={{ color: T.textFaint }}>No showroom bookings scheduled.</p>
          ) : (
            <div className="flex flex-col">
              {upcoming.map((b) => {
                const canCancel = b.bookedById === profile?.id || profile?.role === "owner";
                return (
                  <div key={b.id} className="flex items-center justify-between text-sm py-2.5" style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                    <div>
                      <div style={{ color: T.text }}>
                        {fmtBookingDate(b.startAt)} · <span style={{ fontFamily: T.fontMono }}>{fmtBookingTime(b.startAt)}–{fmtBookingTime(b.endAt)}</span>
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: T.textFaint }}>
                        {b.companyName || b.prospectName || "No company/prospect noted"} · booked by {b.bookedByName}
                        {b.notes && <> · {b.notes}</>}
                      </div>
                    </div>
                    {canCancel && (
                      <button onClick={() => remove(b)} style={{ color: T.red }} title="Cancel booking">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function BookSlotCard({ companies, createShowroomBooking }) {
  const [form, setForm] = useState({ date: "", startTime: "", endTime: "", companyId: "", prospectName: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const startAt = new Date(`${form.date}T${form.startTime}`);
      const endAt = new Date(`${form.date}T${form.endTime}`);
      if (endAt <= startAt) {
        setError("End time must be after start time.");
        return;
      }
      await createShowroomBooking({
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        company_id: form.companyId || null,
        prospect_name: form.prospectName.trim() || null,
        notes: form.notes.trim() || null,
      });
      setSuccess("Booked.");
      setForm({ date: "", startTime: "", endTime: "", companyId: "", prospectName: "", notes: "" });
    } catch (err) {
      setError(err.message || "Couldn't book that slot — try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardTitle icon={CalendarPlus}>Book a Chair Test</CardTitle>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-3">
          <input required type="date" value={form.date} onChange={set("date")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
          <input required type="time" value={form.startTime} onChange={set("startTime")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
          <input required type="time" value={form.endTime} onChange={set("endTime")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select value={form.companyId} onChange={set("companyId")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
            <option value="">Company (optional)</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input placeholder="Prospect name (if not a company yet)" value={form.prospectName} onChange={set("prospectName")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
        </div>
        <input placeholder="Notes (optional)" value={form.notes} onChange={set("notes")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
        {error && <p className="text-xs" style={{ color: T.red }}>{error}</p>}
        {success && <p className="text-xs" style={{ color: T.teal }}>{success}</p>}
        <button type="submit" disabled={saving} className="text-sm font-medium rounded-lg py-2.5" style={{ background: T.amber, color: T.bg, opacity: saving ? 0.7 : 1 }}>
          {saving ? "Booking…" : "Book slot"}
        </button>
      </form>
    </Card>
  );
}
