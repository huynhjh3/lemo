import React from "react";
import { Users } from "lucide-react";
import { T, ROLE_LABELS } from "../theme.js";
import { Card, CardTitle } from "../components/ui.jsx";

export default function TeamPage({ profiles }) {
  return (
    <div>
      <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }} className="mb-5">Team</h1>
      <Card>
        <CardTitle icon={Users}>Members</CardTitle>
        {profiles.length === 0 ? (
          <p className="text-xs" style={{ color: T.textFaint }}>No team members found.</p>
        ) : (
          <div className="flex flex-col">
            {profiles.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm py-2.5" style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                <span style={{ color: T.text }}>{p.name}</span>
                <span
                  className="text-[11px] px-2 py-0.5 rounded-full uppercase tracking-wide"
                  style={{ color: p.role === "owner" ? T.amber : T.textDim, background: p.role === "owner" ? `${T.amber}14` : T.surface2, fontFamily: T.fontMono }}
                >
                  {ROLE_LABELS[p.role] || p.role}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs mt-4" style={{ color: T.textFaint }}>
          New members are added by an owner in the Supabase dashboard — see SETUP.md.
        </p>
      </Card>
    </div>
  );
}
