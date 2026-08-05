import React from "react";
import {
  LayoutDashboard, Building2, BarChart3, Workflow, Users as UsersIcon, Wifi, LogOut, UploadCloud,
} from "lucide-react";
import { T, ROLE_LABELS } from "../theme.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Sidebar({ page, setPage, setSelectedCompanyId }) {
  const { profile, signOut } = useAuth();
  const isGeoPartner = profile?.role === "geo_partner";
  const isOwner = profile?.role === "owner";
  const showsRegion = isGeoPartner || profile?.role === "bd_consultant";
  const items = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "companies", label: "Companies", icon: Building2 },
    { id: "revenue", label: "Revenue", icon: BarChart3 },
    { id: "pipeline", label: "Pipeline", icon: Workflow },
    // Upload CSV and Team are owner-only back-office pages.
    ...(isOwner ? [
      { id: "upload", label: "Upload CSV", icon: UploadCloud },
      { id: "team", label: "Team", icon: UsersIcon },
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
        <div className="flex items-center gap-2 px-5 py-5" style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
          <div
            className="flex items-center justify-center rounded-lg"
            style={{ width: 30, height: 30, background: T.amber }}
          >
            <Wifi size={16} color={T.bg} />
          </div>
          <span style={{ fontFamily: T.fontDisplay, fontWeight: 700, letterSpacing: 1, color: T.text, fontSize: 17 }}>
            LEMO
          </span>
        </div>
        <nav className="px-3 py-4 flex flex-col gap-1">
          {items.map((it) => {
            const active = page === it.id;
            return (
              <button
                key={it.id}
                onClick={() => { setPage(it.id); setSelectedCompanyId(null); }}
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
