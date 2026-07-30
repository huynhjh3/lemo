import React, { useState } from "react";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, History } from "lucide-react";
import { T } from "./theme.js";
import { Card, CardTitle } from "./ui.jsx";
import { computeImportDiff } from "./calc.js";

const COLUMN_ALIASES = {
  companyId: ["company id", "company_id", "co id", "coid"],
  companyName: ["company", "company name", "company_name"],
  contact: ["contact", "contact person", "contact_name"],
  phone: ["phone", "phone number", "contact phone"],
  businessType: ["business type", "business_type", "cooperation mode"],
  monthlyFee: ["monthly fee", "fee", "monthly_fee"],
  splitToLemo: ["split", "split %", "split_to_lemo", "split to lemo"],
  outletId: ["outlet id", "outlet_id", "location id", "outlet"],
  outletName: ["outlet name", "location", "location name", "outlet_name"],
  city: ["city", "market"],
  serial: ["device id", "serial", "serial number", "chair id", "device_id"],
  chairType: ["chair type", "device type", "type"],
  usageTotal: ["usage", "usage total", "cumulative usage", "usage_total"],
};

function normalizeHeader(h) {
  return String(h || "").trim().toLowerCase();
}

function mapRow(raw) {
  const lower = {};
  for (const [k, v] of Object.entries(raw)) lower[normalizeHeader(k)] = v;
  const out = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    const key = aliases.find((a) => a in lower);
    out[field] = key !== undefined ? lower[key] : undefined;
  }
  const businessType = String(out.businessType || "").toLowerCase();
  out.businessType = businessType.includes("corp") || businessType.includes("enterprise") ? "enterprise" : "revenue_share";
  out.monthlyFee = out.monthlyFee ? Number(out.monthlyFee) : null;
  out.splitToLemo = out.splitToLemo ? Number(out.splitToLemo) : 80;
  out.usageTotal = Number(out.usageTotal) || 0;
  out.serial = out.serial ? String(out.serial).trim() : "";
  out.companyId = out.companyId ? String(out.companyId).trim() : "";
  out.outletId = out.outletId ? String(out.outletId).trim() : "";
  return out;
}

export default function UploadImportPage({ companies, onConfirm, uploadHistory }) {
  const [fileName, setFileName] = useState(null);
  const [rows, setRows] = useState(null);
  const [diff, setDiff] = useState(null);
  const [error, setError] = useState(null);

  const handleFile = async (file) => {
    setError(null);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const mapped = json.map(mapRow).filter((r) => r.serial || r.companyName || r.companyId);
      setRows(mapped);
      setDiff(computeImportDiff(mapped, companies));
    } catch (e) {
      setError("Couldn't read that file. Export as .xlsx or .csv and try again.");
      setRows(null);
      setDiff(null);
    }
  };

  const confirm = () => {
    onConfirm({ fileName, rows, date: new Date().toISOString().slice(0, 10) });
    setRows(null);
    setDiff(null);
    setFileName(null);
  };

  return (
    <div>
      <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }} className="mb-1">
        Upload / Import
      </h1>
      <p className="text-sm mb-5" style={{ color: T.textDim }}>
        Export the Excel file from the Lemo backend, upload it here, review the summary, then confirm.
      </p>

      <Card className="mb-4">
        <CardTitle icon={Upload}>1. Upload the export</CardTitle>
        <label
          className="flex flex-col items-center justify-center gap-2 rounded-lg py-10 cursor-pointer"
          style={{ border: `1.5px dashed ${T.border}`, background: T.surface2 }}
        >
          <FileSpreadsheet size={22} style={{ color: T.amber }} />
          <span className="text-sm" style={{ color: T.text }}>
            {fileName ? fileName : "Click to choose an .xlsx or .csv file"}
          </span>
          <span className="text-xs" style={{ color: T.textFaint }}>
            One row per chair — company, outlet, chair, business type, usage total
          </span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
          />
        </label>
        {error && (
          <div className="flex items-center gap-2 text-xs mt-3" style={{ color: T.red }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}
      </Card>

      {diff && (
        <Card className="mb-4">
          <CardTitle icon={CheckCircle2}>2. Review summary</CardTitle>
          <div className="grid grid-cols-5 gap-3 mb-4">
            {[
              ["New companies", diff.newCompanies],
              ["Updated companies", diff.updatedCompanies],
              ["New outlets", diff.newOutlets],
              ["New chairs", diff.newChairs],
              ["Usage updates", diff.updatedChairs],
            ].map(([label, val]) => (
              <div key={label} className="rounded-lg p-3" style={{ background: T.surface2 }}>
                <div style={{ fontFamily: T.fontMono, fontSize: 20, color: T.teal }}>{val}</div>
                <div className="text-[11px] mt-0.5" style={{ color: T.textFaint }}>{label}</div>
              </div>
            ))}
          </div>

          {diff.warnings.length > 0 && (
            <div className="rounded-lg p-3 mb-4" style={{ background: `${T.red}10`, border: `1px solid ${T.red}33` }}>
              <div className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: T.red }}>
                <AlertTriangle size={13} /> {diff.warnings.length} row(s) need a look
              </div>
              {diff.warnings.map((w, i) => (
                <div key={i} className="text-xs" style={{ color: T.textDim }}>{w}</div>
              ))}
            </div>
          )}

          <div className="max-h-64 overflow-y-auto rounded-lg" style={{ border: `1px solid ${T.border}` }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: T.surface2, color: T.textFaint }}>
                  <th className="text-left px-3 py-2 font-medium">Company</th>
                  <th className="text-left px-3 py-2 font-medium">Outlet</th>
                  <th className="text-left px-3 py-2 font-medium">Chair</th>
                  <th className="text-left px-3 py-2 font-medium">Usage</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {diff.rows.map((r, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${T.borderSoft}` }}>
                    <td className="px-3 py-1.5" style={{ color: T.text }}>{r.companyName || r.companyId}</td>
                    <td className="px-3 py-1.5" style={{ color: T.textDim }}>{r.outletId}</td>
                    <td className="px-3 py-1.5" style={{ color: T.textDim, fontFamily: T.fontMono }}>{r.serial}</td>
                    <td className="px-3 py-1.5" style={{ color: T.textDim, fontFamily: T.fontMono }}>{r.usageTotal}</td>
                    <td className="px-3 py-1.5" style={{ color: r.status.startsWith("flagged") ? T.red : T.textFaint }}>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={confirm}
            className="flex items-center justify-center gap-2 text-sm font-medium rounded-lg py-2.5 mt-4 w-full"
            style={{ background: T.amber, color: T.bg, fontFamily: T.fontBody }}
          >
            <CheckCircle2 size={15} /> Confirm and apply
          </button>
        </Card>
      )}

      <Card>
        <CardTitle icon={History}>Upload history</CardTitle>
        {uploadHistory.length === 0 ? (
          <p className="text-xs" style={{ color: T.textFaint }}>No uploads yet.</p>
        ) : (
          <div className="flex flex-col">
            {uploadHistory.map((u, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-2" style={{ borderTop: i ? `1px solid ${T.borderSoft}` : "none" }}>
                <span style={{ color: T.text }}>{u.fileName}</span>
                <span style={{ color: T.textFaint, fontFamily: T.fontMono }}>{u.date} · {u.rowCount} rows · {u.by}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
