"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { repo } from "@/backend/data";
import type { Character, Session } from "@/backend/data/types";

/**
 * Session + character context.
 *
 * The whole app is client-side for now because localStorage has no server
 * presence. After the MySQL migration this becomes a server-component read
 * plus a thin client provider, and route protection moves into middleware —
 * see MYSQL-MIGRATION.md.
 *
 * `status` distinguishes three states the UI must render differently:
 *   loading           — do not redirect yet; we do not know if there is a session
 *   unauthenticated   — send to /login
 *   needs-character   — signed in but has not created an adventurer yet
 *   ready             — fully set up
 */
export type AuthStatus =
  | "loading"
  | "unauthenticated"
  | "needs-character"
  | "ready";

interface SessionContextValue {
  status: AuthStatus;
  session: Session | null;
  character: Character | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const s = await repo.auth.getSession();
    setSession(s);
    setCharacter(s ? await repo.characters.getByUser(s.userId) : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Subscribing to an external system (the session store) and reading its
    // current value is precisely what an effect is for. The lint rule below
    // cannot see that load()'s setState calls happen after an await rather than
    // synchronously in the effect body, so it flags a cascade that cannot occur.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();

    // Fires on sign-in/out in this tab AND in other tabs, so two open tabs stay
    // consistent — the same guarantee the server-backed session read must give.
    const unsub = repo.auth.onAuthStateChange(() => {
      void load();
    });
    return unsub;
  }, [load]);

  const signOut = useCallback(async () => {
    await repo.auth.signOut();
    setSession(null);
    setCharacter(null);
  }, []);

  const status: AuthStatus = loading
    ? "loading"
    : !session
      ? "unauthenticated"
      : !character
        ? "needs-character"
        : "ready";

  const value = useMemo(
    () => ({ status, session, character, refresh: load, signOut }),
    [status, session, character, load, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used inside <SessionProvider>.");
  }
  return ctx;
}
