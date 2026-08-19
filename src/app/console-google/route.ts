import { NextResponse } from "next/server";

/**
 * Server-side launch point for "Sign in with Google" from the registration
 * console — not from this website's own login screen.
 *
 * WHY THIS EXISTS. Google's registered redirect_uri is one fixed URL on this
 * origin (see OAUTH_CALLBACK_BASE_URL on the backend); that is also where the
 * backend sets its oauth_state / oauth_return_to / oauth_client cookies, because
 * that is the origin Google's redirect-back will actually land on. The console
 * lives on a different origin and cannot receive those cookies itself — a
 * cross-origin `fetch` would not carry them back correctly, and there is no
 * second redirect_uri to register for it. So the console does a plain top-level
 * navigation to this route, which does the same origin dance the website's own
 * login screen does — call the backend, capture Set-Cookie, redirect to
 * Google — except as a full page navigation instead of the two-step
 * fetch-then-assign the login screen uses, since there is no page here to hold
 * the fetch result.
 *
 * The `client=console` query param is what makes the callback (on the backend)
 * hand back a console handoff code instead of a website session — see
 * handleGoogleCallback in the backend's auth service.
 */

export const runtime = "nodejs";

function backendUrl(path: string) {
  const base = process.env.REGISTRATION_API_URL?.replace(/\/$/, "") ?? "http://localhost:4000";
  return `${base}${path}`;
}

function safeReturnTo(value: string | null) {
  return value && /^\/(?!\/)/.test(value) ? value : "/";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const failureUrl = new URL("/login", origin);
  failureUrl.searchParams.set("error", "google_unavailable");

  let upstream: Response;
  try {
    upstream = await fetch(
      backendUrl(
        `/api/v1/auth/signin/google?client=console&returnTo=${encodeURIComponent(returnTo)}`,
      ),
      { cache: "no-store" },
    );
  } catch {
    return NextResponse.redirect(failureUrl);
  }

  if (!upstream.ok) return NextResponse.redirect(failureUrl);

  const data = (await upstream.json().catch(() => null)) as { url?: string } | null;
  if (!data?.url) return NextResponse.redirect(failureUrl);

  const response = NextResponse.redirect(data.url, { status: 303 });

  // Same relay as src/app/api/v1/[...path]/route.ts: append, never set — this
  // response carries THREE cookies (oauth_state, oauth_return_to, oauth_client),
  // and `set` would keep only the last, breaking the CSRF-state check on the
  // way back from Google. Domain is left exactly as the backend sent it (unset)
  // so the browser scopes them to this origin, not the backend's.
  const setCookies =
    typeof upstream.headers.getSetCookie === "function" ? upstream.headers.getSetCookie() : [];
  if (setCookies.length) {
    setCookies.forEach((value) => response.headers.append("set-cookie", value));
  } else {
    const combined = upstream.headers.get("set-cookie");
    if (combined) response.headers.append("set-cookie", combined);
  }

  return response;
}
