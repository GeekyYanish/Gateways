"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BlockButton, BlockPanel, LoadingScreen } from "@/frontend/components/mc";
import { useSession } from "@/frontend/components/auth/session-provider";
import { repo } from "@/backend/data";
import { DataError } from "@/backend/data/types";

/**
 * Lands here when the registration console hands a staff session back to the
 * website (the reverse of the console-handoff on the login screen). Exchanges
 * the one-time code for the website's own cookie session, then continues to
 * wherever the console sent them.
 */
export function ConsoleReturnScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useSession();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = params.get("code");
    if (!code) {
      setError("This sign-in link is missing its code.");
      return;
    }

    (async () => {
      try {
        if (!repo.auth.exchangeWebsiteHandoff) {
          throw new DataError("VALIDATION_FAILED", "This backend does not support console handoff.");
        }
        const { returnTo } = await repo.auth.exchangeWebsiteHandoff(code);
        await refresh();
        router.replace(returnTo || "/");
      } catch (e) {
        setError(e instanceof DataError ? e.message : "This sign-in link is invalid or expired.");
      }
    })();
    // Runs once on mount; `code` is read from the immutable params snapshot above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <BlockPanel variant="card" padded="lg" className="mx-auto max-w-md text-center">
        <p className="text-mc-danger">{error}</p>
        <BlockButton
          variant="portal"
          size="lg"
          className="mt-[calc(var(--mc-unit)*1.5)]"
          onClick={() => router.replace("/login")}
        >
          Back to sign in
        </BlockButton>
      </BlockPanel>
    );
  }

  return <LoadingScreen label="Returning to the website" />;
}
