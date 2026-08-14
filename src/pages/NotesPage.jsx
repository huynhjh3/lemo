import React, { useState } from "react";
import { StickyNote, Trash2, User, MapPin, Building2, Megaphone, MessageSquare, ChevronDown, ChevronUp, Check } from "lucide-react";
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

// A note only carries an unread state at all if it's aimed at you
// specifically (person or region) or you're the author waiting on a
// reply — a company/general note has no "recipient" to be unread for.
function isUnreadForMe(n, profile) {
  const targetedAtMe =
    (n.targetUserId && n.targetUserId === profile?.id) ||
    (n.targetRegion && profile?.region && n.targetRegion === profile.region);
  if (targetedAtMe && !n.readAt) return true;
  if (n.authorId === profile?.id && n.comments.length > 0) {
    const last = n.comments[n.comments.length - 1];
    if (last.authorId !== profile?.id && (!n.readAt || new Date(n.readAt) < new Date(last.createdAt))) return true;
  }
  return false;
}

export default function NotesPage({ notes, profiles, companies, createNote, deleteNote, markNoteRead, createNoteComment, deleteNoteComment }) {
  const { profile } = useAuth();
  const isOwner = profile?.role === "owner";
  const canPostGeneral = profile?.role === "owner" || profile?.role === "geo_partner";
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(new Set());

  const remove = async (n) => {
    if (!window.confirm("Delete this note?")) return;
    setError(null);
    try {
      await deleteNote(n.id);
    } catch (err) {
      setError(err.message || "Couldn't delete — try again.");
    }
  };

  const toggleExpand = (n) => {
    const opening = !expanded.has(n.id);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(n.id)) next.delete(n.id);
      else next.add(n.id);
      return next;
    });
    if (opening && isUnreadForMe(n, profile)) markNoteRead(n.id).catch(() => {});
  };

  const markRead = (n) => {
    setError(null);
    markNoteRead(n.id).catch((err) => setError(err.message || "Couldn't mark as read."));
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
                const unread = isUnreadForMe(n, profile);
                const isExpanded = expanded.has(n.id);
                return (
                  <div
                    key={n.id} className="text-sm rounded-lg p-3" style={{ background: T.surface2, color: T.text, boxShadow: unread ? `inset 3px 0 0 ${T.amber}` : undefined }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full font-medium"
                          style={{ color: T.amber, border: `1px solid ${T.amber}55`, background: `${T.amber}14`, fontFamily: T.fontMono }}
                        >
                          <meta.icon size={11} /> {meta.label}
                        </span>
                        {unread && (
                          <span className="text-[11px] font-semibold" style={{ color: T.amber, fontFamily: T.fontMono }}>UNREAD</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {unread && (
                          <button onClick={() => markRead(n)} className="flex items-center gap-1 text-[11px]" style={{ color: T.textDim }}>
                            <Check size={12} /> Mark read
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => remove(n)} style={{ color: T.red }}><Trash2 size={12} /></button>
                        )}
                      </div>
                    </div>
                    <p>{n.body}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="text-[11px]" style={{ color: T.textFaint }}>{n.authorName} · {fmtDateTime(n.createdAt)}</div>
                      <button onClick={() => toggleExpand(n)} className="flex items-center gap-1 text-[11px]" style={{ color: T.textDim }}>
                        <MessageSquare size={11} />
                        {n.comments.length > 0 ? `${n.comments.length} repl${n.comments.length === 1 ? "y" : "ies"}` : "Reply"}
                        {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                    </div>
                    {isExpanded && (
                      <CommentThread note={n} profile={profile} isOwner={isOwner} createNoteComment={createNoteComment} deleteNoteComment={deleteNoteComment} />
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

function CommentThread({ note, profile, isOwner, createNoteComment, deleteNoteComment }) {
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createNoteComment({ note_id: note.id, body: body.trim() });
      setBody("");
    } catch (err) {
      setError(err.message || "Couldn't post reply — try again.");
    } finally {
      setSaving(false);
    }
  };

  const removeComment = async (c) => {
    if (!window.confirm("Delete this reply?")) return;
    try {
      await deleteNoteComment(c.id);
    } catch (err) {
      setError(err.message || "Couldn't delete — try again.");
    }
  };

  return (
    <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: `1px solid ${T.border}` }}>
      {note.comments.map((c) => (
        <div key={c.id} className="flex items-start justify-between gap-2 text-xs rounded-md px-2.5 py-2" style={{ background: T.surface }}>
          <div>
            <p style={{ color: T.text }}>{c.body}</p>
            <div className="text-[10px] mt-1" style={{ color: T.textFaint }}>{c.authorName} · {fmtDateTime(c.createdAt)}</div>
          </div>
          {(isOwner || c.authorId === profile?.id) && (
            <button onClick={() => removeComment(c)} style={{ color: T.red }} className="shrink-0"><Trash2 size={11} /></button>
          )}
        </div>
      ))}
      <form onSubmit={submit} className="flex gap-2">
        <input
          placeholder="Write a reply…" value={body} onChange={(e) => setBody(e.target.value)}
          className="flex-1 text-xs rounded-lg px-2.5 py-1.5 outline-none" style={inputStyle}
        />
        <button type="submit" disabled={saving || !body.trim()} className="text-xs font-medium rounded-lg px-3 py-1.5" style={{ background: T.amber, color: T.bg, opacity: saving || !body.trim() ? 0.6 : 1 }}>
          {saving ? "…" : "Reply"}
        </button>
      </form>
      {error && <p className="text-xs" style={{ color: T.red }}>{error}</p>}
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

  // A Consultant's person picker only ever shows Owners/Strategic Partners
  // — matches the notes_insert RLS policy's target_user_id restriction for
  // bd_consultant (migration 033). Everyone else keeps the prior behavior
  // (anyone but a Partner, and not yourself).
  const personOptions = profile?.role === "bd_consultant"
    ? profiles.filter((p) => p.role === "owner" || p.role === "geo_partner")
    : profiles.filter((p) => p.role !== "partner" && p.id !== profile?.id);

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
            {personOptions.map((p) => (
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
