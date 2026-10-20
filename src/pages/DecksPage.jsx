import React, { useEffect, useMemo, useRef, useState } from "react";
import { Presentation, Download, FileText, Upload, Trash2, Image as ImageIcon } from "lucide-react";
import { T } from "../theme.js";
import { useAuth } from "../context/AuthContext.jsx";
import { Card, CardTitle } from "../components/ui.jsx";
import { personalizePptx, scanPptx, tokenPairs, deckFileBase } from "../lib/deckPersonalize.js";
import { compressImage, coverCropToJpeg } from "../lib/images.js";
import * as decksApi from "../lib/api/decks.js";

const KIND_LABEL = { revenue_share: "Revenue Share", corporate_wellness: "Corporate Wellness" };
const inputStyle = { background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody };
const fmtWhen = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const prettyKey = (k) => { const s = k.toLowerCase().replace(/_/g, " "); return s.charAt(0).toUpperCase() + s.slice(1); };

function triggerDownload(url, fileName) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// What the CRM already knows, offered as the starting value for any
// {{TOKEN}} in the deck of the same name. Anything else is typed in.
function standardValues(company, profile, email) {
  const primary = company?.contacts?.find((c) => c.primary) || company?.contacts?.[0];
  return {
    CITY: company?.city || "",
    INDUSTRY: company?.industry || "",
    CONTACT: primary?.name || "",
    CONTACT_FIRST: primary?.name?.split(" ")[0] || "",
    REP_NAME: profile?.name || "",
    REP_EMAIL: email || "",
    DATE: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
  };
}

export default function DecksPage({ companies, profile }) {
  const { session } = useAuth();
  const email = session?.user?.email || "";
  const isOwner = profile?.role === "owner";
  const [templates, setTemplates] = useState([]);
  const [recent, setRecent] = useState([]);
  const [images, setImages] = useState([]);
  const [imageUrls, setImageUrls] = useState({});
  const [loadError, setLoadError] = useState(null);

  const [templateId, setTemplateId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [nameInDeck, setNameInDeck] = useState("");
  const [scan, setScan] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [typed, setTyped] = useState({});
  const [swapChoice, setSwapChoice] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const bufferCache = useRef({});

  const [upload, setUpload] = useState({ name: "", kind: "revenue_share", placeholder: "{{COMPANY}}", file: null });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [imgUpload, setImgUpload] = useState({ name: "", file: null });
  const [imgUploading, setImgUploading] = useState(false);
  const [imgError, setImgError] = useState(null);

  const sortedCompanies = useMemo(() => [...companies].sort((a, b) => a.name.localeCompare(b.name)), [companies]);
  const template = templates.find((t) => t.id === templateId);
  const company = companies.find((c) => c.id === companyId);
  const standard = useMemo(() => standardValues(company, profile, email), [company, profile, email]);

  const valueOf = (key) => {
    if (key === "COMPANY") return nameInDeck.trim();
    return key in typed ? typed[key] : (standard[key] ?? "");
  };

  const load = async () => {
    try {
      const [t, r, imgs] = await Promise.all([decksApi.fetchTemplates(), decksApi.fetchGeneratedDecks(), decksApi.fetchDeckImages()]);
      setTemplates(t);
      setRecent(r);
      setImages(imgs);
      setLoadError(null);
      setTemplateId((cur) => cur || t[0]?.id || "");
    } catch (e) {
      setLoadError(e.message || "Couldn't load decks.");
    }
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const paths = images.map((i) => i.storage_path);
    if (!paths.length) { setImageUrls({}); return; }
    decksApi.signedImageUrls(paths).then(setImageUrls).catch(() => {});
  }, [images]);

  // Read the chosen master deck for the {{placeholders}} and picture slots it
  // asks for, so the form below matches that deck.
  useEffect(() => {
    if (!template) { setScan(null); return; }
    let cancelled = false;
    setScanning(true);
    setScan(null);
    setSwapChoice({});
    (async () => {
      try {
        if (!bufferCache.current[template.id]) bufferCache.current[template.id] = await decksApi.downloadTemplate(template.storage_path);
        const found = await scanPptx(bufferCache.current[template.id]);
        if (!cancelled) setScan(found);
      } catch (e) {
        if (!cancelled) setError(e.message || "Couldn't read that master deck.");
      } finally {
        if (!cancelled) setScanning(false);
      }
    })();
    return () => { cancelled = true; };
  }, [template?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickCompany = (id) => {
    setCompanyId(id);
    setNameInDeck(companies.find((c) => c.id === id)?.name || "");
    setTyped({});
    setResult(null);
  };

  const generate = async () => {
    setError(null);
    setResult(null);
    try {
      setBusy("Personalizing the deck…");
      const buffer = bufferCache.current[template.id] || await decksApi.downloadTemplate(template.storage_path);
      const name = nameInDeck.trim();
      const pairs = [[template.placeholder, name], ...scan.tokens.flatMap((t) => tokenPairs(t.found, valueOf(t.key)))];

      const swaps = [];
      for (const slot of scan.slots) {
        const image = images.find((i) => i.id === swapChoice[slot.key]);
        if (!image) continue;
        const original = await decksApi.downloadDeckImage(image.storage_path);
        const blob = await coverCropToJpeg(original, slot.widthEmu, slot.heightEmu);
        swaps.push({ slidePath: slot.slidePath, relId: slot.relId, blob });
      }

      const { blob, replaced } = await personalizePptx(buffer, pairs, swaps);
      if (replaced === 0 && swaps.length === 0) {
        throw new Error(`Couldn't find "${template.placeholder}" or any {{placeholders}} in this deck, so nothing was personalized.`);
      }
      const fileName = deckFileBase(name, template.name);
      setBusy("Saving…");
      const saved = await decksApi.saveGeneratedDeck({ templateId: template.id, companyId: company.id, fileName, blob });
      const pptxUrl = URL.createObjectURL(blob);
      triggerDownload(pptxUrl, `${fileName}.pptx`);
      setResult({ fileName, pptxUrl, deckId: saved.id });
      load();
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
    try { await decksApi.deleteTemplate(t); delete bufferCache.current[t.id]; await load(); } catch (err) { setError(err.message); }
  };

  const submitImage = async (e) => {
    e.preventDefault();
    setImgUploading(true);
    setImgError(null);
    try {
      const blob = await compressImage(imgUpload.file, { maxDim: 2400, quality: 0.88 });
      await decksApi.uploadDeckImage({ name: imgUpload.name.trim(), blob });
      setImgUpload({ name: "", file: null });
      e.target.reset();
      await load();
    } catch (err) {
      setImgError(err.message || "Couldn't upload that picture.");
    } finally {
      setImgUploading(false);
    }
  };
  const removeImage = async (img) => {
    if (!window.confirm(`Remove "${img.name}" from the picture library?`)) return;
    try { await decksApi.deleteDeckImage(img); await load(); } catch (err) { setImgError(err.message); }
  };

  const extraTokens = (scan?.tokens || []).filter((t) => t.key !== "COMPANY");
  const ready = !busy && template && company && nameInDeck.trim() && scan;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }}>Decks</h1>
        <p className="text-sm" style={{ color: T.textDim }}>Pick a company and get the master deck back personalized — names, details and pictures swapped in, same design, renamed.</p>
      </div>

      {loadError && (
        <Card><p className="text-sm" style={{ color: T.red }}>Decks aren't set up yet — run migrations 060 and 061 in the Supabase SQL editor. ({loadError})</p></Card>
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
              Company name in the deck
              <input value={nameInDeck} onChange={(e) => setNameInDeck(e.target.value)} placeholder="Defaults to the company name — edit if the deck should say it differently" className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
            </label>

            {scanning && <p className="text-xs" style={{ color: T.textFaint }}>Reading the master deck…</p>}

            {extraTokens.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-[11px] uppercase tracking-wide" style={{ color: T.textFaint }}>Details in this deck</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {extraTokens.map((t) => (
                    <label key={t.key} className="flex flex-col gap-1 text-xs" style={{ color: T.textFaint }}>
                      {prettyKey(t.key)}
                      <input
                        value={valueOf(t.key)}
                        onChange={(e) => setTyped((v) => ({ ...v, [t.key]: e.target.value }))}
                        placeholder={t.key in standard ? "From the CRM — leave blank to omit" : "Type it in — leave blank to omit"}
                        className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {scan?.slots.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-[11px] uppercase tracking-wide" style={{ color: T.textFaint }}>Pictures</div>
                {scan.slots.map((slot) => {
                  const chosen = images.find((i) => i.id === swapChoice[slot.key]);
                  return (
                    <div key={slot.key} className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm w-40 shrink-0" style={{ color: T.text }}>{slot.label} <span className="text-xs" style={{ color: T.textFaint }}>· slide {slot.slide}</span></span>
                      <select
                        value={swapChoice[slot.key] || ""}
                        onChange={(e) => setSwapChoice((s) => ({ ...s, [slot.key]: e.target.value }))}
                        className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}
                      >
                        <option value="">Keep the deck's picture</option>
                        {images.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                      {chosen && imageUrls[chosen.storage_path] && (
                        <img src={imageUrls[chosen.storage_path]} alt="" className="rounded-lg object-cover" style={{ width: 64, height: 40, border: `1px solid ${T.border}` }} />
                      )}
                    </div>
                  );
                })}
                {images.length === 0 && <p className="text-[11px]" style={{ color: T.textFaint }}>{isOwner ? "Add photos to the picture library below to choose from." : "No pictures in the library yet — an Owner can add some."}</p>}
              </div>
            )}

            {template && nameInDeck.trim() && (
              <p className="text-xs" style={{ color: T.textFaint }}>
                File: <span style={{ color: T.text }}>{deckFileBase(nameInDeck, template.name)}.pptx</span>
              </p>
            )}
            {error && <p className="text-xs" style={{ color: T.red }}>{error}</p>}
            <button
              onClick={generate}
              disabled={!ready}
              className="text-sm font-medium rounded-lg px-4 py-2 self-start"
              style={{ background: T.amber, color: T.bg, opacity: ready ? 1 : 0.5 }}
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
                    <span className="text-xs ml-2" style={{ color: T.textFaint }}>{KIND_LABEL[t.kind]}</span>
                  </div>
                  <button onClick={() => removeTemplate(t)} style={{ color: T.textFaint }} title="Delete template"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={submitTemplate} className="flex flex-col gap-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input required placeholder="Deck name, e.g. Corporate Wellness Interest Deck" value={upload.name} onChange={(e) => setUpload((u) => ({ ...u, name: e.target.value }))} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
              <select value={upload.kind} onChange={(e) => setUpload((u) => ({ ...u, kind: e.target.value }))} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
                {Object.entries(KIND_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>
            <p className="text-[11px]" style={{ color: T.textFaint }}>
              In the master deck, type <code>{"{{COMPANY}}"}</code>, <code>{"{{CITY}}"}</code>, <code>{"{{REP_NAME}}"}</code>, <code>{"{{REP_EMAIL}}"}</code>, <code>{"{{DATE}}"}</code> (or any name of your own) wherever those details go — the form above is built from whatever the deck contains. To make a picture swappable, set its alt text to <code>IMAGE: Some label</code>.
            </p>
            <input required type="file" accept=".pptx" onChange={(e) => setUpload((u) => ({ ...u, file: e.target.files?.[0] || null }))} className="text-xs" style={{ color: T.textDim }} />
            {uploadError && <p className="text-xs" style={{ color: T.red }}>{uploadError}</p>}
            <button type="submit" disabled={uploading || !upload.file} className="text-sm font-medium rounded-lg px-4 py-2 self-start" style={{ background: T.amber, color: T.bg, opacity: uploading || !upload.file ? 0.5 : 1 }}>
              {uploading ? "Uploading…" : "Upload master deck"}
            </button>
          </form>
        </Card>
      )}

      {isOwner && (
        <Card>
          <CardTitle icon={ImageIcon}>Picture library</CardTitle>
          {images.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {images.map((img) => (
                <div key={img.id} className="flex flex-col gap-1.5">
                  {imageUrls[img.storage_path]
                    ? <img src={imageUrls[img.storage_path]} alt="" className="w-full rounded-lg object-cover" style={{ height: 80, border: `1px solid ${T.border}` }} />
                    : <div className="w-full rounded-lg" style={{ height: 80, background: T.surface2, border: `1px solid ${T.border}` }} />}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate" style={{ color: T.text }}>{img.name}</span>
                    <button onClick={() => removeImage(img)} style={{ color: T.textFaint }} title="Remove"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={submitImage} className="flex flex-col gap-2">
            <input required placeholder="Name, e.g. Outdoor mall, Office, Casino" value={imgUpload.name} onChange={(e) => setImgUpload((u) => ({ ...u, name: e.target.value }))} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
            <input required type="file" accept="image/*" onChange={(e) => setImgUpload((u) => ({ ...u, file: e.target.files?.[0] || null }))} className="text-xs" style={{ color: T.textDim }} />
            <p className="text-[11px]" style={{ color: T.textFaint }}>Wide, high-resolution photos work best — each one is cropped to fit whichever slot it's placed in.</p>
            {imgError && <p className="text-xs" style={{ color: T.red }}>{imgError}</p>}
            <button type="submit" disabled={imgUploading || !imgUpload.file} className="text-sm font-medium rounded-lg px-4 py-2 self-start" style={{ background: T.amber, color: T.bg, opacity: imgUploading || !imgUpload.file ? 0.5 : 1 }}>
              {imgUploading ? "Uploading…" : "Add to library"}
            </button>
          </form>
        </Card>
      )}
    </div>
  );
}
