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
import { clearWelcomed } from "@/frontend/lib/welcome-store";
import type { Character, Session } from "@/backend/data/types";

/**
 * Session + character context.
 *
 * The website reads the authenticated session and the backend-created default
 * character through the repository adapters. Character creation is no longer a
 * separate route: username signup or Google OAuth creates the row automatically.
 *
 * `status` distinguishes three states the UI must render differently:
 *   loading           — do not redirect yet; we do not know if there is a session
 *   unauthenticated   — send to /login
 *   ready             — signed in and ready for the realm
 */
export type AuthStatus =
  | "loading"
  | "unauthenticated"
  | "needs-password"
  | "staff"
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
    try {
      const s = await repo.auth.getSession();
      setSession(s);
      setCharacter(s && !s.mustChangePassword && !s.roles.some((role) => ["admin", "organizer", "scanner"].includes(role))
        ? await repo.characters.getByUser(s.userId)
        : null);
    } catch (error) {
      // A down or unreachable backend is not the same thing as "signed out",
      // but the whole app must still render for a visitor browsing public
      // pages — treat it as signed out rather than leaving every consumer
      // (RealmGuard included) stuck on `status: "loading"` forever.
      console.error("Could not load the session; treating as signed out.", error);
      setSession(null);
      setCharacter(null);
    } finally {
      setLoading(false);
    }
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
    // So the next sign-in is greeted again, rather than only after the tab is
    // closed — sessionStorage would otherwise outlive the session it names.
    clearWelcomed();
  }, []);

  const status: AuthStatus = loading
    ? "loading"
    : !session
      ? "unauthenticated"
      : session.mustChangePassword
        ? "needs-password"
        : session.roles.some((role) => ["admin", "organizer", "scanner"].includes(role))
          ? "staff"
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
