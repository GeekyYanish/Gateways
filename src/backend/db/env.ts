import "server-only";

import { z } from "zod";

/**
 * Validated server-side configuration.
 *
 * Person 1 owns this file (see PARALLAX Backend Implementation Plan, §4).
 *
 * Two rules this file exists to enforce:
 *
 *  1. The process fails LOUDLY at startup for a missing or malformed variable,
 *     rather than at 2am on the first request that happens to touch the writer
 *     pool. Acceptance evidence for the plan's `loadConfig` row is exactly this:
 *     "startup test fails clearly for each missing or malformed variable".
 *
 *  2. Placeholders are rejected. A `.env.local` copied from `.env.example` and
 *     half-filled is the single most common way a preproduction credential
 *     silently reaches production, so an unedited template value is an error,
 *     not a default.
 *
 * `import "server-only"` makes importing this from a client component a BUILD
 * error, not a runtime leak. Never remove it.
 */

/**
 * Values that mean "someone forgot to fill this in". Matched case-insensitively
 * against the trimmed value.
 */
const PLACEHOLDER =
  /^(changeme|change_me|placeholder|todo|tbd|x{3,}|<.*>|your[-_ ].*|\.\.\.)$/i;

const nonPlaceholder = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} must not be empty`)
    .refine(
      (v) => !PLACEHOLDER.test(v),
      `${label} still contains an unfilled placeholder value`,
    );

/**
 * A MySQL connection URL.
 *
 * NOTE ON TLS: `MYSQL-MIGRATION.md` suggests `?ssl-mode=REQUIRED` on the URL.
 * That is a *MySQL CLI / Shell* flag — mysql2 does not understand it and will
 * silently ignore it, leaving you with an unencrypted connection you believe is
 * encrypted. TLS is therefore configured explicitly in `client.ts` instead, and
 * the parameter is accepted here only so that a URL copied from the provider's
 * console does not fail validation.
 */
/** Template tokens that appear inside an unedited .env.example URL. */
const URL_PLACEHOLDER = /^(password|pass|host|hostname|user|username|dbname|database|your[-_].*|<.*>)$/i;

const mysqlUrl = (label: string) =>
  nonPlaceholder(label)
    .refine((v) => {
      try {
        const u = new URL(v);
        return u.protocol === "mysql:" && u.hostname !== "" && u.pathname.length > 1;
      } catch {
        return false;
      }
    }, `${label} must be a mysql://user:password@host:port/database URL`)
    .refine((v) => {
      // Catches `mysql://parallax_app:PASSWORD@host:3306/parallax` — structurally
      // a valid URL, so the check above passes, but the credentials are template
      // text. Without this the failure surfaces much later as an opaque
      // ENOTFOUND/ACCESS DENIED instead of "you did not fill in the file".
      try {
        const u = new URL(v);
        return ![
          decodeURIComponent(u.password),
          u.hostname,
          decodeURIComponent(u.username),
        ].some((part) => URL_PLACEHOLDER.test(part));
      } catch {
        return false;
      }
    }, `${label} still contains template text (PASSWORD / host / username) — substitute your real values`)
    .refine((v) => {
      // A stray space after "mysql://" URL-encodes to %20 and becomes part of
      // the username, so MySQL rejects the login with a bare "Access denied"
      // that gives no hint the credential was ever mangled. Whitespace is never
      // legitimate in a MySQL username or hostname.
      try {
        const u = new URL(v);
        return !/\s/.test(decodeURIComponent(u.username)) && !/\s/.test(u.hostname);
      } catch {
        return false;
      }
    }, `${label} has whitespace in the username or host — check for a stray space after "mysql://"`);

const schema = z.object({
  /**
   * Least-privilege application connection. Must NOT be able to write
   * xp_ledger, attendance, user_roles, or payment verification fields.
   */
  DATABASE_URL: mysqlUrl("DATABASE_URL"),

  /**
   * Privileged writer. Server-only, small pool, used exclusively by awardXp,
   * redeemCheckin, receipt review, and role grants.
   *
   * Optional *for now*: if your host does not permit CREATE USER you may point
   * this at the same credential as DATABASE_URL to unblock development. Doing
   * so is an accepted, documented gap — the least-privilege invariant is then
   * unenforced and `npm run db:check` will say so.
   */
  WRITER_DATABASE_URL: mysqlUrl("WRITER_DATABASE_URL").optional(),

  /**
   * Path to a CA certificate, if your provider uses a private root. Leave unset
   * when the server certificate chains to a public root (most managed MySQL).
   */
  DB_SSL_CA_PATH: z.string().trim().min(1).optional(),

  /**
   * Escape hatch for a provider whose certificate cannot be verified. Setting
   * this to "true" disables certificate verification, which downgrades TLS to
   * encryption-without-authentication and leaves you open to an active MITM.
   * It is refused outright in production below.
   */
  DB_SSL_INSECURE: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),

  DB_POOL_SIZE: z.coerce.number().int().min(1).max(50).default(10),
  DB_WRITER_POOL_SIZE: z.coerce.number().int().min(1).max(20).default(3),

  /** Bounds a runaway SELECT (milliseconds). MySQL applies this to reads only. */
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(100).default(10_000),

  /** InnoDB lock wait, in seconds. Short, so a stuck lock fails fast. */
  DB_LOCK_WAIT_TIMEOUT_S: z.coerce.number().int().min(1).max(120).default(10),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type DbConfig = z.infer<typeof schema>;

let cached: DbConfig | null = null;

/**
 * Parse and validate configuration. Memoised — safe to call per request.
 *
 * Throws a single error listing every problem at once, so you fix four missing
 * variables in one pass instead of four restarts.
 */
export function loadConfig(): DbConfig {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid database environment.\n${detail}\n\n` +
        `Copy .env.example to .env.local and fill in the values. ` +
        `.env.local is gitignored and must never be committed.`,
    );
  }

  const cfg = parsed.data;

  if (cfg.NODE_ENV === "production" && cfg.DB_SSL_INSECURE) {
    throw new Error(
      "DB_SSL_INSECURE=true is refused in production. Supply DB_SSL_CA_PATH instead.",
    );
  }

  cached = cfg;
  return cfg;
}

/** Test seam — drops the memoised config so a test can re-parse a new env. */
export function resetConfigForTests(): void {
  cached = null;
}

/**
 * True when the writer credential is genuinely distinct from the application
 * credential. When false, the least-privilege invariant is NOT enforced and any
 * grant test must be reported as skipped rather than passing.
 */
export function hasDistinctWriter(cfg: DbConfig = loadConfig()): boolean {
  return (
    cfg.WRITER_DATABASE_URL !== undefined &&
    cfg.WRITER_DATABASE_URL !== cfg.DATABASE_URL
  );
}
