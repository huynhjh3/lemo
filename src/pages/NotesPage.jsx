import React, { useState } from "react";
import { StickyNote, Trash2, User, MapPin, Building2, Megaphone } from "lucide-react";
import { T } from "../theme.js";
import { Card, CardTitle } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const inputStyle = { background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody };

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function targetMeta(n) {
  if (n.targetUserId) return { label: `For ${n.targetUserName || "—"}`, icon: User };
  if (n.targetRegion) return { label: `Region: ${n.targetRegion}`, icon: MapPin };
  if (n.companyId) return { label: n.companyName || "Company", icon: Building2 };
  return { label: "General", icon: Megaphone };
}

export default function NotesPage({ notes, profiles, companies, createNote, deleteNote }) {
  const { profile } = useAuth();
  const isOwner = profile?.role === "owner";
  const canPostGeneral = profile?.role === "owner" || profile?.role === "geo_partner";
  const [error, setError] = useState(null);

  const remove = async (n) => {
    if (!window.confirm("Delete this note?")) return;
    setError(null);
    try {
      await deleteNote(n.id);
    } catch (err) {
      setError(err.message || "Couldn't delete — try again.");
    }
  };

  return (
    <div>
      <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }} className="mb-5">Notes</h1>

      <div className="flex flex-col gap-4">
        <CreateNoteCard profile={profile} canPostGeneral={canPostGeneral} profiles={profiles} companies={companies} createNote={createNote} />

        <Card>
          <CardTitle icon={StickyNote}>All Notes</CardTitle>
          {error && <p className="text-xs mb-3" style={{ color: T.red }}>{error}</p>}
          {notes.length === 0 ? (
            <p className="text-xs" style={{ color: T.textFaint }}>No notes yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {notes.map((n) => {
                const meta = targetMeta(n);
                const canDelete = isOwner || n.authorId === profile?.id;
                return (
                  <div key={n.id} className="text-sm rounded-lg p-3" style={{ background: T.surface2, color: T.text }}>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span
                        className="flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full font-medium"
                        style={{ color: T.amber, border: `1px solid ${T.amber}55`, background: `${T.amber}14`, fontFamily: T.fontMono }}
                      >
                        <meta.icon size={11} /> {meta.label}
                      </span>
                      {canDelete && (
                        <button onClick={() => remove(n)} style={{ color: T.red }} className="shrink-0"><Trash2 size={12} /></button>
                      )}
                    </div>
                    <p>{n.body}</p>
                    <div className="text-[11px] mt-1.5" style={{ color: T.textFaint }}>{n.authorName} · {fmtDateTime(n.createdAt)}</div>
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

function CreateNoteCard({ profile, canPostGeneral, profiles, companies, createNote }) {
  const [mode, setMode] = useState(canPostGeneral ? "general" : "person");
  const [targetUserId, setTargetUserId] = useState("");
  const [targetRegion, setTargetRegion] = useState(profile?.region || "");
  const [companyId, setCompanyId] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const modes = [
    ...(canPostGeneral ? [["general", "General", Megaphone]] : []),
    ["person", "Person", User],
    ["region", "Region", MapPin],
    ["company", "Company", Building2],
  ];

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await createNote({
        body: body.trim(),
        target_user_id: mode === "person" ? targetUserId || null : null,
        target_region: mode === "region" ? (targetRegion.trim() || null) : null,
        company_id: mode === "company" ? companyId || null : null,
      });
      setBody("");
      setTargetUserId("");
      setCompanyId("");
      setSuccess("Posted.");
    } catch (err) {
      setError(err.message || "Couldn't post — try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardTitle icon={StickyNote}>Post a Note</CardTitle>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex rounded-lg p-0.5 w-fit" style={{ background: T.surface2, border: `1px solid ${T.border}` }}>
          {modes.map(([id, label, Icon]) => (
            <button
              key={id} type="button" onClick={() => { setMode(id); setError(null); setSuccess(null); }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md"
              style={{
                background: mode === id ? T.surface : "transparent",
                color: mode === id ? T.amber : T.textDim,
                fontFamily: T.fontBody, fontWeight: mode === id ? 600 : 500,
              }}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>

        {mode === "person" && (
          <select required value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
            <option value="">Select a person</option>
            {profiles.filter((p) => p.role !== "partner" && p.id !== profile?.id).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        {mode === "region" && (
          <input
            required placeholder="Region (e.g. Dallas)" value={targetRegion}
            onChange={(e) => setTargetRegion(e.target.value)}
            disabled={profile?.role !== "owner"}
            className="text-sm rounded-lg px-3 py-2 outline-none" style={{ ...inputStyle, opacity: profile?.role !== "owner" ? 0.6 : 1 }}
          />
        )}
        {mode === "company" && (
          <select required value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
            <option value="">Select a company</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}

        <textarea required placeholder="Note…" value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="text-sm rounded-lg px-3 py-2 outline-none resize-none" style={inputStyle} />
        {error && <p className="text-xs" style={{ color: T.red }}>{error}</p>}
        {success && !error && <p className="text-xs" style={{ color: T.teal }}>{success}</p>}
        <button type="submit" disabled={saving} className="text-sm font-medium rounded-lg py-2.5 self-start px-5" style={{ background: T.amber, color: T.bg, opacity: saving ? 0.7 : 1 }}>
          {saving ? "Posting…" : "Post note"}
        </button>
      </form>
    </Card>
  );
}
