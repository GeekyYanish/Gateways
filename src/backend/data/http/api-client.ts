/**
 * Thin fetch wrapper for the registration backend.
 *
 * See BACKEND-API-CONTRACT.md at the repo root for the endpoints, auth scheme,
 * and error shape this client assumes. Mirrors the Registration Console's
 * client of the same name — kept as two small files rather than a shared
 * package because the two apps otherwise share no code and a package would
 * outlive its usefulness the moment one side's error handling diverges.
 */

import { DataError, type DataErrorCode } from "../types";

const BASE_URL = process.env.PARALLAX_API_BASE_URL;

/** True when a backend base URL is configured — the swap point in `../index.ts` checks this. */
export function hasApiBackend(): boolean {
  return Boolean(BASE_URL);
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

function buildUrl(path: string, query?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(path.replace(/^\//, ""), BASE_URL?.endsWith("/") ? BASE_URL : `${BASE_URL}/`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

/**
 * `authToken` is the participant's own Auth.js session token (contract §2 —
 * participant calls, not staff calls). Passed in per-request rather than read
 * from a module-level singleton because this module has no access to the
 * request/session context; callers in the repository layer supply it.
 */
async function request<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  opts: {
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
    authToken?: string;
  } = {},
): Promise<T> {
  if (!BASE_URL) {
    throw new DataError("STORAGE_UNAVAILABLE", "PARALLAX_API_BASE_URL is not configured.");
  }

  const res = await fetch(buildUrl(path, opts.query), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(opts.authToken ? { Authorization: `Bearer ${opts.authToken}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });

  if (res.status === 204) return undefined as T;

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // No body — fine for some 2xx responses, fatal for error statuses (handled below).
  }

  if (!res.ok) {
    const body = (json ?? {}) as ApiErrorBody;
    const code = (body.error?.code as DataErrorCode | undefined) ?? "STORAGE_UNAVAILABLE";
    throw new DataError(code, body.error?.message ?? `Request failed: ${method} ${path} (${res.status})`);
  }

  return json as T;
}

export const api = {
  get: <T>(path: string, query?: Record<string, string | number | boolean | undefined>, authToken?: string) =>
    request<T>("GET", path, { query, authToken }),
  post: <T>(path: string, body?: unknown, authToken?: string) => request<T>("POST", path, { body, authToken }),
  patch: <T>(path: string, body?: unknown, authToken?: string) => request<T>("PATCH", path, { body, authToken }),
};
