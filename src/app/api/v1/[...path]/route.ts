import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Same-origin proxy to the Gateways backend.
 *
 * WHY A PROXY AND NOT DIRECT CALLS. The backend issues its session as
 * `__session` with `sameSite: 'lax'`. Browsers do not attach a Lax cookie to a
 * cross-site `fetch`, so a browser on the frontend origin calling the backend
 * origin directly would never send it — authentication cannot work that way, and
 * no amount of CORS configuration changes it.
 *
 * Routing every call through here means the browser only ever talks to ONE
 * origin. `__session` and `csrf_token` come back through this handler and are
 * set on the frontend origin, which makes them first-party. Three things follow:
 * Lax keeps working, CORS never applies (a server-to-server request sends no
 * `Origin`), and third-party-cookie blocking in Safari/Chrome is irrelevant.
 * The backend needs no changes at all.
 *
 * The cost is one extra hop, and the frontend server must be able to reach the
 * backend — this is a server-side URL, deliberately not `NEXT_PUBLIC_`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Headers that describe a single network hop rather than the message. Forwarding
 * them corrupts the second hop — `content-length` in particular, because the
 * body is re-encoded below and the original length no longer applies.
 *
 * `cookie` is deliberately NOT here: passing it through is the entire point.
 */
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

// Node's fetch transparently decompresses Brotli/gzip responses. Once the
// decoded body is buffered below, forwarding the upstream encoding header
// would make the browser try to decompress an already-decoded payload.
const DECODED_BODY_HEADERS = new Set(["content-encoding", "content-length"]);

function backendBase(): string | null {
  return process.env.REGISTRATION_API_URL?.replace(/\/$/, "") ?? null;
}

function errorResponse(
  code: string,
  message: string,
  status: number,
  correlationId: string,
  retryable: boolean,
) {
  return NextResponse.json(
    { error: { code, message, statusCode: status, retryable, correlationId } },
    { status, headers: { "x-correlation-id": correlationId } },
  );
}

/**
 * Takes only the Request. The `[...path]` segment is still what routes traffic
 * here, but the path is read from `request.url` rather than the params object —
 * see the note on trailing slashes below.
 */
async function forward(request: Request) {
  const correlationId =
    request.headers.get("x-correlation-id") ?? randomUUID();

  const base = backendBase();
  if (!base) {
    // Configuration fault, not an outage. Saying so plainly here saves the next
    // person the hour it otherwise costs to discover: an unset variable and an
    // unreachable backend are indistinguishable from the browser.
    return errorResponse(
      "BACKEND_NOT_CONFIGURED",
      "REGISTRATION_API_URL is not set on the frontend server.",
      500,
      correlationId,
      false,
    );
  }

  const incoming = new URL(request.url);

  /**
   * Take the path from the RAW URL, not from `context.params`.
   *
   * `params.path` is normalised: `/api/v1/payment-receipts/` arrives as
   * `["payment-receipts"]`, losing the trailing slash. The backend registers
   * that endpoint as `POST /` under a `/payment-receipts` prefix and Fastify
   * does not ignore trailing slashes, so forwarding the slash-less form 404s.
   * `incoming.pathname` still carries it verbatim.
   *
   * (`skipTrailingSlashRedirect` in next.config.ts is what stops Next from
   * redirecting the slash away before this handler is ever reached. Both parts
   * are needed.)
   */
  const suffix = incoming.pathname.replace(/^\/api\/v1/, "");
  const target = new URL(`/api/v1${suffix}${incoming.search}`, base);

  /**
   * `new URL()` resolves `..` segments, so a crafted path like
   * `/api/v1/../../admin` would silently retarget the backend outside the
   * intended prefix. Confirm after resolution, not before.
   */
  if (!target.pathname.startsWith("/api/v1/") && target.pathname !== "/api/v1") {
    return errorResponse(
      "VALIDATION_FAILED",
      "Invalid request path.",
      400,
      correlationId,
      false,
    );
  }

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });
  headers.set("x-correlation-id", correlationId);
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", incoming.protocol.replace(":", ""));

  const isRead = request.method === "GET" || request.method === "HEAD";
  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
    // The backend's free-tier instance can hibernate on idle; a cold start
    // takes real time to boot the process and its DB pool. These bounds give
    // a woken-but-still-warming backend room to finish rather than timing out
    // mid-boot — Vercel's own function execution limit is far above either.
    // Receipt uploads are the other slow case; the backend caps them at 8MB.
    signal: AbortSignal.timeout(isRead ? 15_000 : 45_000),
  };

  if (!isRead) {
    /**
     * BUFFERED, NOT STREAMED — and this is not a preference.
     *
     * Passing `request.body` through with `duplex: "half"` fails inside undici
     * with "expected non-null body source". It surfaces as a bare `TypeError`,
     * which this handler would then report as BACKEND_UNAVAILABLE — so every
     * sign-in, sign-up and upload fails with an error that blames the backend
     * while the backend is perfectly healthy. Diagnosed the hard way on exactly
     * this code.
     *
     * The trade is that a request body is held in memory for the length of the
     * hop. The backend's own 8MB limit already bounds that.
     */
    const body = await request.arrayBuffer();
    if (body.byteLength) init.body = body;
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (error) {
    // Never surface `target` — it would leak the backend's address to the
    // browser, which is the one thing this indirection is meant to keep private.
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return errorResponse(
      "BACKEND_UNAVAILABLE",
      timedOut
        ? "The registration service did not respond in time."
        : "The registration service is temporarily unavailable.",
      timedOut ? 504 : 503,
      correlationId,
      true,
    );
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    // `set-cookie` is handled separately below — a plain copy collapses repeats.
    if (
      lower !== "set-cookie" &&
      !HOP_BY_HOP.has(lower) &&
      !DECODED_BODY_HEADERS.has(lower)
    ) {
      responseHeaders.set(key, value);
    }
  });
  responseHeaders.set("x-correlation-id", correlationId);

  /**
   * Relay cookies with `append`, never `set`.
   *
   * Sign-in returns TWO — `__session` and `csrf_token` — and `set` would keep
   * only the last, leaving the client authenticated but unable to pass the CSRF
   * double-submit check on its next mutation.
   *
   * `Domain` is deliberately left exactly as the backend sent it (unset), so the
   * browser scopes both cookies to the frontend origin. Rewriting it to the
   * backend's host would make them cross-site again and undo the proxy.
   */
  const setCookies =
    typeof upstream.headers.getSetCookie === "function"
      ? upstream.headers.getSetCookie()
      : [];
  if (setCookies.length) {
    setCookies.forEach((value) => responseHeaders.append("set-cookie", value));
  } else {
    const combined = upstream.headers.get("set-cookie");
    if (combined) responseHeaders.append("set-cookie", combined);
  }

  // 204/304 must not carry a body, and passing one through makes undici throw.
  const bodyless = upstream.status === 204 || upstream.status === 304;
  // Buffer the response because Node fetch transparently decodes compressed
  // upstream bodies. Relaying `upstream.body` with its original encoding
  // metadata can produce an empty/corrupt response at the Vercel boundary.
  const responseBody = bodyless ? null : await upstream.arrayBuffer();
  return new NextResponse(responseBody, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const OPTIONS = forward;
export const HEAD = forward;
