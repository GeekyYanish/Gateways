import type { Repository } from "./repository";
import { createLocalRepository } from "./local/local-repository";
import { createHttpRepository } from "./http/http-repository";
import { hasApiBackend } from "./http/api-client";

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
 * Picks HttpRepository when PARALLAX_API_BASE_URL is set, otherwise the fully
 * local mock, so dev and /dev/data-test are unaffected until the registration
 * backend is actually live.
 */
export function getRepo(): Repository {
  if (!instance) instance = hasApiBackend() ? createHttpRepository() : createLocalRepository();
  return instance;
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
