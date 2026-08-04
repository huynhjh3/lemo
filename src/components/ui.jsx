import React from "react";
import { Wifi, WifiOff } from "lucide-react";
import { T, STATUS_META } from "../theme.js";

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

export function DeviceStatus({ status }) {
  const online = status === "online";
  const Icon = online ? Wifi : WifiOff;
  const c = online ? T.teal : T.red;
  return (
    <span className="inline-flex items-center gap-1 text-xs" style={{ color: c, fontFamily: T.fontMono }}>
      <Icon size={12} /> {online ? "online" : "offline"}
    </span>
  );
}

export function Card({ children, className = "", style = {}, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl p-5 ${className}`}
      style={{ background: T.surface, border: `1px solid ${T.border}`, cursor: onClick ? "pointer" : undefined, ...style }}
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
    Negotiation: T.amber, Installed: T.teal, "Stay in Contact": T.red,
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
