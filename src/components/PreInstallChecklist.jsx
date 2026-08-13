import React, { useState } from "react";
import { ClipboardList, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { T } from "../theme.js";

const inputStyle = { background: T.bg, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody };

const CHAIR_ARRANGEMENT_OPTIONS = [
  ["side_by_side", "Side by side"],
  ["across_from_each_other", "Across from each other"],
  ["front_to_back", "Front to back"],
  ["separate_areas", "Separate areas"],
  ["not_yet_decided", "Not yet decided"],
];
const FLOOR_ACCESS_OPTIONS = [
  ["ground_floor", "Ground floor"],
  ["freight_elevator", "Upper floor with freight elevator"],
  ["passenger_elevator", "Upper floor with passenger elevator"],
  ["no_elevator", "Upper floor without elevator"],
  ["basement", "Lower level or basement"],
  ["not_sure", "Not sure"],
];
const YES_NO_NOT_SURE = [["yes", "Yes"], ["no", "No"], ["not_sure", "Not sure"]];
const DELIVERY_ACCESS_OPTIONS = [
  ["loading_dock", "Loading dock"],
  ["delivery_entrance", "Designated delivery entrance"],
  ["standard_entrance", "Standard entrance"],
  ["not_sure", "Not sure"],
];
const SITE_REQUIREMENT_OPTIONS = [
  ["security_clearance", "Security clearance"],
  ["vendor_registration", "Vendor registration"],
  ["certificate_of_insurance", "Certificate of Insurance"],
  ["loading_dock_appointment", "Loading dock appointment"],
  ["parking_permit", "Parking permit"],
  ["building_approval", "Building approval"],
  ["stairs_or_narrow_access", "Stairs or narrow access"],
  ["none", "None"],
  ["other", "Other"],
];
const EARLY_RECEIPT_OPTIONS = [
  ["yes", "Yes"],
  ["must_arrive_with_team", "Shipment must arrive with the installation team"],
  ["not_sure", "Not sure"],
];

function initialForm(checklist) {
  return {
    preferredInstallWindow: checklist?.preferredInstallWindow || "",
    requiredCompletionDate: checklist?.requiredCompletionDate || "",
    installTimeWindow: checklist?.installTimeWindow || "",
    deadlineFlexible: checklist?.deadlineFlexible || "",
    deadlineEventDetails: checklist?.deadlineEventDetails || "",
    availableSpace: checklist?.availableSpace || "",
    chairArrangement: checklist?.chairArrangement || "",
    floorAccess: checklist?.floorAccess || "",
    outletsNearChairs: checklist?.outletsNearChairs || "",
    photosLink: checklist?.photosLink || "",
    deliveryAccess: checklist?.deliveryAccess || "",
    siteRequirements: checklist?.siteRequirements || [],
    siteRequirementsOther: checklist?.siteRequirementsOther || "",
    accessInstructions: checklist?.accessInstructions || "",
    earlyReceipt: checklist?.earlyReceipt || "",
    additionalNotes: checklist?.additionalNotes || "",
  };
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs" style={{ color: T.textFaint }}>{label}</span>
      {children}
    </label>
  );
}

function Select({ value, onChange, options, placeholder }) {
  return (
    <select value={value} onChange={onChange} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
      <option value="">{placeholder || "Select…"}</option>
      {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
    </select>
  );
}

export default function PreInstallChecklist({ outlet, restricted, upsertPreInstallChecklist, completePreInstallChecklist }) {
  const checklist = outlet.checklist;
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState(() => initialForm(checklist));
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const toggleRequirement = (value) => {
    setForm((f) => ({
      ...f,
      siteRequirements: f.siteRequirements.includes(value)
        ? f.siteRequirements.filter((v) => v !== value)
        : [...f.siteRequirements, value],
    }));
  };

  const open = () => {
    setForm(initialForm(checklist));
    setExpanded((v) => !v);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await upsertPreInstallChecklist(outlet.id, {
        preferred_install_window: form.preferredInstallWindow || null,
        required_completion_date: form.requiredCompletionDate || null,
        install_time_window: form.installTimeWindow || null,
        deadline_flexible: form.deadlineFlexible || null,
        deadline_event_details: form.deadlineEventDetails || null,
        available_space: form.availableSpace || null,
        chair_arrangement: form.chairArrangement || null,
        floor_access: form.floorAccess || null,
        outlets_near_chairs: form.outletsNearChairs || null,
        photos_link: form.photosLink || null,
        delivery_access: form.deliveryAccess || null,
        site_requirements: form.siteRequirements,
        site_requirements_other: form.siteRequirementsOther || null,
        access_instructions: form.accessInstructions || null,
        early_receipt: form.earlyReceipt || null,
        additional_notes: form.additionalNotes || null,
      });
      setExpanded(false);
    } finally {
      setSaving(false);
    }
  };

  const markComplete = async () => {
    if (!checklist?.id) return;
    setCompleting(true);
    try {
      await completePreInstallChecklist(checklist.id);
    } finally {
      setCompleting(false);
    }
  };

  const status = !checklist ? "not_started" : checklist.completedAt ? "complete" : "in_progress";
  const statusMeta = {
    not_started: { label: "Not started", color: T.textFaint },
    in_progress: { label: "In progress", color: T.amber },
    complete: { label: "Complete", color: T.teal },
  }[status];

  return (
    <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${T.border}` }}>
      <button onClick={open} className="flex items-center justify-between w-full text-left">
        <span className="flex items-center gap-1.5 text-xs" style={{ color: T.textDim }}>
          <ClipboardList size={12} /> Pre-Install Checklist
        </span>
        <span className="flex items-center gap-2">
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ color: statusMeta.color, border: `1px solid ${statusMeta.color}55`, background: `${statusMeta.color}14`, fontFamily: T.fontMono }}
          >
            {statusMeta.label}
          </span>
          {expanded ? <ChevronUp size={13} style={{ color: T.textFaint }} /> : <ChevronDown size={13} style={{ color: T.textFaint }} />}
        </span>
      </button>

      {expanded && (
        <form onSubmit={submit} className="flex flex-col gap-4 mt-3">
          {restricted ? (
            <p className="text-xs" style={{ color: T.textFaint }}>Unlocks once this company is confirmed.</p>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: T.textFaint }}>Schedule</div>
                <Field label="Preferred installation date or date range">
                  <input value={form.preferredInstallWindow} onChange={set("preferredInstallWindow")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
                </Field>
                <Field label="Required completion date">
                  <input type="date" value={form.requiredCompletionDate} onChange={set("requiredCompletionDate")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
                </Field>
                <Field label="Available installation time window">
                  <input placeholder="e.g. 8:00 AM–12:00 PM" value={form.installTimeWindow} onChange={set("installTimeWindow")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
                </Field>
                <Field label="Is this deadline flexible?">
                  <Select value={form.deadlineFlexible} onChange={set("deadlineFlexible")} options={[["yes", "Yes"], ["somewhat", "Somewhat"], ["no", "No"]]} />
                </Field>
                <Field label="Tied to an opening, inspection, or event? (optional)">
                  <textarea rows={2} value={form.deadlineEventDetails} onChange={set("deadlineEventDetails")} className="text-sm rounded-lg px-3 py-2 outline-none resize-none" style={inputStyle} />
                </Field>
              </div>

              <div className="flex flex-col gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: T.textFaint }}>Installation Area</div>
                <Field label="Available space (approximate measurements — each chair needs 7ft x 3ft)">
                  <input value={form.availableSpace} onChange={set("availableSpace")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
                </Field>
                <Field label="How will the chairs be arranged?">
                  <Select value={form.chairArrangement} onChange={set("chairArrangement")} options={CHAIR_ARRANGEMENT_OPTIONS} />
                </Field>
                <Field label="Installation floor and elevator access">
                  <Select value={form.floorAccess} onChange={set("floorAccess")} options={FLOOR_ACCESS_OPTIONS} />
                </Field>
                <Field label="Are outlets available near each chair?">
                  <Select value={form.outletsNearChairs} onChange={set("outletsNearChairs")} options={YES_NO_NOT_SURE} />
                </Field>
                <Field label="Photos or video link (optional)">
                  <input placeholder="Google Drive, Dropbox, etc." value={form.photosLink} onChange={set("photosLink")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
                </Field>
              </div>

              <div className="flex flex-col gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: T.textFaint }}>Delivery &amp; Access</div>
                <Field label="Delivery access">
                  <Select value={form.deliveryAccess} onChange={set("deliveryAccess")} options={DELIVERY_ACCESS_OPTIONS} />
                </Field>
                <div className="flex flex-col gap-1">
                  <span className="text-xs" style={{ color: T.textFaint }}>Site requirements (select all that apply)</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {SITE_REQUIREMENT_OPTIONS.map(([v, label]) => (
                      <label key={v} className="flex items-center gap-1.5 text-xs" style={{ color: T.textDim }}>
                        <input type="checkbox" checked={form.siteRequirements.includes(v)} onChange={() => toggleRequirement(v)} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
                {form.siteRequirements.includes("other") && (
                  <Field label="Other requirement">
                    <input value={form.siteRequirementsOther} onChange={set("siteRequirementsOther")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
                  </Field>
                )}
                <Field label="Delivery and access instructions">
                  <textarea rows={2} placeholder="Receiving hours, parking, check-in, dock access, or 'None.'" value={form.accessInstructions} onChange={set("accessInstructions")} className="text-sm rounded-lg px-3 py-2 outline-none resize-none" style={inputStyle} />
                </Field>
                <Field label="Can someone receive the shipment if it arrives early?">
                  <Select value={form.earlyReceipt} onChange={set("earlyReceipt")} options={EARLY_RECEIPT_OPTIONS} />
                </Field>
              </div>

              <Field label="Anything else we should know? (optional)">
                <textarea rows={2} value={form.additionalNotes} onChange={set("additionalNotes")} className="text-sm rounded-lg px-3 py-2 outline-none resize-none" style={inputStyle} />
              </Field>

              <div className="flex items-center gap-2">
                <button type="submit" disabled={saving} className="text-xs font-medium rounded-lg px-3 py-1.5" style={{ background: T.amber, color: T.bg, opacity: saving ? 0.7 : 1 }}>
                  {saving ? "Saving…" : "Save checklist"}
                </button>
                {checklist && !checklist.completedAt && (
                  <button type="button" onClick={markComplete} disabled={completing} className="flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5" style={{ border: `1px solid ${T.teal}55`, color: T.teal, opacity: completing ? 0.7 : 1 }}>
                    <CheckCircle2 size={13} /> {completing ? "Marking…" : "Mark complete"}
                  </button>
                )}
                <button type="button" onClick={() => setExpanded(false)} className="text-xs rounded-lg px-3 py-1.5" style={{ color: T.textDim }}>
                  Close
                </button>
              </div>
            </>
          )}
        </form>
      )}
    </div>
  );
}
