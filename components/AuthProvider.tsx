"use client";

// Knows who is using the app and hands every page the right DataStore.
//
// Three states: still checking ("loading"), nobody ("signedOut"), or someone
// ("signedIn"). A signed-in session is either a real Supabase user or the
// local demo; the rest of the app doesn't need to care which.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { createSupabaseStore } from "@/lib/data/supabaseStore";
import { createLocalStore, DEMO_USER_ID, hasDemoData, writeDemoData } from "@/lib/data/localStore";
import type { DataStore } from "@/lib/data/store";
import { createSampleData } from "@/lib/demoData";
import { getLocalStorage } from "@/lib/browser";

export type Session =
  | { status: "loading" }
  | { status: "signedOut" }
  | {
      status: "signedIn";
      mode: "supabase" | "demo";
      userId: string;
      email: string | null;
      store: DataStore;
    };

interface AuthContextValue {
  session: Session;
  startDemo: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Remembers that this browser chose the demo, so a reload stays in the demo.
const DEMO_FLAG = "hp-demo-active";

function demoSession(): Session {
  const storage = getLocalStorage();
  // First visit to the demo: fill it with sample classes and history so
  // there's something to look at (including insights, which need history).
  if (!hasDemoData(storage)) writeDemoData(storage, createSampleData(new Date()));
  return {
    status: "signedIn",
    mode: "demo",
    userId: DEMO_USER_ID,
    email: null,
    store: createLocalStore(storage),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>({ status: "loading" });

  useEffect(() => {
    if (getLocalStorage().getItem(DEMO_FLAG) === "1") {
      setSession(demoSession());
      return;
    }
    if (!isSupabaseConfigured) {
      setSession({ status: "signedOut" });
      return;
    }
    const supabase = getSupabase();
    const store = createSupabaseStore(supabase);
    // onAuthStateChange fires right away with the current session (including
    // one just read from a magic link's URL), then again on sign-in/out.
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(
        s
          ? { status: "signedIn", mode: "supabase", userId: s.user.id, email: s.user.email ?? null, store }
          : { status: "signedOut" },
      );
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const startDemo = useCallback(() => {
    getLocalStorage().setItem(DEMO_FLAG, "1");
    setSession(demoSession());
  }, []);

  const signOut = useCallback(async () => {
    if (session.status === "signedIn" && session.mode === "demo") {
      // Leaving the demo keeps its data, so "Try the demo" picks up where you left off.
      getLocalStorage().removeItem(DEMO_FLAG);
      setSession({ status: "signedOut" });
    } else {
      await getSupabase().auth.signOut();
      // onAuthStateChange will also report signedOut; set it now so the UI reacts at once.
      setSession({ status: "signedOut" });
    }
  }, [session]);

  const value = useMemo(() => ({ session, startDemo, signOut }), [session, startDemo, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
