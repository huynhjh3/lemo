import React, { useEffect, useMemo, useState } from "react";
import { Presentation, Download, FileText, Upload, Trash2 } from "lucide-react";
import { T } from "../theme.js";
import { Card, CardTitle } from "../components/ui.jsx";
import { personalizePptx, deckFileBase } from "../lib/deckPersonalize.js";
import * as decksApi from "../lib/api/decks.js";

const KIND_LABEL = { revenue_share: "Revenue Share", corporate_wellness: "Corporate Wellness" };
const inputStyle = { background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody };
const fmtWhen = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function triggerDownload(url, fileName) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function DecksPage({ companies, profile }) {
  const isOwner = profile?.role === "owner";
  const [templates, setTemplates] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loadError, setLoadError] = useState(null);

  const [templateId, setTemplateId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [nameInDeck, setNameInDeck] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const [upload, setUpload] = useState({ name: "", kind: "revenue_share", placeholder: "{{COMPANY}}", file: null });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const sortedCompanies = useMemo(() => [...companies].sort((a, b) => a.name.localeCompare(b.name)), [companies]);
  const template = templates.find((t) => t.id === templateId);
  const company = companies.find((c) => c.id === companyId);

  const load = async () => {
    try {
      const [t, r] = await Promise.all([decksApi.fetchTemplates(), decksApi.fetchGeneratedDecks()]);
      setTemplates(t);
      setRecent(r);
      setLoadError(null);
      setTemplateId((cur) => cur || t[0]?.id || "");
    } catch (e) {
      setLoadError(e.message || "Couldn't load decks.");
    }
  };
  useEffect(() => { load(); }, []);

  const pickCompany = (id) => {
    setCompanyId(id);
    setNameInDeck(companies.find((c) => c.id === id)?.name || "");
    setResult(null);
  };

  const generate = async () => {
    setError(null);
    setResult(null);
    try {
      setBusy("Personalizing the deck…");
      const buffer = await decksApi.downloadTemplate(template.storage_path);
      const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      const { blob, replaced } = await personalizePptx(buffer, [
        [template.placeholder, nameInDeck.trim()],
        ["{{COMPANY}}", nameInDeck.trim()],
        ["{{DATE}}", today],
      ]);
      if (replaced === 0) {
        throw new Error(`Couldn't find "${template.placeholder}" anywhere in this deck, so nothing was personalized. Check the template's "text to replace".`);
      }
      const fileName = deckFileBase(nameInDeck, template.name);
      setBusy("Saving…");
      const saved = await decksApi.saveGeneratedDeck({ templateId: template.id, companyId: company.id, fileName, blob });
      const pptxUrl = URL.createObjectURL(blob);
      triggerDownload(pptxUrl, `${fileName}.pptx`);
      setResult({ fileName, pptxUrl, deckId: saved.id, pdf: "working", pdfUrl: null, pdfError: null });
      load();
      setBusy("Making the PDF…");
      try {
        const pdfPath = await decksApi.convertToPdf(saved.id);
        const pdfUrl = await decksApi.signedDownloadUrl(pdfPath, `${fileName}.pdf`);
        setResult((r) => ({ ...r, pdf: "ready", pdfUrl }));
        load();
      } catch (e) {
        setResult((r) => ({ ...r, pdf: "failed", pdfError: e.message }));
      }
    } catch (e) {
      setError(e.message || "Something went wrong — try again.");
    } finally {
      setBusy(null);
    }
  };

  const downloadFrom = async (path, fileName) => {
    try { triggerDownload(await decksApi.signedDownloadUrl(path, fileName), fileName); }
    catch (e) { setError(e.message || "Couldn't download that file."); }
  };
  const makePdf = async (deck) => {
    setError(null);
    setBusy(`Making the PDF for ${deck.file_name}…`);
    try { await decksApi.convertToPdf(deck.id); await load(); }
    catch (e) { setError(e.message); }
    finally { setBusy(null); }
  };

  const submitTemplate = async (e) => {
    e.preventDefault();
    setUploading(true);
    setUploadError(null);
    try {
      await decksApi.uploadTemplate(upload);
      setUpload({ name: "", kind: "revenue_share", placeholder: "{{COMPANY}}", file: null });
      e.target.reset();
      await load();
    } catch (err) {
      setUploadError(err.message || "Couldn't upload that template.");
    } finally {
      setUploading(false);
    }
  };
  const removeTemplate = async (t) => {
    if (!window.confirm(`Delete the template "${t.name}"? Decks already generated from it stay.`)) return;
    try { await decksApi.deleteTemplate(t); await load(); } catch (err) { setError(err.message); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }}>Decks</h1>
        <p className="text-sm" style={{ color: T.textDim }}>Pick a company and get the master deck back with its name in place — same design, renamed, as PowerPoint and PDF.</p>
      </div>

      {loadError && (
        <Card><p className="text-sm" style={{ color: T.red }}>Decks aren't set up yet — run migration 060 in the Supabase SQL editor. ({loadError})</p></Card>
      )}

      <Card>
        <CardTitle icon={Presentation}>Generate a deck</CardTitle>
        {templates.length === 0 ? (
          <p className="text-sm" style={{ color: T.textFaint }}>
            {isOwner ? "Upload a master deck below to get started." : "No master decks yet — an Owner needs to upload one."}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs" style={{ color: T.textFaint }}>
                Master deck
                <select value={templateId} onChange={(e) => { setTemplateId(e.target.value); setResult(null); }} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name} — {KIND_LABEL[t.kind]}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs" style={{ color: T.textFaint }}>
                Company
                <select value={companyId} onChange={(e) => pickCompany(e.target.value)} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
                  <option value="">Select a company…</option>
                  {sortedCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1 text-xs" style={{ color: T.textFaint }}>
              Name to use in the deck
              <input value={nameInDeck} onChange={(e) => setNameInDeck(e.target.value)} placeholder="Defaults to the company name — edit if the deck should say it differently" className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
            </label>
            {template && nameInDeck.trim() && (
              <p className="text-xs" style={{ color: T.textFaint }}>
                File: <span style={{ color: T.text }}>{deckFileBase(nameInDeck, template.name)}.pptx / .pdf</span>
              </p>
            )}
            {error && <p className="text-xs" style={{ color: T.red }}>{error}</p>}
            <button
              onClick={generate}
              disabled={!!busy || !template || !company || !nameInDeck.trim()}
              className="text-sm font-medium rounded-lg px-4 py-2 self-start"
              style={{ background: T.amber, color: T.bg, opacity: busy || !template || !company || !nameInDeck.trim() ? 0.5 : 1 }}
            >
              {busy || "Generate deck"}
            </button>

            {result && (
              <div className="rounded-lg p-3 flex flex-col gap-2 text-sm" style={{ background: T.surface2, border: `1px solid ${T.border}` }}>
                <span style={{ color: T.text }}>{result.fileName}</span>
                <div className="flex items-center gap-3 flex-wrap">
                  <button onClick={() => triggerDownload(result.pptxUrl, `${result.fileName}.pptx`)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ background: T.amber, color: T.bg }}>
                    <Download size={13} /> PowerPoint
                  </button>
                  {result.pdf === "ready" && (
                    <button onClick={() => triggerDownload(result.pdfUrl, `${result.fileName}.pdf`)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ background: T.amber, color: T.bg }}>
                      <Download size={13} /> PDF
                    </button>
                  )}
                  {result.pdf === "working" && <span className="text-xs" style={{ color: T.textFaint }}>Making the PDF…</span>}
                  {result.pdf === "failed" && <span className="text-xs" style={{ color: T.red }}>PDF not made: {result.pdfError}</span>}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <CardTitle icon={FileText}>Recent decks</CardTitle>
        {recent.length === 0 ? (
          <p className="text-xs" style={{ color: T.textFaint }}>Nothing generated yet.</p>
        ) : (
          <div className="flex flex-col">
            {recent.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 py-2.5 flex-wrap" style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                <div className="min-w-0">
                  <div className="text-sm truncate" style={{ color: T.text }}>{d.file_name}</div>
                  <div className="text-xs" style={{ color: T.textFaint }}>{d.creator?.name || "—"} · {fmtWhen(d.created_at)}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs">
                  <button onClick={() => downloadFrom(d.pptx_path, `${d.file_name}.pptx`)} className="px-2.5 py-1 rounded-lg" style={{ border: `1px solid ${T.border}`, color: T.text }}>PowerPoint</button>
                  {d.pdf_path
                    ? <button onClick={() => downloadFrom(d.pdf_path, `${d.file_name}.pdf`)} className="px-2.5 py-1 rounded-lg" style={{ border: `1px solid ${T.border}`, color: T.text }}>PDF</button>
                    : <button onClick={() => makePdf(d)} disabled={!!busy} className="px-2.5 py-1 rounded-lg" style={{ border: `1px dashed ${T.border}`, color: T.textDim }}>Make PDF</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {isOwner && (
        <Card>
          <CardTitle icon={Upload}>Master decks</CardTitle>
          {templates.length > 0 && (
            <div className="flex flex-col mb-4">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm" style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                  <div>
                    <span style={{ color: T.text }}>{t.name}</span>
                    <span className="text-xs ml-2" style={{ color: T.textFaint }}>{KIND_LABEL[t.kind]} · replaces <code>{t.placeholder}</code></span>
                  </div>
                  <button onClick={() => removeTemplate(t)} style={{ color: T.textFaint }} title="Delete template"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={submitTemplate} className="flex flex-col gap-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input required placeholder="Deck name, e.g. Revenue Share Interest Deck" value={upload.name} onChange={(e) => setUpload((u) => ({ ...u, name: e.target.value }))} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
              <select value={upload.kind} onChange={(e) => setUpload((u) => ({ ...u, kind: e.target.value }))} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
                {Object.entries(KIND_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>
            <input required placeholder="Text to replace with the company name" value={upload.placeholder} onChange={(e) => setUpload((u) => ({ ...u, placeholder: e.target.value }))} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
            <p className="text-[11px]" style={{ color: T.textFaint }}>
              In the master deck, type this text wherever the company name should go (for example <code>{"{{COMPANY}}"}</code>). It's swapped everywhere — every slide, the speaker notes, and the file name. <code>{"{{DATE}}"}</code> becomes today's date.
            </p>
            <input required type="file" accept=".pptx" onChange={(e) => setUpload((u) => ({ ...u, file: e.target.files?.[0] || null }))} className="text-xs" style={{ color: T.textDim }} />
            {uploadError && <p className="text-xs" style={{ color: T.red }}>{uploadError}</p>}
            <button type="submit" disabled={uploading || !upload.file} className="text-sm font-medium rounded-lg px-4 py-2 self-start" style={{ background: T.amber, color: T.bg, opacity: uploading || !upload.file ? 0.5 : 1 }}>
              {uploading ? "Uploading…" : "Upload master deck"}
            </button>
          </form>
        </Card>
      )}
    </div>
  );
}
