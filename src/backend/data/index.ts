import type { Repository } from "./repository";
import { createLocalRepository } from "./local/local-repository";

/**
 * THE SINGLE SWAP POINT.
 *
 * When the MySQL backend lands, this file changes by one line:
 *
 *   const repo = createMySqlRepository();
 *
 * Nothing else in the app imports a concrete implementation — screens and hooks
 * only ever see the `Repository` interface. See MYSQL-MIGRATION.md.
 */

let instance: Repository | null = null;

/**
 * Lazily constructed so importing this module has no side effects (the local
 * implementation touches localStorage, which does not exist during SSR).
 */
export function getRepo(): Repository {
  if (!instance) instance = createLocalRepository();
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
