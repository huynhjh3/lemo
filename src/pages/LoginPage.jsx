import React, { useState } from "react";
import { Loader2, Wifi } from "lucide-react";
import { T } from "../theme.js";
import { Card } from "../components/ui.jsx";
import { supabase } from "../lib/supabaseClient.js";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div
      className="flex items-center justify-center"
      style={{ minHeight: "100vh", background: T.bg, fontFamily: T.fontBody }}
    >
      <div className="w-full" style={{ maxWidth: 360 }}>
        <div className="flex items-center gap-2 justify-center mb-6">
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
        <Card>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: T.textFaint }}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody }}
              />
            </div>
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: T.textFaint }}>Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: T.fontBody }}
              />
            </div>
            {error && <div className="text-xs" style={{ color: T.red }}>{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 text-sm font-medium rounded-lg py-2.5 mt-1"
              style={{ background: T.amber, color: T.bg, fontFamily: T.fontBody, opacity: loading ? 0.7 : 1 }}
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? "Signing in…" : "Sign in"}
            </button>
            <p className="text-xs text-center" style={{ color: T.textFaint }}>
              Accounts are created by your admin — contact them if you need access.
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
