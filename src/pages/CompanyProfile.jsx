import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import {
  Building2, Users, MapPin, Clock, DollarSign, StickyNote, ArrowLeft,
  Mail, Phone, Pencil, Plus, Circle, CheckCircle2, ClipboardList, Trash2, Activity,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { T, STAGE_ORDER, STATUS_META, ACTIVITY_ICON, INDUSTRY_OPTIONS } from "../theme.js";
import { Card, CardTitle, StatusDot, DeviceStatus, StageBadge } from "../components/ui.jsx";
import { fmtMoney, fmtCount, fmtDate, fmtDealValue, isRevShare, TODAY } from "../lib/helpers.js";
import { useAuth } from "../context/AuthContext.jsx";

const inputStyle = { background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody };

function todayISO() {
  const y = TODAY.getFullYear(), m = String(TODAY.getMonth() + 1).padStart(2, "0"), d = String(TODAY.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Tasks' type options absorb Activity Timeline's former type dropdown
// (call/email/meeting/install/note) — 'system' stays audit-only.
const TASK_TYPES = Object.keys(ACTIVITY_ICON).filter((t) => t !== "system");

export default function CompanyProfile({
  company, back, tasks, profiles,
  updateCompany, deleteCompany,
  createContact, updateContact, deleteContact,
  createOutlet, createDevice, updateOutlet, deleteOutlet, updateDevice, deleteDevice,
  addNote, updateNote, deleteNote,
  deleteActivity,
  addRevenueEntry, createTask, completeTask, updateTask, deleteTask,
}) {
  const { profile } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const overviewCardRef = useRef(null);
  const refs = {
    overview: useRef(null), tasks: useRef(null), contacts: useRef(null), locations: useRef(null),
    activity: useRef(null), revenue: useRef(null), notes: useRef(null),
  };
  const scrollTo = (key) => refs[key].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const editCompany = () => {
    scrollTo("overview");
    overviewCardRef.current?.startEdit();
  };
  const sortedActivity = [...company.activity].sort((a, b) => new Date(b.date) - new Date(a.date));
  const companyTasks = tasks.filter((t) => t.companyId === company.id);

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${company.name}? This also removes its contacts, locations, devices, notes, and revenue history — this can't be undone.`)) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCompany(company.id);
      back();
    } catch (err) {
      setDeleteError(err.message || "Couldn't delete company — try again.");
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={back} className="flex items-center gap-1.5 text-xs" style={{ color: T.textDim }}>
          <ArrowLeft size={14} /> All companies
        </button>
        <div className="flex items-center gap-4">
          <button onClick={editCompany} className="flex items-center gap-1.5 text-xs" style={{ color: T.amber }}>
            <Pencil size={13} /> Edit company
          </button>
          <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-1.5 text-xs" style={{ color: T.red, opacity: deleting ? 0.6 : 1 }}>
            <Trash2 size={13} /> {deleting ? "Deleting…" : "Delete company"}
          </button>
        </div>
      </div>
      {deleteError && <p className="text-xs mb-4" style={{ color: T.red }}>{deleteError}</p>}

      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <StatusDot status={company.status} size={10} />
            <h1 style={{ fontFamily: T.fontDisplay, fontSize: 24, fontWeight: 600, color: T.text }}>
              {company.name}
            </h1>
            <StageBadge stage={company.stage} />
          </div>
          <div className="text-sm" style={{ color: T.textDim }}>
            {company.industry} · {company.city}{company.region ? ` · ${company.region}` : ""} · Rep: {company.rep}{company.code ? ` (${company.code})` : ""}
          </div>
        </div>
        <div className="text-right">
          <div style={{ fontFamily: T.fontMono, fontSize: 22, color: T.teal }}>{fmtDealValue(company)}</div>
          <div className="text-xs" style={{ color: T.textFaint }}>{isRevShare(company) ? "revenue share" : "deal value"}</div>
        </div>
      </div>

      <div
        className="flex gap-1 mb-5 px-1 py-1 rounded-lg sticky top-0 z-10 flex-wrap"
        style={{ background: T.surface, border: `1px solid ${T.border}` }}
      >
        {[
          ["overview", "Overview"], ["tasks", "Tasks"], ["contacts", "Contacts"], ["locations", "Locations & Devices"],
          ["activity", "Activity"], ["revenue", "Revenue"], ["notes", "Notes"],
        ].map(([key, label]) => (
          <button key={key} onClick={() => scrollTo(key)} className="text-xs px-3 py-1.5 rounded-md" style={{ color: T.textDim, fontFamily: T.fontBody }}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <OverviewCard ref={overviewCardRef} company={company} refEl={refs.overview} updateCompany={updateCompany} profiles={profiles} />
        <TasksCard company={company} refEl={refs.tasks} tasks={companyTasks} createTask={createTask} completeTask={completeTask} updateTask={updateTask} deleteTask={deleteTask} />
        <ContactsCard company={company} refEl={refs.contacts} createContact={createContact} updateContact={updateContact} deleteContact={deleteContact} />
        <LocationsCard
          company={company} refEl={refs.locations}
          createOutlet={createOutlet} createDevice={createDevice}
          updateOutlet={updateOutlet} deleteOutlet={deleteOutlet}
          updateDevice={updateDevice} deleteDevice={deleteDevice}
        />
        <ActivityCard company={company} refEl={refs.activity} sortedActivity={sortedActivity} deleteActivity={deleteActivity} />
        <RevenueCard company={company} refEl={refs.revenue} addRevenueEntry={addRevenueEntry} />
        <UsageCard company={company} />
        <NotesCard company={company} refEl={refs.notes} addNote={addNote} updateNote={updateNote} deleteNote={deleteNote} authorId={profile?.id} />
      </div>
    </div>
  );
}

/* ============== Overview (editable) ============== */
const OverviewCard = forwardRef(function OverviewCard({ company, refEl, updateCompany, profiles }, ref) {
  const { profile } = useAuth();
  const isOwner = profile?.role === "owner";
  const isGeoPartner = profile?.role === "geo_partner";
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const revShare = form?.deal_type === "revenue_share";

  const startEdit = () => {
    setForm({
      name: company.name, code: company.code || "",
      industry: company.industry || "", city: company.city || "", region: company.region || "", rep_id: company.repId || "",
      stage: company.stage, status: company.status,
      next_follow_up: company.nextFollowUp || "", interest: company.interest || "",
      deal_type: company.dealType || "enterprise", deal_value: company.dealValue,
    });
    setError(null);
    setEditing(true);
  };

  useImperativeHandle(ref, () => ({ startEdit }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateCompany(company.id, {
        name: form.name,
        code: form.code.trim() || null,
        industry: form.industry || null,
        city: form.city || null,
        region: form.region || null,
        rep_id: form.rep_id || null,
        stage: form.stage, status: form.status,
        next_follow_up: form.next_follow_up || null,
        interest: form.interest || null,
        deal_type: form.deal_type,
        deal_value: Number(form.deal_value) || 0,
      });
      setEditing(false);
    } catch (err) {
      setError(err.message || "Something went wrong — try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ scrollMarginTop: 70 }}>
      <div ref={refEl} />
      <CardTitle
        icon={Building2}
        right={!editing && (
          <button onClick={startEdit} style={{ color: T.textFaint }}><Pencil size={14} /></button>
        )}
      >
        Overview
      </CardTitle>
      {!editing ? (
        <>
          <p className="text-sm mb-4" style={{ color: T.text, lineHeight: 1.6 }}>{company.interest || "No context added yet."}</p>
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <div style={{ color: T.textFaint }}>Next follow-up</div>
              <div className="mt-1" style={{ color: T.text, fontFamily: T.fontMono }}>
                {company.nextFollowUp ? fmtDate(company.nextFollowUp) : "—"}
              </div>
            </div>
            <div>
              <div style={{ color: T.textFaint }}>Last contact</div>
              <div className="mt-1" style={{ color: T.text, fontFamily: T.fontMono }}>
                {company.lastContact ? fmtDate(company.lastContact) : "—"}
              </div>
            </div>
            <div>
              <div style={{ color: T.textFaint }}>In pipeline since</div>
              <div className="mt-1" style={{ color: T.text, fontFamily: T.fontMono }}>{fmtDate(company.createdDate)}</div>
            </div>
          </div>
        </>
      ) : (
        <form onSubmit={save} className="flex flex-col gap-3">
          <input required placeholder="Company name" value={form.name} onChange={set("name")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
          <div className={isOwner ? "grid grid-cols-3 gap-3" : "grid grid-cols-2 gap-3"}>
            <select value={form.industry} onChange={set("industry")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
              <option value="">Select industry</option>
              {INDUSTRY_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
            <input placeholder="City" value={form.city} onChange={set("city")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
            {isOwner && (
              <input placeholder="Code" value={form.code} onChange={set("code")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
            )}
          </div>
          <input
            placeholder="Region" value={form.region} onChange={set("region")} disabled={isGeoPartner}
            className="text-sm rounded-lg px-3 py-2 outline-none" style={{ ...inputStyle, opacity: isGeoPartner ? 0.6 : 1 }}
          />
          <select value={form.rep_id} onChange={set("rep_id")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
            <option value="">Unassigned rep</option>
            {profiles.filter((p) => p.role !== "partner").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <select value={form.stage} onChange={set("stage")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
              {STAGE_ORDER.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select value={form.status} onChange={set("status")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
              {Object.keys(STATUS_META).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select value={form.deal_type} onChange={set("deal_type")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
              <option value="enterprise">Enterprise</option>
              <option value="revenue_share">Revenue Share</option>
            </select>
            <input
              type="number" min="0" max={revShare ? 100 : undefined} step={revShare ? 0.1 : 1}
              placeholder={revShare ? "Our revenue share (%)" : "Monthly deal value ($)"}
              value={form.deal_value} onChange={set("deal_value")}
              className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}
            />
          </div>
          <input type="date" value={form.next_follow_up} onChange={set("next_follow_up")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
          <textarea value={form.interest} onChange={set("interest")} rows={3} className="text-sm rounded-lg px-3 py-2 outline-none resize-none" style={inputStyle} />
          {error && <p className="text-xs" style={{ color: T.red }}>{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="text-sm font-medium rounded-lg px-4 py-2" style={{ background: T.amber, color: T.bg, opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-sm rounded-lg px-4 py-2" style={{ color: T.textDim, border: `1px solid ${T.border}` }}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </Card>
  );
});

/* ============== Tasks ============== */
function TasksCard({ company, refEl, tasks, createTask, completeTask, updateTask, deleteTask }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", type: "call", due_date: todayISO() });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", type: "call", due_date: todayISO() });

  const submit = async (e) => {
    e.preventDefault();
    await createTask({ company_id: company.id, title: form.title, type: form.type, due_date: form.due_date });
    setForm({ title: "", type: "call", due_date: todayISO() });
    setAdding(false);
  };

  const startEdit = (t) => {
    setEditForm({ title: t.title, type: t.type, due_date: t.due });
    setEditingId(t.id);
  };
  const saveEdit = async (e, id) => {
    e.preventDefault();
    await updateTask(id, { title: editForm.title, type: editForm.type, due_date: editForm.due_date });
    setEditingId(null);
  };
  const remove = async (t) => {
    if (!window.confirm(`Delete task "${t.title}"?`)) return;
    await deleteTask(t.id);
  };

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  const renderTask = (t, doneStyle) => (
    editingId === t.id ? (
      <form key={t.id} onSubmit={(e) => saveEdit(e, t.id)} className="flex flex-col gap-2">
        <input required placeholder="Task title" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
        <div className="grid grid-cols-2 gap-2">
          <select value={editForm.type} onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
            {TASK_TYPES.map((t2) => <option key={t2}>{t2}</option>)}
          </select>
          <input type="date" required value={editForm.due_date} onChange={(e) => setEditForm((f) => ({ ...f, due_date: e.target.value }))} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="text-xs font-medium rounded-lg px-3 py-1.5" style={{ background: T.amber, color: T.bg }}>Save</button>
          <button type="button" onClick={() => setEditingId(null)} className="text-xs rounded-lg px-3 py-1.5" style={{ color: T.textDim, border: `1px solid ${T.border}` }}>Cancel</button>
        </div>
      </form>
    ) : (
      <div key={t.id} className="flex items-center gap-2" style={doneStyle}>
        <button onClick={() => completeTask(t.id, !t.done)}>
          {t.done ? <CheckCircle2 size={14} style={{ color: T.teal }} /> : <Circle size={14} style={{ color: T.textFaint }} />}
        </button>
        <span className="text-sm" style={{ color: T.text, textDecoration: t.done ? "line-through" : "none" }}>{t.title}</span>
        <span className="text-[11px] ml-auto" style={{ color: T.textFaint, fontFamily: T.fontMono }}>{fmtDate(t.due)}</span>
        <button onClick={() => startEdit(t)} style={{ color: T.textFaint }}><Pencil size={11} /></button>
        <button onClick={() => remove(t)} style={{ color: T.red }}><Trash2 size={11} /></button>
      </div>
    )
  );

  return (
    <Card style={{ scrollMarginTop: 70 }}>
      <div ref={refEl} />
      <CardTitle
        icon={ClipboardList}
        right={<button onClick={() => setAdding((a) => !a)} style={{ color: T.textFaint }}><Plus size={15} /></button>}
      >
        Tasks
      </CardTitle>
      {adding && (
        <form onSubmit={submit} className="flex flex-col gap-2 mb-3">
          <input required placeholder="Task title" value={form.title} onChange={set("title")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.type} onChange={set("type")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
              {TASK_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <input type="date" required value={form.due_date} onChange={set("due_date")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
          </div>
          <button type="submit" className="text-sm font-medium rounded-lg py-2" style={{ background: T.amber, color: T.bg }}>Add task</button>
        </form>
      )}
      {open.length === 0 && done.length === 0 ? (
        <p className="text-xs" style={{ color: T.textFaint }}>No tasks for this company yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {open.map((t) => renderTask(t))}
          {done.map((t) => renderTask(t, { opacity: 0.5 }))}
        </div>
      )}
    </Card>
  );
}

/* ============== Contacts ============== */
function ContactsCard({ company, refEl, createContact, updateContact, deleteContact }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", email: "", phone: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", role: "", email: "", phone: "" });

  const submit = async (e) => {
    e.preventDefault();
    await createContact(company.id, { name: form.name, role: form.role || null, email: form.email || null, phone: form.phone || null });
    setForm({ name: "", role: "", email: "", phone: "" });
    setAdding(false);
  };

  const startEdit = (p) => {
    setEditForm({ name: p.name, role: p.role || "", email: p.email || "", phone: p.phone || "" });
    setEditingId(p.id);
  };
  const saveEdit = async (e, id) => {
    e.preventDefault();
    await updateContact(id, { name: editForm.name, role: editForm.role || null, email: editForm.email || null, phone: editForm.phone || null });
    setEditingId(null);
  };
  const remove = async (p) => {
    if (!window.confirm(`Delete contact "${p.name}"?`)) return;
    await deleteContact(p.id);
  };

  return (
    <Card style={{ scrollMarginTop: 70 }}>
      <div ref={refEl} />
      <CardTitle
        icon={Users}
        right={<button onClick={() => setAdding((a) => !a)} style={{ color: T.textFaint }}><Plus size={15} /></button>}
      >
        Contacts
      </CardTitle>
      {adding && (
        <form onSubmit={submit} className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 gap-2">
            <input required placeholder="Name" value={form.name} onChange={set("name")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
            <input placeholder="Role" value={form.role} onChange={set("role")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Email" value={form.email} onChange={set("email")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
            <input placeholder="Phone" value={form.phone} onChange={set("phone")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
          </div>
          <button type="submit" className="text-sm font-medium rounded-lg py-2" style={{ background: T.amber, color: T.bg }}>Add contact</button>
        </form>
      )}
      {company.contacts.length === 0 ? (
        <p className="text-xs" style={{ color: T.textFaint }}>No contacts on file yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {company.contacts.map((p) => (
            <div key={p.id} className="rounded-lg p-3" style={{ background: T.surface2 }}>
              {editingId === p.id ? (
                <form onSubmit={(e) => saveEdit(e, p.id)} className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input required placeholder="Name" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
                    <input placeholder="Role" value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
                    <input placeholder="Phone" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="text-xs font-medium rounded-lg px-3 py-1.5" style={{ background: T.amber, color: T.bg }}>Save</button>
                    <button type="button" onClick={() => setEditingId(null)} className="text-xs rounded-lg px-3 py-1.5" style={{ color: T.textDim, border: `1px solid ${T.border}` }}>Cancel</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium truncate" style={{ color: T.text }}>{p.name}</span>
                      {p.primary && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ color: T.amber, background: `${T.amber}14` }}>Primary</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => startEdit(p)} style={{ color: T.textFaint }}><Pencil size={11} /></button>
                      <button onClick={() => remove(p)} style={{ color: T.red }}><Trash2 size={11} /></button>
                    </div>
                  </div>
                  <div className="text-xs mb-2" style={{ color: T.textFaint }}>{p.role}</div>
                  <div className="flex flex-col gap-1 text-xs" style={{ color: T.textDim }}>
                    {p.email && (
                      <a href={`mailto:${p.email}`} className="flex items-center gap-1.5 hover:underline">
                        <Mail size={11} /> {p.email}
                      </a>
                    )}
                    {p.phone && (
                      <a href={`tel:${p.phone}`} className="flex items-center gap-1.5 hover:underline">
                        <Phone size={11} /> {p.phone}
                      </a>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ============== Locations & Devices ============== */
function LocationsCard({ company, refEl, createOutlet, createDevice, updateOutlet, deleteOutlet, updateDevice, deleteDevice }) {
  const [addingOutlet, setAddingOutlet] = useState(false);
  const [outletForm, setOutletForm] = useState({ name: "", address: "" });
  const [deviceOutletId, setDeviceOutletId] = useState(null);
  const [deviceForm, setDeviceForm] = useState({ type: "", serial: "", status: "offline" });
  const [editingOutletId, setEditingOutletId] = useState(null);
  const [editOutletForm, setEditOutletForm] = useState({ name: "", address: "" });
  const [editingDeviceId, setEditingDeviceId] = useState(null);
  const [editDeviceForm, setEditDeviceForm] = useState({ type: "", serial: "", status: "offline" });

  const submitOutlet = async (e) => {
    e.preventDefault();
    await createOutlet(company.id, { name: outletForm.name, address: outletForm.address || null });
    setOutletForm({ name: "", address: "" });
    setAddingOutlet(false);
  };

  const submitDevice = async (e, outletId) => {
    e.preventDefault();
    await createDevice(outletId, { type: deviceForm.type, serial: deviceForm.serial || null, status: deviceForm.status });
    setDeviceForm({ type: "", serial: "", status: "offline" });
    setDeviceOutletId(null);
  };

  const startEditOutlet = (o) => {
    setEditOutletForm({ name: o.name, address: o.address || "" });
    setEditingOutletId(o.id);
  };
  const saveOutlet = async (e, outletId) => {
    e.preventDefault();
    await updateOutlet(outletId, { name: editOutletForm.name, address: editOutletForm.address || null });
    setEditingOutletId(null);
  };
  const removeOutlet = async (o) => {
    if (!window.confirm(`Delete outlet "${o.name}" and its devices? This can't be undone.`)) return;
    await deleteOutlet(o.id);
  };

  const startEditDevice = (d) => {
    setEditDeviceForm({ type: d.type, serial: d.serial || "", status: d.status });
    setEditingDeviceId(d.id);
  };
  const saveDevice = async (e, deviceId) => {
    e.preventDefault();
    await updateDevice(deviceId, { type: editDeviceForm.type, serial: editDeviceForm.serial || null, status: editDeviceForm.status });
    setEditingDeviceId(null);
  };
  const removeDevice = async (d) => {
    if (!window.confirm(`Delete device "${d.type}"? This can't be undone.`)) return;
    await deleteDevice(d.id);
  };

  return (
    <Card style={{ scrollMarginTop: 70 }}>
      <div ref={refEl} />
      <CardTitle
        icon={MapPin}
        right={<button onClick={() => setAddingOutlet((a) => !a)} style={{ color: T.textFaint }}><Plus size={15} /></button>}
      >
        Locations & Devices
      </CardTitle>
      {addingOutlet && (
        <form onSubmit={submitOutlet} className="flex flex-col gap-2 mb-3">
          <input required placeholder="Outlet name" value={outletForm.name} onChange={(e) => setOutletForm((f) => ({ ...f, name: e.target.value }))} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
          <input placeholder="Address" value={outletForm.address} onChange={(e) => setOutletForm((f) => ({ ...f, address: e.target.value }))} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
          <button type="submit" className="text-sm font-medium rounded-lg py-2" style={{ background: T.amber, color: T.bg }}>Add outlet</button>
        </form>
      )}
      {company.outlets.length === 0 ? (
        <p className="text-xs" style={{ color: T.textFaint }}>No outlets on file yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {company.outlets.map((o) => (
            <div key={o.id} className="rounded-lg p-3" style={{ background: T.surface2 }}>
              {editingOutletId === o.id ? (
                <form onSubmit={(e) => saveOutlet(e, o.id)} className="flex flex-col gap-2 mb-2">
                  <input required placeholder="Outlet name" value={editOutletForm.name} onChange={(e) => setEditOutletForm((f) => ({ ...f, name: e.target.value }))} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
                  <input placeholder="Address" value={editOutletForm.address} onChange={(e) => setEditOutletForm((f) => ({ ...f, address: e.target.value }))} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
                  <div className="flex gap-2">
                    <button type="submit" className="text-xs font-medium rounded-lg px-3 py-1.5" style={{ background: T.amber, color: T.bg }}>Save</button>
                    <button type="button" onClick={() => setEditingOutletId(null)} className="text-xs rounded-lg px-3 py-1.5" style={{ color: T.textDim, border: `1px solid ${T.border}` }}>Cancel</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="text-sm font-medium" style={{ color: T.text }}>{o.name}</div>
                    <div className="flex items-center gap-2.5">
                      <button onClick={() => startEditOutlet(o)} style={{ color: T.textFaint }}><Pencil size={12} /></button>
                      <button onClick={() => removeOutlet(o)} style={{ color: T.red }}><Trash2 size={12} /></button>
                      <button onClick={() => setDeviceOutletId(deviceOutletId === o.id ? null : o.id)} style={{ color: T.textFaint }}><Plus size={13} /></button>
                    </div>
                  </div>
                  <div className="text-xs mb-2" style={{ color: T.textFaint }}>{o.address}</div>
                </>
              )}
              {deviceOutletId === o.id && (
                <form onSubmit={(e) => submitDevice(e, o.id)} className="flex flex-col gap-2 mb-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input required placeholder="Device type" value={deviceForm.type} onChange={(e) => setDeviceForm((f) => ({ ...f, type: e.target.value }))} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
                    <input placeholder="Serial" value={deviceForm.serial} onChange={(e) => setDeviceForm((f) => ({ ...f, serial: e.target.value }))} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
                  </div>
                  <select value={deviceForm.status} onChange={(e) => setDeviceForm((f) => ({ ...f, status: e.target.value }))} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
                    <option value="offline">offline</option>
                    <option value="online">online</option>
                  </select>
                  <button type="submit" className="text-sm font-medium rounded-lg py-2" style={{ background: T.amber, color: T.bg }}>Add device</button>
                </form>
              )}
              {o.devices.length === 0 ? (
                <div className="text-xs" style={{ color: T.textFaint }}>No devices installed yet.</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {o.devices.map((d) => (
                    editingDeviceId === d.id ? (
                      <form key={d.id} onSubmit={(e) => saveDevice(e, d.id)} className="flex flex-col gap-2 py-2" style={{ borderTop: `1px solid ${T.border}` }}>
                        <div className="grid grid-cols-2 gap-2">
                          <input required placeholder="Device type" value={editDeviceForm.type} onChange={(e) => setEditDeviceForm((f) => ({ ...f, type: e.target.value }))} className="text-xs rounded-lg px-2 py-1.5 outline-none" style={inputStyle} />
                          <input placeholder="Serial" value={editDeviceForm.serial} onChange={(e) => setEditDeviceForm((f) => ({ ...f, serial: e.target.value }))} className="text-xs rounded-lg px-2 py-1.5 outline-none" style={inputStyle} />
                        </div>
                        <select value={editDeviceForm.status} onChange={(e) => setEditDeviceForm((f) => ({ ...f, status: e.target.value }))} className="text-xs rounded-lg px-2 py-1.5 outline-none" style={inputStyle}>
                          <option value="offline">offline</option>
                          <option value="online">online</option>
                        </select>
                        <div className="flex gap-2">
                          <button type="submit" className="text-xs font-medium rounded-lg px-3 py-1" style={{ background: T.amber, color: T.bg }}>Save</button>
                          <button type="button" onClick={() => setEditingDeviceId(null)} className="text-xs rounded-lg px-3 py-1" style={{ color: T.textDim, border: `1px solid ${T.border}` }}>Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <div key={d.id} className="flex items-center justify-between text-xs py-1" style={{ borderTop: `1px solid ${T.border}`, color: T.textDim }}>
                        <span>{d.type} <span style={{ color: T.textFaint, fontFamily: T.fontMono }}>· {d.serial}</span></span>
                        <div className="flex items-center gap-2">
                          <DeviceStatus status={d.status} />
                          <button onClick={() => startEditDevice(d)} style={{ color: T.textFaint }}><Pencil size={11} /></button>
                          <button onClick={() => removeDevice(d)} style={{ color: T.red }}><Trash2 size={11} /></button>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ============== Activity ============== */
// Read-only feed of system-generated audit entries (see log_activity_audit()
// in schema.sql) — no manual logging or editing. Log a call/email/meeting/
// install via Tasks instead. Delete is still available for any pre-existing
// manual ('note'-type) entries from before this became read-only.
function ActivityCard({ company, refEl, sortedActivity, deleteActivity }) {
  const remove = async (a) => {
    if (!window.confirm("Delete this activity entry?")) return;
    await deleteActivity(a.id);
  };

  return (
    <Card style={{ scrollMarginTop: 70 }}>
      <div ref={refEl} />
      <CardTitle icon={Clock}>Activity Timeline</CardTitle>
      {sortedActivity.length === 0 ? (
        <p className="text-xs" style={{ color: T.textFaint }}>No activity logged yet.</p>
      ) : (
        <div className="flex flex-col">
          {sortedActivity.map((a, i) => {
            const Icon = ACTIVITY_ICON[a.type] || StickyNote;
            const deletable = a.type !== "system";
            return (
              <div key={a.id} className="flex gap-3 pb-4 relative">
                {i < sortedActivity.length - 1 && (
                  <div className="absolute left-[9px] top-6 bottom-0 w-px" style={{ background: T.border }} />
                )}
                <div
                  className="rounded-full flex items-center justify-center shrink-0 z-10"
                  style={{ width: 20, height: 20, background: T.surface2, border: `1px solid ${T.border}` }}
                >
                  <Icon size={11} style={{ color: T.amber }} />
                </div>
                <div className="flex-1 flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs" style={{ color: T.textFaint, fontFamily: T.fontMono }}>
                      {fmtDate(a.date)} · {a.user}
                    </div>
                    <div className="text-sm mt-0.5" style={{ color: T.text }}>{a.summary}</div>
                  </div>
                  {deletable && (
                    <button onClick={() => remove(a)} style={{ color: T.red }} className="shrink-0"><Trash2 size={11} /></button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ============== Revenue ============== */
function RevenueCard({ company, refEl, addRevenueEntry }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ month: todayISO().slice(0, 7), amount: "" });

  const submit = async (e) => {
    e.preventDefault();
    await addRevenueEntry(company.id, `${form.month}-01`, Number(form.amount) || 0);
    setForm({ month: todayISO().slice(0, 7), amount: "" });
    setAdding(false);
  };

  return (
    <Card style={{ scrollMarginTop: 70 }}>
      <div ref={refEl} />
      <CardTitle
        icon={DollarSign}
        right={<button onClick={() => setAdding((a) => !a)} style={{ color: T.textFaint }}><Plus size={15} /></button>}
      >
        Revenue
      </CardTitle>
      {isRevShare(company) && (
        <p className="text-xs mb-3" style={{ color: T.textFaint }}>
          Computed from CSV uploads — a manual entry for this month may be overwritten by the next upload.
        </p>
      )}
      {adding && (
        <form onSubmit={submit} className="flex flex-col gap-2 mb-4">
          <div className="grid grid-cols-2 gap-2">
            <input type="month" required value={form.month} onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
            <input type="number" min="0" required placeholder="Amount" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
          </div>
          <button type="submit" className="text-sm font-medium rounded-lg py-2" style={{ background: T.amber, color: T.bg }}>Save entry</button>
        </form>
      )}
      <div style={{ height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={company.revenueHistory}>
            <CartesianGrid vertical={false} stroke={T.borderSoft} />
            <XAxis dataKey="month" tick={{ fill: T.textFaint, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} />
            <YAxis tick={{ fill: T.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
            <Tooltip contentStyle={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: T.text }} formatter={(v) => fmtMoney(v)} />
            <Bar dataKey="value" fill={T.teal} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ============== Usage ============== */
// Usage = completed orders, not a dollar figure. Presentation-only bucketing
// (not shared elsewhere) — groups daily order counts into Monday-start
// weekly totals for the week-over-week view.
function groupByWeek(daily) {
  const buckets = new Map();
  daily.forEach(({ date, orders }) => {
    const d = new Date(date + "T00:00:00");
    const diffToMonday = (d.getDay() + 6) % 7;
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - diffToMonday);
    const key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
    buckets.set(key, (buckets.get(key) || 0) + orders);
  });
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, value]) => ({ label: fmtDate(weekStart), value }));
}

function UsageCard({ company }) {
  const [view, setView] = useState("day");
  const daily = company.usageDaily;
  const data = view === "day"
    ? daily.slice(-30).map((r) => ({ label: fmtDate(r.date), value: r.orders }))
    : groupByWeek(daily).slice(-12);

  return (
    <Card>
      <CardTitle
        icon={Activity}
        right={
          <div className="flex rounded-lg p-0.5" style={{ background: T.surface2, border: `1px solid ${T.border}` }}>
            {[["day", "Day to day"], ["week", "Week over week"]].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className="text-xs px-2.5 py-1 rounded-md"
                style={{
                  background: view === id ? T.surface : "transparent",
                  color: view === id ? T.amber : T.textDim,
                  fontFamily: T.fontBody, fontWeight: view === id ? 600 : 500,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        Usage
      </CardTitle>
      {daily.length === 0 ? (
        <p className="text-xs" style={{ color: T.textFaint }}>No usage recorded yet.</p>
      ) : (
        <div style={{ height: 140 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid vertical={false} stroke={T.borderSoft} />
              <XAxis dataKey="label" tick={{ fill: T.textFaint, fontSize: 10 }} axisLine={{ stroke: T.border }} tickLine={false} />
              <YAxis tick={{ fill: T.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: T.text }} formatter={(v) => `${fmtCount(v)} orders`} />
              <Bar dataKey="value" fill={T.amber} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

/* ============== Notes ============== */
function NotesCard({ company, refEl, addNote, updateNote, deleteNote, authorId }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    await addNote(company.id, authorId, text.trim());
    setText("");
    setSaving(false);
  };

  const startEdit = (n) => {
    setEditText(n.text);
    setEditingId(n.id);
  };
  const saveEdit = async (e, id) => {
    e.preventDefault();
    if (!editText.trim()) return;
    await updateNote(id, editText.trim());
    setEditingId(null);
  };
  const remove = async (n) => {
    if (!window.confirm("Delete this note?")) return;
    await deleteNote(n.id);
  };

  return (
    <Card style={{ scrollMarginTop: 70 }}>
      <div ref={refEl} />
      <CardTitle icon={StickyNote}>Notes</CardTitle>
      <form onSubmit={submit} className="flex flex-col gap-2 mb-4">
        <textarea placeholder="Add a note…" value={text} onChange={(e) => setText(e.target.value)} rows={2} className="text-sm rounded-lg px-3 py-2 outline-none resize-none" style={inputStyle} />
        <button type="submit" disabled={saving} className="text-sm font-medium rounded-lg py-2 self-start px-4" style={{ background: T.amber, color: T.bg, opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving…" : "Add note"}
        </button>
      </form>
      {company.notes.length === 0 ? (
        <p className="text-xs" style={{ color: T.textFaint }}>No notes yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {company.notes.map((n) => (
            <div key={n.id} className="text-sm rounded-lg p-3" style={{ background: T.surface2, color: T.text }}>
              {editingId === n.id ? (
                <form onSubmit={(e) => saveEdit(e, n.id)} className="flex flex-col gap-2">
                  <textarea required value={editText} onChange={(e) => setEditText(e.target.value)} rows={2} className="text-sm rounded-lg px-3 py-2 outline-none resize-none" style={inputStyle} />
                  <div className="flex gap-2">
                    <button type="submit" className="text-xs font-medium rounded-lg px-3 py-1.5" style={{ background: T.amber, color: T.bg }}>Save</button>
                    <button type="button" onClick={() => setEditingId(null)} className="text-xs rounded-lg px-3 py-1.5" style={{ color: T.textDim, border: `1px solid ${T.border}` }}>Cancel</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <span>{n.text}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => startEdit(n)} style={{ color: T.textFaint }}><Pencil size={11} /></button>
                      <button onClick={() => remove(n)} style={{ color: T.red }}><Trash2 size={11} /></button>
                    </div>
                  </div>
                  <div className="text-[11px] mt-1.5" style={{ color: T.textFaint }}>{n.author} · {fmtDate(n.date)}</div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
