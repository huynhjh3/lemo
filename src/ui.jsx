import React from "react";
import { Wifi, WifiOff } from "lucide-react";
import { T, STATUS_META } from "./theme.js";

export function StatusDot({ status, size = 8 }) {
  const c = STATUS_META[status]?.color || T.textFaint;
  return (
    <span
      style={{
        display: "inline-block", width: size, height: size, borderRadius: "50%",
        background: c, boxShadow: `0 0 6px ${c}99`, flexShrink: 0,
      }}
    />
  );
}

export function ChairStatus({ status }) {
  if (status === "retired") {
    return <span className="text-xs" style={{ color: T.textFaint, fontFamily: T.fontMono }}>retired</span>;
  }
  const online = status === "online";
  const Icon = online ? Wifi : WifiOff;
  const c = online ? T.teal : T.red;
  return (
    <span className="inline-flex items-center gap-1 text-xs" style={{ color: c, fontFamily: T.fontMono }}>
      <Icon size={12} /> {online ? "online" : "offline"}
    </span>
  );
}

export function Card({ children, className = "", style = {} }) {
  return (
    <div
      className={`rounded-xl p-5 ${className}`}
      style={{ background: T.surface, border: `1px solid ${T.border}`, ...style }}
    >
      {children}
    </div>
  );
}

export function CardTitle({ icon: Icon, children, right }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} style={{ color: T.amber }} />}
        <h3 className="text-sm font-semibold tracking-wide" style={{ color: T.text, fontFamily: T.fontDisplay }}>
          {children}
        </h3>
      </div>
      {right}
    </div>
  );
}

export function StageBadge({ stage }) {
  const map = {
    Lead: T.textDim, Contacted: T.textDim, Proposal: T.amber,
    Negotiation: T.amber, Won: T.teal, Lost: T.red,
  };
  const c = map[stage] || T.textDim;
  return (
    <span
      className="text-[11px] px-2 py-0.5 rounded-full font-medium"
      style={{ color: c, border: `1px solid ${c}55`, background: `${c}14`, fontFamily: T.fontMono }}
    >
      {stage}
    </span>
  );
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-xl p-5 w-full overflow-y-auto"
        style={{ background: T.surface, border: `1px solid ${T.border}`, maxWidth: wide ? 640 : 440, maxHeight: "85vh" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontFamily: T.fontDisplay, fontSize: 16, fontWeight: 600, color: T.text }}>{title}</h3>
          <button onClick={onClose} className="text-xs" style={{ color: T.textFaint }}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div className="mb-3">
      <label className="text-xs mb-1.5 block" style={{ color: T.textFaint }}>{label}</label>
      {children}
    </div>
  );
}

export const inputStyle = {
  background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody,
};
