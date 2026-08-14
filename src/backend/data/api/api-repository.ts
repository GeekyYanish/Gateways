/**
 * The Repository backed by the real Gateways backend
 * (github.com/DarshanHeble/gateways2026_backend), for the parts of it that
 * actually exist.
 *
 * WHAT THE BACKEND SERVES TODAY. Its `src/routes/index.ts` registers four
 * groups and no more — verified against its own `route-inventory.test.ts`:
 *
 *     /api/v1/auth/*              signup, verify-email, signin, signout,
 *                                 session, google sign-in + callback
 *     /api/v1/payment-receipts/*  submit, and the caller's own receipt
 *     /api/v1/admin/auth/*        \  admin surface, not used by this app
 *     /api/v1/admin/payments/*    /
 *
 * WHAT IT DOES NOT SERVE. Route files exist for events, characters, teams, xp,
 * leaderboard, achievements, announcements, reference, registrations,
 * attendance and profiles — but they are never registered, on any branch, so
 * they are unreachable. Those eleven domains therefore keep the local
 * implementation, unchanged.
 *
 * This is not a permanent arrangement, and it is deliberately trivial to undo:
 * when the backend registers a route, write its API implementation and swap the
 * one line below. No screen changes, because nothing outside this folder knows
 * which implementation it is talking to.
 *
 * NOT to be confused with `../http/http-repository.ts`, which targets the draft
 * contract in `registration-console/BACKEND-API-CONTRACT.md` — a different API
 * that no deployed service implements.
 */

import type { Repository } from "../repository";
import { createLocalRepository } from "../local/local-repository";
import { ApiAuth } from "./api-auth";
import { ApiPaymentReceipts } from "./api-payment-receipts";
import { ApiCharacters, ApiEvents, ApiProfiles, ApiReference, ApiRegistrations, ApiTeams } from "./api-core-repository";

export function createApiRepository(): Repository {
  const paymentReceipts = new ApiPaymentReceipts();
  const local = createLocalRepository({ paymentReceiptLookup: (userId) => paymentReceipts.getByUser(userId) });

  return {
    // ── Served by the backend ────────────────────────────────────────────────
    auth: new ApiAuth(),
    paymentReceipts,

    // ── Core participant data is database-backed ────────────────────────────
    profiles: new ApiProfiles(),
    characters: new ApiCharacters(),
    events: new ApiEvents(),
    registrations: new ApiRegistrations(),
    teams: new ApiTeams(),
    attendance: local.attendance,
    achievements: local.achievements,
    xp: local.xp,
    leaderboard: local.leaderboard,
    announcements: local.announcements,
    reference: new ApiReference(),
  };
}
