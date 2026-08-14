import React, { useState } from "react";
import { ClipboardList, ChevronDown, ChevronUp, CheckCircle2, Send, ShieldCheck } from "lucide-react";
import { T } from "../theme.js";
import { useAuth } from "../context/AuthContext.jsx";

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

// Mirrors the required (*) fields on the original kickoff form, minus
// whatever's already covered by company/outlet/contact fields. Checked
// against the *saved* checklist (not the in-progress form) — Mark Complete
// acts on what's actually persisted.
const REQUIRED_FIELDS = [
  ["preferredInstallStart", "Preferred installation date"],
  ["requiredCompletionDate", "Required completion date"],
  ["installTimeStart", "Installation time window (start)"],
  ["installTimeEnd", "Installation time window (end)"],
  ["deadlineFlexible", "Is this deadline flexible?"],
  ["availableSpace", "Available space"],
  ["chairArrangement", "How will the chairs be arranged?"],
  ["floorAccess", "Installation floor and elevator access"],
  ["outletsNearChairs", "Are outlets available near each chair?"],
  ["deliveryAccess", "Delivery access"],
  ["accessInstructions", "Delivery and access instructions"],
  ["earlyReceipt", "Can someone receive the shipment if it arrives early?"],
];

function missingRequiredFields(data) {
  if (!data) return REQUIRED_FIELDS;
  return REQUIRED_FIELDS.filter(([key]) => data[key] === null || data[key] === undefined || data[key] === "");
}

function initialForm(checklist) {
  return {
    preferredInstallStart: checklist?.preferredInstallStart || "",
    preferredInstallEnd: checklist?.preferredInstallEnd || "",
    requiredCompletionDate: checklist?.requiredCompletionDate || "",
    installTimeStart: checklist?.installTimeStart || "",
    installTimeEnd: checklist?.installTimeEnd || "",
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

function Field({ label, required, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs" style={{ color: T.textFaint }}>
        {label}{required && <span style={{ color: T.red }}> *</span>}
      </span>
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

export default function PreInstallChecklist({
  outlet, restricted, upsertPreInstallChecklist, completePreInstallChecklist, submitPreInstallChecklistForInstall,
  approvePreInstallChecklist,
}) {
  const { profile } = useAuth();
  const checklist = outlet.checklist;
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState(() => initialForm(checklist));
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [actionError, setActionError] = useState(null);

  const set = (key) => (e) => {
    setJustSaved(false);
    setActionError(null);
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  const toggleRequirement = (value) => {
    setJustSaved(false);
    setForm((f) => ({
      ...f,
      siteRequirements: f.siteRequirements.includes(value)
        ? f.siteRequirements.filter((v) => v !== value)
        : [...f.siteRequirements, value],
    }));
  };

  const open = () => {
    setForm(initialForm(checklist));
    setJustSaved(false);
    setActionError(null);
    setExpanded((v) => !v);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setActionError(null);
    try {
      await upsertPreInstallChecklist(outlet.id, {
        preferred_install_start: form.preferredInstallStart || null,
        preferred_install_end: form.preferredInstallEnd || null,
        required_completion_date: form.requiredCompletionDate || null,
        install_time_start: form.installTimeStart || null,
        install_time_end: form.installTimeEnd || null,
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
      setJustSaved(true);
    } catch (err) {
      setActionError(err.message || "Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  };

  const markComplete = async () => {
    if (!checklist?.id) return;
    setCompleting(true);
    setActionError(null);
    try {
      await completePreInstallChecklist(checklist.id);
    } catch (err) {
      setActionError(err.message || "Couldn't mark complete — try again.");
    } finally {
      setCompleting(false);
    }
  };

  const submitForInstall = async () => {
    if (!checklist?.id) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await submitPreInstallChecklistForInstall(checklist.id, profile.id);
    } catch (err) {
      setActionError(err.message || "Couldn't submit — try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const approve = async () => {
    if (!checklist?.id) return;
    setApproving(true);
    setActionError(null);
    try {
      await approvePreInstallChecklist(checklist.id, profile.id);
    } catch (err) {
      setActionError(err.message || "Couldn't approve — try again.");
    } finally {
      setApproving(false);
    }
  };

  const missing = missingRequiredFields(checklist);
  const status = !checklist ? "not_started"
    : checklist.approvedForInstallAt ? "approved"
    : checklist.submittedForInstallAt ? "submitted"
    : checklist.completedAt ? "complete"
    : "in_progress";
  const statusMeta = {
    not_started: { label: "Not started", color: T.textFaint },
    in_progress: { label: "In progress", color: T.amber },
    complete: { label: "Complete", color: T.teal },
    submitted: { label: "Submitted for install", color: T.teal },
    approved: { label: "Approved for install", color: T.teal },
  }[status];
  const isOwner = profile?.role === "owner";

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
                <Field label="Preferred installation date or date range" required>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" value={form.preferredInstallStart} onChange={set("preferredInstallStart")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
                    <input type="date" value={form.preferredInstallEnd} onChange={set("preferredInstallEnd")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]" style={{ color: T.textFaint }}>
                    <span>Start</span><span>End (optional, for a range)</span>
                  </div>
                </Field>
                <Field label="Required completion date" required>
                  <input type="date" value={form.requiredCompletionDate} onChange={set("requiredCompletionDate")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
                </Field>
                <Field label="Available installation time window" required>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="time" value={form.installTimeStart} onChange={set("installTimeStart")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
                    <input type="time" value={form.installTimeEnd} onChange={set("installTimeEnd")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]" style={{ color: T.textFaint }}>
                    <span>Start time</span><span>End time</span>
                  </div>
                </Field>
                <Field label="Is this deadline flexible?" required>
                  <Select value={form.deadlineFlexible} onChange={set("deadlineFlexible")} options={[["yes", "Yes"], ["somewhat", "Somewhat"], ["no", "No"]]} />
                </Field>
                <Field label="Tied to an opening, inspection, or event? (optional)">
                  <textarea rows={2} value={form.deadlineEventDetails} onChange={set("deadlineEventDetails")} className="text-sm rounded-lg px-3 py-2 outline-none resize-none" style={inputStyle} />
                </Field>
              </div>

              <div className="flex flex-col gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: T.textFaint }}>Installation Area</div>
                <Field label="Available space (approximate measurements — each chair needs 7ft x 3ft)" required>
                  <input value={form.availableSpace} onChange={set("availableSpace")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
                </Field>
                <Field label="How will the chairs be arranged?" required>
                  <Select value={form.chairArrangement} onChange={set("chairArrangement")} options={CHAIR_ARRANGEMENT_OPTIONS} />
                </Field>
                <Field label="Installation floor and elevator access" required>
                  <Select value={form.floorAccess} onChange={set("floorAccess")} options={FLOOR_ACCESS_OPTIONS} />
                </Field>
                <Field label="Are outlets available near each chair?" required>
                  <Select value={form.outletsNearChairs} onChange={set("outletsNearChairs")} options={YES_NO_NOT_SURE} />
                </Field>
                <Field label="Photos or video link (optional)">
                  <input placeholder="Google Drive, Dropbox, etc." value={form.photosLink} onChange={set("photosLink")} className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle} />
                </Field>
              </div>

              <div className="flex flex-col gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: T.textFaint }}>Delivery &amp; Access</div>
                <Field label="Delivery access" required>
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
                <Field label="Delivery and access instructions" required>
                  <textarea rows={2} placeholder="Receiving hours, parking, check-in, dock access, or 'None.'" value={form.accessInstructions} onChange={set("accessInstructions")} className="text-sm rounded-lg px-3 py-2 outline-none resize-none" style={inputStyle} />
                </Field>
                <Field label="Can someone receive the shipment if it arrives early?" required>
                  <Select value={form.earlyReceipt} onChange={set("earlyReceipt")} options={EARLY_RECEIPT_OPTIONS} />
                </Field>
              </div>

              <Field label="Anything else we should know? (optional)">
                <textarea rows={2} value={form.additionalNotes} onChange={set("additionalNotes")} className="text-sm rounded-lg px-3 py-2 outline-none resize-none" style={inputStyle} />
              </Field>

              {status === "submitted" && !isOwner && (
                <p className="text-xs" style={{ color: T.teal }}>
                  Submitted for installation — waiting on an Owner to approve it.
                </p>
              )}
              {status === "submitted" && isOwner && (
                <p className="text-xs" style={{ color: T.amber }}>
                  Ready for your review — approve it to schedule installation.
                </p>
              )}
              {status === "approved" && (
                <p className="text-xs" style={{ color: T.teal }}>
                  Approved for installation.
                </p>
              )}
              {checklist && !checklist.completedAt && missing.length > 0 && (
                <p className="text-xs" style={{ color: T.textFaint }}>
                  {missing.length} required field{missing.length > 1 ? "s" : ""} left before this can be marked complete: {missing.map(([, label]) => label).join(", ")}
                </p>
              )}
              {actionError && <p className="text-xs" style={{ color: T.red }}>{actionError}</p>}
              {justSaved && !actionError && <p className="text-xs" style={{ color: T.teal }}>Saved.</p>}

              <div className="flex items-center gap-2">
                <button type="submit" disabled={saving} className="text-xs font-medium rounded-lg px-3 py-1.5" style={{ background: T.amber, color: T.bg, opacity: saving ? 0.7 : 1 }}>
                  {saving ? "Saving…" : "Save checklist"}
                </button>
                {checklist && !checklist.completedAt && (
                  <button
                    type="button" onClick={markComplete} disabled={completing || missing.length > 0}
                    className="flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5"
                    style={{
                      border: `1px solid ${T.teal}55`, color: T.teal,
                      opacity: completing ? 0.7 : missing.length > 0 ? 0.4 : 1,
                      cursor: missing.length > 0 ? "not-allowed" : "pointer",
                    }}
                  >
                    <CheckCircle2 size={13} /> {completing ? "Marking…" : "Mark complete"}
                  </button>
                )}
                {status === "complete" && (
                  <button type="button" onClick={submitForInstall} disabled={submitting} className="flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5" style={{ background: T.teal, color: T.bg, opacity: submitting ? 0.7 : 1 }}>
                    <Send size={13} /> {submitting ? "Submitting…" : "Submit for Installation"}
                  </button>
                )}
                {status === "submitted" && isOwner && (
                  <button type="button" onClick={approve} disabled={approving} className="flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5" style={{ background: T.amber, color: T.bg, opacity: approving ? 0.7 : 1 }}>
                    <ShieldCheck size={13} /> {approving ? "Approving…" : "Approve for Installation"}
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
