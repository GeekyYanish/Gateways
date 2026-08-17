import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fire-and-forget backend warm-up ping.
 *
 * The backend's free-tier instance can hibernate on idle, and a cold start
 * takes real time — long enough that a user who lands on the login page and
 * immediately submits can hit the timeout before the backend finishes
 * booting. The login screen calls this on mount, before the user has
 * finished typing, so the wake-up cost is paid in the background instead of
 * during their actual sign-in request.
 *
 * Bare `/health` on the backend, NOT through the `/api/v1/*` proxy — that
 * proxy always prefixes `/api/v1`, and `/health` is deliberately unversioned
 * (see the backend's own route-inventory test).
 */
async function warmup() {
  const base = process.env.REGISTRATION_API_URL?.replace(/\/$/, "");
  if (!base) return NextResponse.json({ ok: false, reason: "not_configured" });

  try {
    const res = await fetch(`${base}/health`, {
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    });
    return NextResponse.json({ ok: res.ok });
  } catch {
    return NextResponse.json({ ok: false, reason: "unreachable" });
  }
}

export const GET = warmup;
