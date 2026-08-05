import React, { useState } from "react";
import { Loader2, Wifi } from "lucide-react";
import { T } from "../theme.js";
import { Card } from "../components/ui.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { useAuth } from "../context/AuthContext.jsx";

// Landing screen for a fresh invite link (see AuthContext's isInviteFlow) —
// the person has a valid session from the link but has never set a
// password, so they can't log back in again until they do.
export default function AcceptInvitePage() {
  const { profile, clearInviteFlow } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    window.history.replaceState(null, "", window.location.pathname);
    clearInviteFlow();
  };

  return (
    <div className="flex items-center justify-center" style={{ minHeight: "100vh", background: T.bg, fontFamily: T.fontBody }}>
      <div className="w-full" style={{ maxWidth: 360 }}>
        <div className="flex items-center gap-2 justify-center mb-6">
          <div className="flex items-center justify-center rounded-lg" style={{ width: 30, height: 30, background: T.amber }}>
            <Wifi size={16} color={T.bg} />
          </div>
          <span style={{ fontFamily: T.fontDisplay, fontWeight: 700, letterSpacing: 1, color: T.text, fontSize: 17 }}>LEMO</span>
        </div>
        <Card>
          <p className="text-sm mb-4" style={{ color: T.text }}>
            Welcome{profile?.name ? `, ${profile.name}` : ""} — set a password to finish setting up your account.
          </p>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: T.textFaint }}>New password</label>
              <input
                type="password" required minLength={8}
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody }}
              />
            </div>
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: T.textFaint }}>Confirm password</label>
              <input
                type="password" required minLength={8}
                value={confirm} onChange={(e) => setConfirm(e.target.value)}
                className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody }}
              />
            </div>
            {error && <div className="text-xs" style={{ color: T.red }}>{error}</div>}
            <button
              type="submit" disabled={loading}
              className="flex items-center justify-center gap-2 text-sm font-medium rounded-lg py-2.5 mt-1"
              style={{ background: T.amber, color: T.bg, fontFamily: T.fontBody, opacity: loading ? 0.7 : 1 }}
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? "Saving…" : "Set password & continue"}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
