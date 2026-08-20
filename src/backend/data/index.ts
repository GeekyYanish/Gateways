import type { Repository } from "./repository";
import { createLocalRepository } from "./local/local-repository";
import { createHttpRepository } from "./http/http-repository";
import { hasApiBackend } from "./http/api-client";
import { createApiRepository } from "./api/api-repository";

/**
 * THE SINGLE SWAP POINT.
 *
 * Two separate backends can land here, and they are not the same thing:
 *
 *   - The in-repo MySQL plan (MYSQL-MIGRATION.md) is Parallax's own game
 *     backend — XP, characters, achievements — and would replace
 *     `createLocalRepository()` wholesale with `createMySqlRepository()`.
 *   - The registration/ops backend (BACKEND-API-CONTRACT.md) is a separate
 *     service the Registration Console also talks to. `createHttpRepository()`
 *     below only points `profiles` and `registrations` at it — see that
 *     file's header for exactly what's covered and what still falls back to
 *     local data.
 *
 * Nothing else in the app imports a concrete implementation — screens and hooks
 * only ever see the `Repository` interface.
 */

let instance: Repository | null = null;

/**
 * Lazily constructed so importing this module has no side effects (the local
 * implementation touches localStorage, which does not exist during SSR).
 *
 * THREE implementations, picked in order:
 *
 *   1. `ApiRepository`   — the real Gateways backend, when it is configured.
 *                          Serves auth and payment receipts; everything else
 *                          delegates to local because the backend registers no
 *                          route for it. See `./api/api-repository.ts`.
 *   2. `HttpRepository`  — the DRAFT contract in
 *                          registration-console/BACKEND-API-CONTRACT.md. A
 *                          different API that nothing implements; kept only so
 *                          the shape survives until someone builds it.
 *   3. `LocalRepository` — fully local. Dev and /dev/data-test rely on this.
 *
 * The API implementation is chosen on `USE_API_BACKEND` rather than
 * the proxy's own `REGISTRATION_API_URL`: that one is a server-side variable
 * (deliberately, so the backend's address never reaches the browser), and this
 * decision has to be made in client components too.
 */
export function getRepo(): Repository {
  if (!instance) {
    instance = isApiBackendEnabled()
      ? createApiRepository()
      : hasApiBackend()
        ? createHttpRepository()
        : createLocalRepository();
  }
  return instance;
}

/**
 * True when the app should talk to the real Gateways backend.
 *
 * Named `is…` rather than `use…` deliberately: a plain predicate with a `use`
 * prefix reads as a React hook and is linted as one.
 */
export function isApiBackendEnabled(): boolean {
  return process.env.USE_API_BACKEND === "true";
}

/** Convenience accessor. Prefer this in client components. */
export const repo = new Proxy({} as Repository, {
  get(_target, prop) {
    return getRepo()[prop as keyof Repository];
  },
});

export type { Repository } from "./repository";
export * from "./types";
export type { PaymentReceipt, PaymentVerificationStatus } from "./types";
export { xpProgress } from "./local/local-repository";
