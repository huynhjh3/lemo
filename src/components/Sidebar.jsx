import React from "react";
import {
  LayoutDashboard, Building2, BarChart3, Workflow, Users as UsersIcon, LogOut, UploadCloud, Wrench, BookOpen, Calendar, ShieldAlert,
} from "lucide-react";
import { T, ROLE_LABELS } from "../theme.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Sidebar({ page, setPage, setSelectedCompanyId }) {
  const { profile, signOut } = useAuth();
  const isGeoPartner = profile?.role === "geo_partner";
  const isOwner = profile?.role === "owner";
  const isBdConsultant = profile?.role === "bd_consultant";
  const showsRegion = isGeoPartner || isBdConsultant;
  const items = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "companies", label: "Companies", icon: Building2 },
    { id: "revenue", label: "Revenue", icon: BarChart3 },
    { id: "pipeline", label: "Pipeline", icon: Workflow },
    { id: "showroom", label: "Showroom", icon: Calendar },
    // Operations SOP is a BD Consultant-only onboarding/reference guide.
    ...(isBdConsultant ? [{ id: "how-to", label: "Operations SOP", icon: BookOpen }] : []),
    // Upload CSV, Team, and Management Tool are owner-only back-office pages.
    ...(isOwner ? [
      { id: "upload", label: "Upload CSV", icon: UploadCloud },
      { id: "team", label: "Team", icon: UsersIcon },
      { id: "management-tool", label: "Management Tool", icon: Wrench },
    ] : []),
  ];
  const initials = profile?.name
    ? profile.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <div
      className="flex flex-col justify-between shrink-0"
      style={{ width: 220, background: T.surface, borderRight: `1px solid ${T.border}`, height: "100%" }}
    >
      <div>
        <div className="flex items-center px-5 py-5" style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
          <img src="/lemo-logo.png" alt="Lemo" style={{ height: 28, width: "auto" }} />
        </div>
        <nav className="px-3 py-4 flex flex-col gap-1">
          {items.map((it) => {
            const active = page === it.id;
            return (
              <button
                key={it.id}
                onClick={() => {
                  if (it.external) {
                    window.open(it.external, "_blank", "noopener,noreferrer");
                    return;
                  }
                  setPage(it.id);
                  setSelectedCompanyId(null);
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
                style={{
                  background: active ? T.surface2 : "transparent",
                  color: active ? T.amber : T.textDim,
                  fontFamily: T.fontBody, fontWeight: active ? 600 : 500,
                  borderLeft: active ? `2px solid ${T.amber}` : "2px solid transparent",
                }}
              >
                <it.icon size={16} />
                {it.label}
              </button>
            );
          })}
        </nav>
      </div>
      {isBdConsultant && (
        <div className="px-4 py-2.5 flex items-start gap-1.5" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
          <ShieldAlert size={12} style={{ color: T.red, marginTop: 1, flexShrink: 0 }} />
          <span className="text-[10px]" style={{ color: T.red, fontFamily: T.fontMono, lineHeight: 1.3 }}>
            Do not share login credentials or LEMO company property
          </span>
        </div>
      )}
      <div className="px-5 py-4 flex items-center gap-2" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
        <div
          className="rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
          style={{ width: 28, height: 28, background: T.surface2, color: T.teal, fontFamily: T.fontMono }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate" style={{ color: T.text }}>{profile?.name || "…"}</div>
          <div className="text-[11px]" style={{ color: T.textFaint }}>
            {ROLE_LABELS[profile?.role] || profile?.role}
            {showsRegion && profile?.region ? ` · ${profile.region}` : ""} · Lemo
          </div>
        </div>
        <button onClick={signOut} title="Sign out" style={{ color: T.textFaint }}>
          <LogOut size={15} />
        </button>
      </div>
    </div>
  );
}
