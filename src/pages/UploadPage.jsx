import React, { useMemo, useState } from "react";
import Papa from "papaparse";
import { UploadCloud, CheckCircle2, AlertTriangle } from "lucide-react";
import { T } from "../theme.js";
import { Card, CardTitle } from "../components/ui.jsx";
import { fmtMoney, fmtCount, round2, TODAY } from "../lib/helpers.js";
import { useAuth } from "../context/AuthContext.jsx";

const inputStyle = { background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody };

const SKIP_LABEL = {
  "no-code": "no code", "bad-revenue": "bad revenue", "bad-date": "bad date", unmatched: "unmatched",
};

function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function normalizeDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : toISODate(d);
}

function parseGross(raw) {
  const cleaned = String(raw ?? "").replace(/[^0-9.-]/g, "");
  if (!cleaned) return NaN;
  return Number(cleaned);
}

function parseOrders(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  const cleaned = String(raw).replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : Math.round(n);
}

// Devices don't carry a separate "external chair id" field — matching is
// by serial, since that's what the backend's chair identifier lines up
// with in practice (e.g. a device serial like "121100139" is literally the
// chair_id the CSV export uses for it).
function findDevice(company, rawChairId) {
  if (!company || !rawChairId) return null;
  const needle = rawChairId.trim().toLowerCase();
  for (const outlet of company.outlets) {
    const device = outlet.devices.find((d) => d.serial && d.serial.trim().toLowerCase() === needle);
    if (device) return device;
  }
  return null;
}

export default function UploadPage({ companies, uploadCsvRevenue }) {
  const { profile } = useAuth();
  const [parsed, setParsed] = useState(null); // { headers, rows }
  const [mapping, setMapping] = useState({ code: "", revenue: "", orders: "", date: "", chair: "" });
  const [manualDate, setManualDate] = useState(toISODate(TODAY));
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [fileName, setFileName] = useState("");

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setResult(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const headers = res.meta.fields || [];
        setParsed({ headers, rows: res.data });
        setMapping({
          code: headers.find((h) => /code|company.?id|store|location/i.test(h)) || headers[0] || "",
          revenue: headers.find((h) => /revenue|amount|sales|total/i.test(h)) || "",
          orders: headers.find((h) => /order|count|qty|quantity|transactions/i.test(h)) || "",
          date: headers.find((h) => /date|day/i.test(h)) || "",
          chair: headers.find((h) => /chair|device|serial/i.test(h)) || "",
        });
      },
      error: (err) => setError(err.message),
    });
  };

  const preview = useMemo(() => {
    if (!parsed || !mapping.code || !mapping.revenue) return [];
    return parsed.rows.map((row, i) => {
      const rawCode = String(row[mapping.code] ?? "").trim();
      const gross = parseGross(row[mapping.revenue]);
      const orders = mapping.orders ? parseOrders(row[mapping.orders]) : null;
      const rawDate = mapping.date ? row[mapping.date] : manualDate;
      const date = normalizeDate(rawDate);
      const company = companies.find(
        (c) => c.code && c.code.trim().toLowerCase() === rawCode.toLowerCase()
      );
      const rawChairId = mapping.chair ? String(row[mapping.chair] ?? "").trim() : "";
      const device = mapping.chair ? findDevice(company, rawChairId) : null;

      let skip = null;
      if (!rawCode) skip = "no-code";
      else if (Number.isNaN(gross)) skip = "bad-revenue";
      else if (!date) skip = "bad-date";
      else if (!company) skip = "unmatched";

      // Enterprise deals are billed flat regardless of usage, so they never
      // earn a cut from the CSV — but the gross figure itself is still
      // recorded as a usage signal (see revenue_csv_uploads' amount column).
      const isEnterprise = !skip && company.dealType !== "revenue_share";
      const amount = !skip && !isEnterprise ? round2(gross * (company.dealValue / 100)) : 0;
      return {
        i, rawCode, gross: Number.isNaN(gross) ? 0 : gross, orders, date, company, skip, isEnterprise, amount,
        rawChairId, device,
      };
    });
  }, [parsed, mapping, manualDate, companies]);

  const ok = preview.filter((r) => !r.skip);
  const unmatched = preview.filter((r) => r.skip === "unmatched");
  const skippedOther = preview.filter((r) => r.skip && r.skip !== "unmatched");
  const totalAmount = ok.reduce((s, r) => s + r.amount, 0);
  const totalGross = ok.reduce((s, r) => s + r.gross, 0);
  const totalOrders = ok.reduce((s, r) => s + (r.orders || 0), 0);
  const chairsMatched = new Set(ok.filter((r) => r.device).map((r) => r.device.id)).size;

  const commit = async () => {
    setCommitting(true);
    setError(null);
    try {
      // Aggregate by company+date first — Postgres upsert can't touch the same
      // (company_id, upload_date) conflict key twice in one statement, and a
      // CSV can list multiple outlets (or, per chair-level exports, multiple
      // chairs) for the same company on the same day.
      const grouped = new Map();
      const deviceGrouped = new Map();
      for (const r of ok) {
        const key = `${r.company.id}|${r.date}`;
        const existing = grouped.get(key);
        if (existing) {
          existing.gross_revenue = round2(existing.gross_revenue + r.gross);
          existing.amount = round2(existing.amount + r.amount);
          if (r.orders != null) existing.orders_count = (existing.orders_count || 0) + r.orders;
        } else {
          grouped.set(key, {
            company_id: r.company.id,
            upload_date: r.date,
            gross_revenue: r.gross,
            amount: r.amount,
            orders_count: r.orders,
            uploaded_by: profile?.id || null,
          });
        }

        if (r.device) {
          const deviceKey = `${r.device.id}|${r.date}`;
          const existingDevice = deviceGrouped.get(deviceKey);
          if (existingDevice) {
            existingDevice.revenue = round2(existingDevice.revenue + r.gross);
            existingDevice.orders_count += r.orders || 0;
          } else {
            deviceGrouped.set(deviceKey, {
              device_id: r.device.id,
              upload_date: r.date,
              revenue: r.gross,
              orders_count: r.orders || 0,
            });
          }
        }
      }
      const rows = Array.from(grouped.values());
      const deviceRows = Array.from(deviceGrouped.values());
      await uploadCsvRevenue(rows, deviceRows);
      setResult({
        companies: new Set(rows.map((r) => r.company_id)).size,
        rows: rows.length,
        total: rows.reduce((s, r) => s + r.amount, 0),
        gross: rows.reduce((s, r) => s + r.gross_revenue, 0),
        orders: rows.reduce((s, r) => s + (r.orders_count || 0), 0),
        chairs: new Set(deviceRows.map((r) => r.device_id)).size,
        unmatchedCodes: [...new Set(unmatched.map((r) => r.rawCode))],
      });
      setParsed(null);
      setFileName("");
    } catch (err) {
      setError(err.message || "Upload failed — try again.");
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }} className="mb-5">
        Upload Revenue CSV
      </h1>

      <Card className="mb-4">
        <CardTitle icon={UploadCloud}>1. Choose file</CardTitle>
        <p className="text-xs mb-3" style={{ color: T.textFaint }}>
          The daily revenue export from the backend. Any column layout works — you'll map columns next.
          Revenue Share rows compute our monthly revenue; Enterprise rows don't earn a cut but their
          revenue and order count are still recorded for usage tracking.
        </p>
        <input type="file" accept=".csv" onChange={onFile} className="text-sm" style={{ color: T.textDim }} />
        {fileName && (
          <p className="text-xs mt-2" style={{ color: T.textFaint }}>{fileName} — {parsed?.rows.length ?? 0} rows</p>
        )}
      </Card>

      {parsed && (
        <Card className="mb-4">
          <CardTitle icon={UploadCloud}>2. Map columns</CardTitle>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: T.textFaint }}>Code column</label>
              <select
                value={mapping.code}
                onChange={(e) => setMapping((m) => ({ ...m, code: e.target.value }))}
                className="text-sm rounded-lg px-3 py-2 outline-none w-full" style={inputStyle}
              >
                <option value="">—</option>
                {parsed.headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: T.textFaint }}>Revenue column</label>
              <select
                value={mapping.revenue}
                onChange={(e) => setMapping((m) => ({ ...m, revenue: e.target.value }))}
                className="text-sm rounded-lg px-3 py-2 outline-none w-full" style={inputStyle}
              >
                <option value="">—</option>
                {parsed.headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: T.textFaint }}>Orders column (optional)</label>
              <select
                value={mapping.orders}
                onChange={(e) => setMapping((m) => ({ ...m, orders: e.target.value }))}
                className="text-sm rounded-lg px-3 py-2 outline-none w-full" style={inputStyle}
              >
                <option value="">— not in this file —</option>
                {parsed.headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: T.textFaint }}>Date column (optional)</label>
              <select
                value={mapping.date}
                onChange={(e) => setMapping((m) => ({ ...m, date: e.target.value }))}
                className="text-sm rounded-lg px-3 py-2 outline-none w-full" style={inputStyle}
              >
                <option value="">Use one date for all rows</option>
                {parsed.headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs mb-1 block" style={{ color: T.textFaint }}>Chair ID column (optional)</label>
            <select
              value={mapping.chair}
              onChange={(e) => setMapping((m) => ({ ...m, chair: e.target.value }))}
              className="text-sm rounded-lg px-3 py-2 outline-none w-full" style={inputStyle}
            >
              <option value="">— not in this file —</option>
              {parsed.headers.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
            <p className="text-xs mt-1" style={{ color: T.textFaint }}>
              Matched against each company's device serials — when a chair-level export includes this, usage also breaks down by chair.
            </p>
          </div>
          {!mapping.date && (
            <div>
              <label className="text-xs mb-1 block" style={{ color: T.textFaint }}>Date for this file</label>
              <input
                type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)}
                className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}
              />
            </div>
          )}
        </Card>
      )}

      {parsed && mapping.code && mapping.revenue && (
        <Card className="mb-4">
          <CardTitle icon={CheckCircle2}>3. Preview & confirm</CardTitle>
          <div
            className="flex items-center gap-4 text-xs mb-3 pb-3 flex-wrap"
            style={{ borderBottom: `1px solid ${T.borderSoft}`, color: T.textDim }}
          >
            <span>Matched <b style={{ color: T.teal, fontFamily: T.fontMono }}>{ok.length}</b></span>
            <span>Unmatched <b style={{ color: T.red, fontFamily: T.fontMono }}>{unmatched.length}</b></span>
            <span>Skipped <b style={{ color: T.textFaint, fontFamily: T.fontMono }}>{skippedOther.length}</b></span>
            {mapping.orders && (
              <span>Total orders (usage) <b style={{ color: T.text, fontFamily: T.fontMono }}>{fmtCount(totalOrders)}</b></span>
            )}
            <span>Total gross revenue <b style={{ color: T.text, fontFamily: T.fontMono }}>{fmtMoney(totalGross)}</b></span>
            <span>Our revenue <b style={{ color: T.amber, fontFamily: T.fontMono }}>{fmtMoney(totalAmount)}</b></span>
            {mapping.chair && (
              <span>Chairs matched <b style={{ color: T.text, fontFamily: T.fontMono }}>{chairsMatched}</b></span>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            <div
              className={`grid ${mapping.chair ? "grid-cols-7" : "grid-cols-6"} text-[11px] uppercase tracking-wide pb-2 sticky top-0`}
              style={{ color: T.textFaint, background: T.surface, borderBottom: `1px solid ${T.border}` }}
            >
              <span>Code</span><span>Company</span>
              {mapping.chair && <span>Chair</span>}
              <span>Date</span><span>Gross</span><span>Orders</span><span>Our share</span>
            </div>
            {preview.map((r) => (
              <div
                key={r.i} className={`grid ${mapping.chair ? "grid-cols-7" : "grid-cols-6"} items-center text-xs py-1.5`}
                style={{ borderBottom: `1px solid ${T.borderSoft}`, opacity: r.skip ? 0.6 : 1 }}
              >
                <span style={{ color: T.text, fontFamily: T.fontMono }}>{r.rawCode || "—"}</span>
                <span style={{ color: r.skip === "unmatched" ? T.red : T.textDim }}>
                  {r.company ? r.company.name : r.skip === "unmatched" ? "No match" : "—"}
                </span>
                {mapping.chair && (
                  <span style={{ color: r.rawChairId && !r.device ? T.red : T.textFaint, fontFamily: T.fontMono }}>
                    {r.rawChairId ? (r.device ? r.rawChairId : `${r.rawChairId} (no match)`) : "—"}
                  </span>
                )}
                <span style={{ color: T.textFaint, fontFamily: T.fontMono }}>{r.date || "invalid"}</span>
                <span style={{ color: T.textDim, fontFamily: T.fontMono }}>{fmtMoney(r.gross)}</span>
                <span style={{ color: T.textDim, fontFamily: T.fontMono }}>{r.orders != null ? fmtCount(r.orders) : "—"}</span>
                <span style={{ color: r.skip ? T.textFaint : r.isEnterprise ? T.textFaint : T.teal, fontFamily: T.fontMono }}>
                  {r.skip ? SKIP_LABEL[r.skip] : r.isEnterprise ? "usage only" : fmtMoney(r.amount)}
                </span>
              </div>
            ))}
          </div>

          {error && <p className="text-xs mt-3" style={{ color: T.red }}>{error}</p>}

          <button
            onClick={commit}
            disabled={committing || ok.length === 0}
            className="text-sm font-medium rounded-lg py-2.5 mt-4 w-full"
            style={{ background: T.amber, color: T.bg, opacity: committing || ok.length === 0 ? 0.6 : 1 }}
          >
            {committing ? "Uploading…" : `Confirm upload (${ok.length} rows)`}
          </button>
        </Card>
      )}

      {result && (
        <Card>
          <CardTitle icon={CheckCircle2}>Done</CardTitle>
          <p className="text-sm" style={{ color: T.text }}>
            Updated {result.companies} {result.companies === 1 ? "company" : "companies"} across{" "}
            {result.rows} day{result.rows === 1 ? "" : "s"}
            {result.orders > 0 && <> — {fmtCount(result.orders)} orders</>} — {fmtMoney(result.gross)} gross revenue,{" "}
            {fmtMoney(result.total)} of that ours.
            {result.chairs > 0 && <> Also updated per-chair usage for {result.chairs} chair{result.chairs === 1 ? "" : "s"}.</>}
          </p>
          {result.unmatchedCodes.length > 0 && (
            <div className="mt-3 flex items-start gap-2">
              <AlertTriangle size={14} style={{ color: T.amber, marginTop: 2 }} />
              <p className="text-xs" style={{ color: T.textDim }}>
                Unmatched codes — check these against Companies: {result.unmatchedCodes.join(", ")}
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
