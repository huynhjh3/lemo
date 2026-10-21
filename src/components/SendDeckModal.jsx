import React, { useState } from "react";
import { T } from "../theme.js";
import Modal from "./Modal.jsx";
import * as decksApi from "../lib/api/decks.js";

const inputStyle = { background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody };

function draftMessage(first, companyName, senderName) {
  return `${first ? `Hi ${first}` : "Hello"},\n\nI'm reaching out about bringing Lemo's smart massage chairs to ${companyName}. I've attached a short overview of how it works and what a partnership looks like.\n\nIf it's useful, I'm happy to walk you through it. What does your calendar look like this week?\n\nBest,\n${senderName}\nLemo | lemowellness.com`;
}

// Emails a generated deck as a .pptx attachment (send-deck Edge Function →
// Resend), then logs it as an Email entry on the company's Communications
// Log. "Send me a test" skips the logging.
export default function SendDeckModal({ deck, company, senderName, senderEmail, addCommunicationLogEntry, onClose, onSent }) {
  const contacts = (company?.contacts || []).filter((c) => c.email);
  const first = contacts.find((c) => c.primary) || contacts[0];
  const [contactId, setContactId] = useState(first?.id || "other");
  const [toEmail, setToEmail] = useState("");
  const [subject, setSubject] = useState(`Lemo × ${company?.name || deck.file_name}`);
  const [message, setMessage] = useState(draftMessage(first?.name?.split(" ")[0] || "", company?.name || "your team", senderName));
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  const chosen = contacts.find((c) => c.id === contactId);
  const to = (chosen ? chosen.email : toEmail).trim();

  const pickContact = (id) => {
    setContactId(id);
    const c = contacts.find((x) => x.id === id);
    if (c) setMessage((m) => (m.startsWith("Hi ") || m.startsWith("Hello") ? draftMessage(c.name.split(" ")[0], company.name, senderName) : m));
  };

  const send = async (test) => {
    setError(null);
    setBusy(test ? "Sending test…" : "Sending…");
    try {
      await decksApi.sendDeck({
        generatedDeckId: deck.id,
        to: test ? senderEmail : to,
        subject: test ? `[Test] ${subject}` : subject,
        message,
      });
      if (test) {
        setDone({ test: true, text: `Test sent to ${senderEmail}. Check your inbox.` });
      } else {
        const bits = [`Sent to ${to}`];
        try {
          await addCommunicationLogEntry(company.id, {
            occurred_at: new Date().toISOString(),
            contact_id: chosen ? chosen.id : null,
            contact_name: null,
            type: "email",
            notes: `Emailed deck "${deck.file_name}" — subject: ${subject}`,
            photo_urls: [],
          });
          bits.push("logged on the Communications Log");
        } catch (logErr) {
          bits.push(`but couldn't log it (${logErr.message || "permission"})`);
        }
        setDone({ test: false, text: bits.join(" · ") + "." });
        onSent?.();
      }
    } catch (e) {
      setError(e.message || "Couldn't send — try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal title="Email this deck" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="text-xs" style={{ color: T.textFaint }}>
          Attaches <span style={{ color: T.text }}>{deck.file_name}.pptx</span>. Sent from your Lemo address, replies come to you, and you're BCC'd a copy.
        </div>

        <label className="flex flex-col gap-1 text-xs" style={{ color: T.textFaint }}>
          To
          <select value={contactId} onChange={(e) => pickContact(e.target.value)} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.email}</option>)}
            <option value="other">Someone else…</option>
          </select>
        </label>
        {contactId === "other" && (
          <input type="email" placeholder="name@company.com" value={toEmail} onChange={(e) => setToEmail(e.target.value)} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
        )}

        <label className="flex flex-col gap-1 text-xs" style={{ color: T.textFaint }}>
          Subject
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: T.textFaint }}>
          Message
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={9} className="text-sm rounded-lg px-3 py-2 outline-none" style={{ ...inputStyle, resize: "vertical" }} />
        </label>

        {error && <p className="text-xs" style={{ color: T.red }}>{error}</p>}
        {done && <p className="text-xs" style={{ color: T.teal }}>{done.text}</p>}

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => send(false)}
            disabled={!!busy || !to || !subject.trim() || !message.trim() || (done && !done.test)}
            className="text-sm font-medium rounded-lg px-4 py-2"
            style={{ background: T.amber, color: T.bg, opacity: busy || !to || (done && !done.test) ? 0.5 : 1 }}
          >
            {busy && !busy.startsWith("Sending test") ? busy : "Send"}
          </button>
          <button onClick={() => send(true)} disabled={!!busy} className="text-xs" style={{ color: T.textDim }}>
            {busy && busy.startsWith("Sending test") ? busy : `Send a test to me (${senderEmail})`}
          </button>
          <button onClick={onClose} className="text-xs ml-auto" style={{ color: T.textFaint }}>{done && !done.test ? "Close" : "Cancel"}</button>
        </div>
      </div>
    </Modal>
  );
}
