import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = not yet resolved
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  // Captured once, synchronously, on first render — before supabase-js's own
  // async URL processing clears the hash. An invite link (unlike a recovery
  // link) fires a plain SIGNED_IN event, so the hash is the only reliable
  // way to tell "just accepted an invite, hasn't set a password yet" apart
  // from an ordinary sign-in.
  const [isInviteFlow, setIsInviteFlow] = useState(
    () => typeof window !== "undefined" && window.location.hash.includes("type=invite")
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Keyed on the user id, not the session object — Supabase silently swaps in a
  // new session object (same user) on every background token refresh (e.g. when
  // a backgrounded tab regains focus), which would otherwise re-run this, flip
  // `loading` back to true, and unmount/remount the whole app for no reason.
  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    supabase
      .from("profiles")
      .select("id, name, role, region, is_master_admin")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data);
        setProfileLoading(false);
      });
  }, [userId]);

  const signOut = () => supabase.auth.signOut();

  const value = {
    loading: session === undefined || (session && profileLoading),
    session,
    profile,
    signOut,
    isInviteFlow,
    clearInviteFlow: () => setIsInviteFlow(false),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
