import React, { useMemo, useRef, useState } from "react";
import { UploadCloud, Download } from "lucide-react";
import { T } from "../theme.js";
import Modal from "./Modal.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { insertCompaniesBulk, insertContactsBulk } from "../lib/api/companies.js";
import { readTable, analyze, companyFields, contactFields, nameKey, REQUIRED, MAX_ROWS, TEMPLATE_CSV } from "../lib/importCompanies.js";

const CHUNK = 100;
const btn = "text-sm font-medium rounded-lg py-2.5";

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = "company-import-template.csv";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// Bulk-add companies from a spreadsheet. Needs the columns Company name, Email, Region and
// Industry; each row becomes a Lead (and a primary contact when it has an email), exactly as
// if it had been added with New Company.
export default function ImportCompaniesModal({ companies, onClose, onDone }) {
  const { profile } = useAuth();
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState(null); // { headers, rows }
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState(null);
  const [showSkipped, setShowSkipped] = useState(false);

  const check = useMemo(
    () => (parsed ? analyze(parsed.headers, parsed.rows, { role: profile?.role, region: profile?.region, companies }) : null),
    [parsed, profile?.role, profile?.region, companies],
  );

  const choose = async (file) => {
    setError(null); setParsed(null); setResult(null); setShowSkipped(false);
    if (!file) return;
    setFileName(file.name);
    try { setParsed(await readTable(file)); } catch (e) { setError(e.message || "Couldn't read that file."); }
  };

  const run = async () => {
    setBusy(true); setError(null);
    const rows = check.ready;
    let companiesAdded = 0, contactsAdded = 0, contactProblem = null;
    try {
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        setProgress(`Adding ${Math.min(i + CHUNK, rows.length)} of ${rows.length}…`);
        const created = await insertCompaniesBulk(chunk.map(companyFields));
        companiesAdded += created.length;
        const byKey = new Map(created.map((c) => [nameKey(c.name), c.id]));
        const contacts = chunk.filter((r) => r.email && byKey.has(nameKey(r.name))).map((r) => ({ company_id: byKey.get(nameKey(r.name)), ...contactFields(r) }));
        if (contacts.length) {
          try { await insertContactsBulk(contacts); contactsAdded += contacts.length; } catch (e) { contactProblem = e.message || "contacts couldn't be saved"; }
        }
      }
    } catch (e) {
      setError(`${companiesAdded ? `${companiesAdded} companies were added before it stopped. ` : ""}${e.message || "Something went wrong."}`);
    }
    setBusy(false); setProgress("");
    if (companiesAdded) { setResult({ companiesAdded, contactsAdded, contactProblem, skipped: check.skipped }); onDone?.(); }
  };

  const notes = check?.notes;
  const unknown = notes?.unknownIndustry ? [...notes.unknownIndustry.entries()] : [];

  return (
    <Modal title="Import companies" onClose={onClose}>
      {result ? (
        <div className="flex flex-col gap-3 text-sm" style={{ color: T.text }}>
          <p>Added <b>{result.companiesAdded}</b> {result.companiesAdded === 1 ? "company" : "companies"} as Leads, with {result.contactsAdded} contact {result.contactsAdded === 1 ? "email" : "emails"}.</p>
          {result.contactProblem && <p className="text-xs" style={{ color: T.red }}>Some contacts weren't saved: {result.contactProblem}</p>}
          {result.skipped.length > 0 && (
            <div className="text-xs">
              <div style={{ color: T.textDim }}>{result.skipped.length} {result.skipped.length === 1 ? "row was" : "rows were"} skipped:</div>
              <div className="mt-1.5 overflow-y-auto rounded-lg" style={{ maxHeight: 160, border: `1px solid ${T.border}` }}>
                {result.skipped.map((s) => (
                  <div key={s.line} className="px-3 py-1.5" style={{ borderBottom: `1px solid ${T.borderSoft}`, color: T.textDim }}>
                    <span style={{ color: T.textFaint }}>Line {s.line}</span> · {s.name} · {s.reason}
                  </div>
                ))}
              </div>
            </div>
          )}
          <button onClick={onClose} className={btn} style={{ background: T.amber, color: T.bg }}>Done</button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs" style={{ color: T.textDim, lineHeight: 1.5 }}>
            Upload a .csv or .xlsx with these columns: <b>{REQUIRED.map((r) => r.label).join(", ")}</b>. Each row becomes a Lead; an email saves as the contact, so replies file themselves. Up to {MAX_ROWS} rows at a time.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <input ref={inputRef} type="file" accept=".csv,.xlsx,.txt" className="hidden" onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
            <button onClick={() => inputRef.current?.click()} disabled={busy} className="flex items-center gap-1.5 text-sm rounded-lg px-3 py-2" style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text }}>
              <UploadCloud size={14} /> {fileName ? "Choose another file" : "Choose file"}
            </button>
            <button onClick={downloadTemplate} className="flex items-center gap-1.5 text-xs" style={{ color: T.textFaint }}><Download size={12} /> Download template</button>
            {fileName && <span className="text-xs truncate" style={{ color: T.textFaint, maxWidth: 200 }}>{fileName}</span>}
          </div>

          {error && <p className="text-xs" style={{ color: T.red }}>{error}</p>}

          {check && check.missing.length > 0 && (
            <div className="rounded-lg p-3 text-xs flex flex-col gap-1" style={{ background: T.surface2, border: `1px solid ${T.red}66`, color: T.textDim }}>
              <span style={{ color: T.red }}>Missing column{check.missing.length > 1 ? "s" : ""}: {check.missing.join(", ")}</span>
              <span>Found: {parsed.headers.filter(Boolean).join(", ") || "no headers"}. Add the missing column(s) in the first row and upload again.</span>
            </div>
          )}

          {check && check.missing.length === 0 && (
            <>
              <div className="text-sm" style={{ color: T.text }}>
                <b>{check.ready.length}</b> ready to import{check.skipped.length > 0 && <>, <b>{check.skipped.length}</b> skipped</>}
              </div>
              {check.ready.length > 0 && (
                <div className="rounded-lg overflow-hidden text-xs" style={{ border: `1px solid ${T.border}` }}>
                  {check.ready.slice(0, 6).map((r) => (
                    <div key={r.line} className="px-3 py-1.5 flex justify-between gap-2" style={{ borderBottom: `1px solid ${T.borderSoft}`, color: T.text }}>
                      <span className="truncate">{r.name}</span>
                      <span className="truncate" style={{ color: T.textFaint }}>{[r.industry, r.region, r.email].filter(Boolean).join(" · ")}</span>
                    </div>
                  ))}
                  {check.ready.length > 6 && <div className="px-3 py-1.5" style={{ color: T.textFaint }}>and {check.ready.length - 6} more</div>}
                </div>
              )}
              {(notes.noEmail > 0 || unknown.length > 0 || notes.regionIgnored) && (
                <ul className="text-[11px] flex flex-col gap-0.5" style={{ color: T.textFaint }}>
                  {notes.noEmail > 0 && <li>{notes.noEmail} without an email will be added with no contact.</li>}
                  {unknown.length > 0 && <li>Industry left blank where it didn't match our list: {unknown.slice(0, 4).map(([n, c]) => `${n} (${c})`).join(", ")}{unknown.length > 4 ? ", …" : ""}.</li>}
                  {notes.regionIgnored && <li>The Region column is ignored for your role; an Owner assigns regions.</li>}
                </ul>
              )}
              {check.skipped.length > 0 && (
                <div className="text-xs">
                  <button onClick={() => setShowSkipped((s) => !s)} style={{ color: T.amber }}>{showSkipped ? "Hide" : "Show"} skipped rows</button>
                  {showSkipped && (
                    <div className="mt-1.5 overflow-y-auto rounded-lg" style={{ maxHeight: 160, border: `1px solid ${T.border}` }}>
                      {check.skipped.map((s) => (
                        <div key={s.line} className="px-3 py-1.5" style={{ borderBottom: `1px solid ${T.borderSoft}`, color: T.textDim }}>
                          <span style={{ color: T.textFaint }}>Line {s.line}</span> · {s.name} · {s.reason}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button onClick={run} disabled={busy || check.ready.length === 0} className={btn} style={{ background: T.amber, color: T.bg, opacity: busy || check.ready.length === 0 ? 0.6 : 1 }}>
                {busy ? progress || "Importing…" : `Import ${check.ready.length} ${check.ready.length === 1 ? "company" : "companies"}`}
              </button>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
