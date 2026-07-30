# Backend decisions

Recorded so they are not re-litigated or silently reversed. Each entry states the choice,
the reasoning, and what it costs — a decision recorded without its downside gets undone the
first time the downside is discovered.

Dated 2026-07-30.

## 1. Database: MySQL 8.4

**Decision.** MySQL 8.4 on a managed host (RDS or Cloud SQL), replacing the previously
planned PostgreSQL/Supabase design.

**This supersedes** `PARALLAX-Backend-Security-Database-Requirements.docx`, whose first page
reads *"Target stack: Next.js 16 + PostgreSQL"*, and it replaces `SUPABASE-MIGRATION.md`,
which has been deleted (recoverable from git history). The current schema of record is
[MYSQL-MIGRATION.md](MYSQL-MIGRATION.md).

**Cost, stated plainly.** MySQL lacks features the earlier design leaned on. Each has a
replacement in `MYSQL-MIGRATION.md`, but two of them are genuine downgrades rather than
translations:

- **No row-level security.** The docx wanted RLS on `payment_receipts` and `user_roles` as a
  backstop "where a missed check costs most". There is no per-row equivalent in MySQL. It is
  replaced by table-level grants across two DB users, an `assertRole()` call at the top of
  every mutating action, and an append-only `audit_log`. **A missed authorization check is
  now unmitigated** — under RLS the database would have caught it. This must be an explicit
  item in code review of any mutating action.
- **No `LISTEN/NOTIFY`.** Realtime announcements become a 15s poll. The
  `AnnouncementRepository.subscribe()` signature is unchanged, so no consumer code changes,
  but scope filtering that RLS would have applied automatically must now be an explicit
  server-side `WHERE`.

Also gone, with mechanical replacements: named `CREATE TYPE` enums, the `uuid` type,
`citext`, `timestamptz`, partial indexes, `jsonb`, `inet`, `pg_advisory_xact_lock`,
`RETURNING`, and `SECURITY DEFINER` functions. MySQL is simpler in exactly one place: its
default collation is case-insensitive, so `citext` is not needed for player-name and email
uniqueness.

### Items in the .docx that are now void

The `.docx` remains useful for its security phasing, payments analysis, and go-live gates.
Ignore it on these points:

| Docx item | Status |
|---|---|
| "Target stack: … PostgreSQL" | Superseded by this document |
| Enable `pgcrypto`, enable `citext` | Void — no extensions; ids generated in TypeScript |
| Create 12 enum types | Void — MySQL enums are per-column; see the enum inventory |
| `pg_advisory_xact_lock` before counting | Replaced by `SELECT … FOR UPDATE` on the event row |
| Partial indexes (`WHERE seen_at IS NULL`, `WHERE status = 'pending'`) | Replaced by composite indexes |
| `create role parallax_app login password …` | Replaced by MySQL `CREATE USER` + table-level grants |
| "Enable RLS on `payment_receipts` and `user_roles`" | Not possible — see the cost above |
| `LISTEN/NOTIFY` plus SSE | Replaced by polling |
| "Implement the five functions / five triggers" | Void — logic moves to TypeScript transactions (decision 2) |
| "Implement `PostgresRepository`" | Read as `MySqlRepository` |

Two docx items are **not** void and were carried straight over, because they were bugs in the
old spec rather than Postgres-isms: the stale `skin_id` constraint listing Mojang's character
names instead of the project's own archetypes, and the five missing tables
(`payment_receipts`, `audit_log`, and the auth adapter tables).

## 2. Integrity invariants: application-layer transactions

**Decision.** Hard invariants stay in the schema as unique keys, primary keys and CHECK
constraints. Sequencing logic — capacity, waitlist promotion, team size, XP recompute — lives
in TypeScript transactions using `SELECT … FOR UPDATE` on the parent row. No stored
procedures. The only trigger-shaped behaviour is `updated_at`, which MySQL does natively via
`ON UPDATE CURRENT_TIMESTAMP(3)`.

**Why.** MySQL's procedural story is weak where this design needs it most: no `RETURNING`, so
every "did I actually insert?" branch needs `ROW_COUNT()` plus extra selects; and procedures
cannot be type-checked or reviewed alongside the TypeScript that calls them.
`SELECT … FOR UPDATE` is also the *correct* replacement for `pg_advisory_xact_lock` —
transaction-scoped and auto-released on rollback, unlike `GET_LOCK()`.

**Cost.** The invariants are only as good as the transaction wrapping them. Two rules are
therefore not optional, both documented in `MYSQL-MIGRATION.md`:

- Capacity and team-size counts must be **locking** reads (`FOR SHARE`), because under
  MySQL's default `REPEATABLE READ` a plain count inside the transaction can be stale even
  while holding the parent row lock. Verified empirically; the reproduction is in the doc.
- Lock order is always `events` → `registrations`, in every transaction touching both, or
  `register` and `cancel` will deadlock against each other.

## 3. Query layer: Drizzle ORM

**Decision.** `drizzle-orm` with the `mysql2` driver, and `drizzle-kit` for migrations.

**Why.** It is what the docx already recommended, it has first-class MySQL support, its
SQL-first migrations map onto the hand-written schema rather than replacing it with a separate
DSL, and `@auth/drizzle-adapter` covers the Auth.js tables. Raw SQL stays available via
Drizzle's `sql` template tag for the four risky transactions, which is where hand-written SQL
is actually wanted.

**Cost.** Drizzle's MySQL schema definitions must be kept in sync with
`MYSQL-MIGRATION.md` by hand. The migration doc is the source of truth;
`scripts/check-schema.sh` verifies it independently of Drizzle.

## 4. Authentication: Auth.js v5 — *provisional*

**Decision.** Auth.js (NextAuth v5) with the Drizzle MySQL adapter, server-side password
hashing (argon2id or bcrypt), sessions in `httpOnly` + `Secure` + `SameSite` cookies.

Carried over from the docx unchanged — the database choice does not affect it. Marked
provisional only because it has not been implemented or tested yet; the schema includes the
adapter tables so it is not blocked.

**One schema note.** The adapter's default `users.id` is `varchar(255)`. It is overridden to
`CHAR(36) ascii_bin` because every other table has an FK to it and MySQL requires FK column
types to match exactly (errno 3780).

## Still open

- **Hosting target.** Serverless (Vercel) versus long-running Node (Railway, Render, VPS).
  Under MySQL this no longer changes the realtime answer — polling either way — but it still
  determines connection-pooling strategy. Serverless needs a proxy or a pooled endpoint,
  since each invocation otherwise opens its own connection.
- **Payments.** The docx recommends a gateway (Razorpay/Stripe) with a signed webhook over
  manual PDF verification, and that recommendation stands independently of the database. The
  schema supports the manual path via `payment_receipts`, with `file_hash` indexed so a
  receipt reused across accounts is at least detectable.
- **`PaymentReceiptRepository` shape.** `PaymentReceipt.fileData` is a base64 string, which
  the MySQL table deliberately does not store. See the "Known interface gap" section of
  `MYSQL-MIGRATION.md`.
