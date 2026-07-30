import React, { useState } from "react";
import { Plus, Trash2, Archive } from "lucide-react";
import { T } from "./theme.js";
import { Modal, Field, inputStyle } from "./ui.jsx";
import { STAGE_ORDER } from "./store.js";

export function CompanyFormModal({ initial, onSave, onClose }) {
  const [f, setF] = useState({
    name: initial?.name || "", industry: initial?.industry || "", city: initial?.city || "",
    rep: initial?.rep || "", stage: initial?.stage || "Lead", dealValue: initial?.dealValue || 0,
    status: initial?.status || "healthy",
    lastContact: initial?.lastContact || "2026-07-14",
    nextFollowUp: initial?.nextFollowUp || "",
    businessType: initial?.businessType || "revenue_share",
    monthlyFee: initial?.monthlyFee || 0, splitToLemo: initial?.splitToLemo ?? 80,
    interest: initial?.interest || "",
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <Modal title={initial ? "Edit company" : "Add company"} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Company name"><input value={f.name} onChange={set("name")} className="w-full text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} /></Field>
        <Field label="Industry"><input value={f.industry} onChange={set("industry")} className="w-full text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} /></Field>
        <Field label="City"><input value={f.city} onChange={set("city")} className="w-full text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} /></Field>
        <Field label="Rep"><input value={f.rep} onChange={set("rep")} className="w-full text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} /></Field>
        <Field label="Stage">
          <select value={f.stage} onChange={set("stage")} className="w-full text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
            {STAGE_ORDER.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Deal value ($)"><input type="number" value={f.dealValue} onChange={set("dealValue")} className="w-full text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} /></Field>
        <Field label="Status">
          <select value={f.status} onChange={set("status")} className="w-full text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
            <option value="healthy">Healthy</option>
            <option value="attention">Needs Attention</option>
            <option value="risk">At Risk</option>
          </select>
        </Field>
        <Field label="Last contact">
          <input type="date" value={f.lastContact} onChange={set("lastContact")} className="w-full text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
        </Field>
        <Field label="Next follow-up">
          <input type="date" value={f.nextFollowUp} onChange={set("nextFollowUp")} className="w-full text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
        </Field>
        <Field label="Business type">
          <select value={f.businessType} onChange={set("businessType")} className="w-full text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
            <option value="enterprise">Enterprise</option>
            <option value="revenue_share">Revenue share</option>
          </select>
        </Field>
        {f.businessType === "enterprise" ? (
          <Field label="Monthly fee ($)"><input type="number" value={f.monthlyFee} onChange={set("monthlyFee")} className="w-full text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} /></Field>
        ) : (
          <Field label="Split to Lemo (%)"><input type="number" value={f.splitToLemo} onChange={set("splitToLemo")} className="w-full text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} /></Field>
        )}
      </div>
      <Field label="Interest / notes">
        <textarea value={f.interest} onChange={set("interest")} rows={3} className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-none" style={inputStyle} />
      </Field>
      <button
        onClick={() => onSave({
          ...f,
          dealValue: Number(f.dealValue) || 0,
          nextFollowUp: f.nextFollowUp || null,
          monthlyFee: f.businessType === "enterprise" ? Number(f.monthlyFee) || 0 : null,
          splitToLemo: f.businessType === "revenue_share" ? Number(f.splitToLemo) || 80 : null,
        })}
        className="text-sm font-medium rounded-lg py-2.5 mt-2 w-full"
        style={{ background: T.amber, color: T.bg, fontFamily: T.fontBody }}
      >
        {initial ? "Save changes" : "Add company"}
      </button>
    </Modal>
  );
}

export function OutletsChairsSection({ company, dispatch }) {
  const [addingOutlet, setAddingOutlet] = useState(false);
  const [outletName, setOutletName] = useState("");
  const [outletAddress, setOutletAddress] = useState("");
  const [addingChairFor, setAddingChairFor] = useState(null);
  const [serial, setSerial] = useState("");
  const [chairType, setChairType] = useState("");

  const addOutlet = () => {
    if (!outletName.trim()) return;
    dispatch({ type: "ADD_OUTLET", companyId: company.id, payload: { name: outletName, address: outletAddress, city: company.city } });
    setOutletName(""); setOutletAddress(""); setAddingOutlet(false);
  };
  const addChair = (outletId) => {
    if (!serial.trim()) return;
    dispatch({ type: "ADD_CHAIR", companyId: company.id, outletId, payload: { serial: serial.trim(), type: chairType || "Chair", installed: "2026-07-14", usageHistory: [{ date: "2026-07-14", total: 0 }] } });
    setSerial(""); setChairType(""); setAddingChairFor(null);
  };

  return (
    <div className="flex flex-col gap-3">
      {company.outlets.map((o) => (
        <div key={o.id} className="rounded-lg p-3" style={{ background: T.surface2 }}>
          <div className="flex items-center justify-between mb-0.5">
            <div className="text-sm font-medium" style={{ color: T.text }}>
              {o.name} <span className="text-xs" style={{ color: T.textFaint, fontFamily: T.fontMono }}>· {o.id}</span>
            </div>
            <button onClick={() => dispatch({ type: "DELETE_OUTLET", companyId: company.id, outletId: o.id })} className="text-xs flex items-center gap-1" style={{ color: T.textFaint }}>
              <Trash2 size={12} /> Remove
            </button>
          </div>
          <div className="text-xs mb-2" style={{ color: T.textFaint }}>{o.address}</div>
          {o.chairs.length === 0 ? (
            <div className="text-xs mb-2" style={{ color: T.textFaint }}>No chairs assigned yet.</div>
          ) : (
            <div className="flex flex-col gap-1 mb-2">
              {o.chairs.map((d) => (
                <div key={d.serial} className="flex items-center justify-between text-xs py-1" style={{ borderTop: `1px solid ${T.border}`, color: T.textDim }}>
                  <span>{d.type} <span style={{ color: T.textFaint, fontFamily: T.fontMono }}>· {d.serial}</span></span>
                  <div className="flex items-center gap-2">
                    <select
                      value={d.status}
                      onChange={(e) => dispatch({ type: "UPDATE_CHAIR_STATUS", companyId: company.id, outletId: o.id, serial: d.serial, status: e.target.value })}
                      className="text-xs rounded px-1.5 py-0.5 outline-none"
                      style={{ ...inputStyle, fontFamily: T.fontMono }}
                      disabled={d.retired}
                    >
                      <option value="online">online</option>
                      <option value="offline">offline</option>
                    </select>
                    {!d.retired && (
                      <button
                        onClick={() => dispatch({ type: "RETIRE_CHAIR", companyId: company.id, outletId: o.id, serial: d.serial })}
                        className="flex items-center gap-1"
                        style={{ color: T.textFaint }}
                        title="Retire without reusing this ID"
                      >
                        <Archive size={12} />
                      </button>
                    )}
                    {d.retired && <span style={{ color: T.textFaint }}>retired</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {addingChairFor === o.id ? (
            <div className="flex items-center gap-2 mt-1">
              <input placeholder="Device serial" value={serial} onChange={(e) => setSerial(e.target.value)} className="text-xs rounded px-2 py-1 outline-none flex-1" style={inputStyle} />
              <input placeholder="Type" value={chairType} onChange={(e) => setChairType(e.target.value)} className="text-xs rounded px-2 py-1 outline-none w-28" style={inputStyle} />
              <button onClick={() => addChair(o.id)} className="text-xs px-2 py-1 rounded" style={{ background: T.amber, color: T.bg }}>Add</button>
            </div>
          ) : (
            <button onClick={() => setAddingChairFor(o.id)} className="flex items-center gap-1 text-xs" style={{ color: T.amber }}>
              <Plus size={12} /> Assign chair by serial
            </button>
          )}
        </div>
      ))}

      {addingOutlet ? (
        <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: T.surface2 }}>
          <input placeholder="Outlet name" value={outletName} onChange={(e) => setOutletName(e.target.value)} className="text-xs rounded px-2 py-1.5 outline-none" style={inputStyle} />
          <input placeholder="Address" value={outletAddress} onChange={(e) => setOutletAddress(e.target.value)} className="text-xs rounded px-2 py-1.5 outline-none" style={inputStyle} />
          <div className="flex gap-2">
            <button onClick={addOutlet} className="text-xs px-3 py-1.5 rounded" style={{ background: T.amber, color: T.bg }}>Add outlet</button>
            <button onClick={() => setAddingOutlet(false)} className="text-xs px-3 py-1.5 rounded" style={{ color: T.textFaint }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAddingOutlet(true)} className="flex items-center gap-1 text-xs" style={{ color: T.amber }}>
          <Plus size={13} /> Add outlet
        </button>
      )}
    </div>
  );
}
