# MySQL migration plan

The app currently runs on `LocalRepository` (localStorage). This document is the
complete design for replacing it with **MySQL 8.4** + Auth.js, written while the domain
model was fresh so the swap is mechanical rather than archaeological.

It replaces an earlier PostgreSQL/Supabase design. See `DECISIONS.md` for why the
database changed and what that decision supersedes.

> **Fence convention.** Every ` ```sql ` block in this file is executable DDL, in order,
> against an empty schema. Illustrative or operational SQL that must *not* be applied
> automatically is tagged ` ```mysql ` instead. `scripts/check-schema.sh` relies on this.

## Why the swap is still cheap

Nothing in the app imports a concrete data implementation. Screens and hooks depend only
on the `Repository` interface in `src/backend/data/repository.ts`, and
`src/backend/data/index.ts` is the single construction point:

```ts
// today
const instance = createLocalRepository();
// after migration
const instance = createMySqlRepository();
```

Every repository method is already `async`, and the domain types in
`src/backend/data/types.ts` mirror the column names below one-to-one, so the MySQL
implementation is a mapping layer — no call sites change.

`src/app/dev/data-test` is the acceptance test. **It should pass unchanged against the
MySQL implementation.** If it does not, the interface contract was broken.

## What localStorage is NOT giving you today

Unchanged by the database choice, and still the reason this work exists:

- **No security boundary.** Any user can edit their own roles, XP, or registrations in
  devtools. Organizer and admin dashboards are UI-only.
- **No trustworthy QR check-in.** Forgery cannot be detected without a server-held
  secret. Do not run attendance-based prizes on the prototype.
- **No cross-device data.** A user's character exists only in one browser.
- **Passwords are hashed but offline-attackable.** SHA-256 + salt in localStorage
  protects against casual disclosure, nothing more.

## Packages

```text
mysql2 drizzle-orm drizzle-kit next-auth@beta @auth/drizzle-adapter
```

The current app is entirely client-side (`"use client"` under a `SessionProvider`)
because localStorage has no server presence. **MySQL credentials can never reach the
browser**, so after migration every repository method executes on the server behind
Server Actions or Route Handlers, data-fetching screens become server components, and
route protection moves from the client guard in `(realm)/layout.tsx` into
`middleware.ts`. That relocation, not the schema, is the bulk of the work.

## Translation rules

Every row here is something that **silently breaks** if PostgreSQL DDL is copied across.
Read this section before the schema.

| Postgres feature | MySQL replacement |
|---|---|
| `CREATE TYPE … AS ENUM` | Column-level `ENUM(…)`. Named reusable types do not exist, so adding a value means one `ALTER TABLE` per column — see [Enum inventory](#enum-inventory) for where each one lives. |
| `uuid` + `gen_random_uuid()` | `CHAR(36) CHARACTER SET ascii COLLATE ascii_bin` — 36 bytes, not the 144 a utf8mb4 `CHAR(36)` would reserve. Ids are generated in TypeScript as **UUIDv7** for time-ordered index locality. Do **not** use MySQL's `UUID()`: it is v1 and encodes host MAC and time. |
| `citext` | Not needed. The default `utf8mb4_0900_ai_ci` collation is already case-insensitive, so `UNIQUE` on `player_name`/`email` blocks impersonation by case variation for free. It is also **accent**-insensitive: `José` and `Jose` collide. For `player_name` that is a deliberate strengthening; it is why the column keeps the default collation rather than a `_bin` one. |
| `timestamptz` | `DATETIME(3)`, UTC by application contract. **Not `TIMESTAMP`** — that type ends at 2038-01-19 and `certificates.issued_at` outlives it. Requires `timezone: 'Z'` in the mysql2 config; without it the driver silently shifts values by the server offset. |
| `text` in any index or key | Explicit `VARCHAR(n)`. MySQL cannot index `TEXT` without a prefix length, and InnoDB caps a key at 3072 bytes. **Rule: `TEXT` is reserved for unindexed prose.** |
| Partial indexes | Plain composite indexes. `user_achievements(user_id, seen_at)` serves the `seen_at IS NULL` queue; `payment_receipts(status, submitted_at)` serves the admin queue. |
| `jsonb` | `JSON`. A default must be a parenthesised expression: `DEFAULT (JSON_OBJECT())`. |
| `inet` | `VARBINARY(16)` with `INET6_ATON()` / `INET6_NTOA()`. Used by `audit_log.ip`. |
| `bigserial` | `BIGINT UNSIGNED NOT NULL AUTO_INCREMENT`. |
| `gen_random_bytes()` for `teams.join_code` | Generated in TypeScript, retried on unique-key collision. MySQL forbids non-deterministic functions in `DEFAULT` expressions. |
| `pg_advisory_xact_lock()` | `SELECT … FOR UPDATE` on the parent `events` row. Correct because it is **transaction-scoped and auto-releases on rollback** — unlike `GET_LOCK()`, which is session-scoped and leaks a held lock past a failed transaction. |
| `INSERT … ON CONFLICT DO NOTHING … RETURNING` | **MySQL has no `RETURNING`.** Use `INSERT … ON DUPLICATE KEY UPDATE <col> = <col>` and branch on `affectedRows`: `1` = inserted, `0` = row already existed. Do **not** use `INSERT IGNORE` — it also downgrades FK violations and truncations to warnings, hiding real bugs. |
| Row Level Security | **No per-row equivalent exists.** Replaced by the three-part scheme in [Authorization without RLS](#authorization-without-rls). Weaker than RLS, and the doc says so where it matters. |
| `LISTEN/NOTIFY` for realtime | Polling. `AnnouncementRepository.subscribe()` keeps its signature and becomes a 15s interval query on `published_at > lastSeen`. The repository seam absorbs this; no consumer changes. |
| `SECURITY DEFINER` functions | Deleted. All five move into TypeScript transactions — see [The four transactions that carry risk](#the-four-transactions-that-carry-risk). |
| Trigger-maintained `updated_at` | Free in MySQL: `DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`. The only trigger the Postgres design needed that survives, and it is not a trigger. |

### Connection settings that are not optional

```mysql
-- Per connection. Set these in the mysql2 pool config, not by hand.
SET time_zone = '+00:00';
SET transaction_isolation = 'READ-COMMITTED';
```

```ts
// src/backend/db/client.ts
export const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,          // ?ssl-mode=REQUIRED
  timezone: "Z",                          // or DATETIME values shift silently
  supportBigNumbers: true,
  bigNumberStrings: true,                 // xp_ledger.id is BIGINT; JS loses precision at 2^53
  dateStrings: true,                       // domain types are ISO strings, not Date
  connectionLimit: 10,
});
```

`bigNumberStrings` matters because `xp_ledger.id` is `BIGINT UNSIGNED` and `XpEntry.id` is
a `string` in the domain types. `dateStrings` keeps `DATETIME(3)` arriving as a string, which
is what every timestamp field in `types.ts` already is.

## The correctness trap: REPEATABLE READ

**This is the single most important MySQL-specific difference in the whole port.**

MySQL defaults to `REPEATABLE READ`; PostgreSQL defaults to `READ COMMITTED`. Inside a
transaction a *plain* `SELECT COUNT(*)` is a consistent read served from the snapshot
established at the transaction's first read — so a capacity check can be **stale even while
holding an exclusive lock on the event row**, and capacity can be exceeded.

Reproduced against this schema on MySQL 9.6 — session B inserts and commits a registration
while session A's transaction is open:

| Session A, in one `REPEATABLE READ` transaction | Rows seen |
|---|---|
| `SELECT COUNT(*) FROM registrations` (before B commits) | 1 |
| `SELECT COUNT(*) FROM registrations` (after B commits) | **1 — stale** |
| `SELECT COUNT(*) FROM registrations FOR SHARE` (after B commits) | **2 — correct** |

Two mitigations, both required:

1. `transaction_isolation = 'READ-COMMITTED'` on the application connection (above).
2. Make the count a **locking** read regardless. A locking read always sees the latest
   committed version, so it is correct under either isolation level and does not depend on
   the connection being configured correctly.

```ts
await db.transaction(async (tx) => {
  // 1. Lock the parent row FIRST. Consistent lock order (events → registrations) in every
  //    transaction that touches both is what prevents deadlock with cancel/promote.
  const [ev] = await tx.select().from(events).where(eq(events.id, eventId)).for("update");
  if (!ev) throw new DataError("NOT_FOUND", "Event not found.");

  // 2. Locking read. A plain count() here can miss a committed insert under REPEATABLE READ.
  const [{ n }] = await tx
    .select({ n: count() })
    .from(registrations)
    .where(and(eq(registrations.eventId, eventId), eq(registrations.status, "confirmed")))
    .for("share");

  const status = ev.capacity != null && n >= ev.capacity ? "waitlisted" : "confirmed";
  // 3. …insert, then award XP inside the same transaction.
});
```

Also: retry the whole transaction on `ER_LOCK_DEADLOCK` (errno **1213**) and
`ER_LOCK_WAIT_TIMEOUT` (**1205**). InnoDB picks a victim and rolls it back; the caller is
expected to retry. A single retry with a short jitter is enough at fest scale.

## Enum inventory

MySQL enums are per-column, so adding a value is one `ALTER TABLE` **per column below**.
This table exists so that ALTER is findable.

| Enum | Values | Columns |
|---|---|---|
| app_role | player, organizer, admin | `user_roles.role` |
| event_status | draft, pending_review, published, registration_closed, ongoing, completed, cancelled | `events.status` |
| event_mode | solo, team, either | `events.mode` |
| registration_status | pending, confirmed, waitlisted, cancelled, rejected | `registrations.status` |
| attendance_method | qr, manual, self | `attendance.method` |
| team_member_role | leader, member | `team_members.role` |
| rarity | common, uncommon, rare, epic, legendary | `achievements.rarity` |
| announcement_scope | global, event, college | `announcements.scope` |
| announcement_severity | info, success, warning, critical | `announcements.severity` |
| certificate_kind | participation, winner, runner_up, special, volunteer | `certificates.kind` |
| achievement_trigger | manual, first_registration, event_attended, events_attended_count, team_created, profile_completed, xp_threshold | `achievements.trigger_type` |
| payment_verification_status | pending, verified, rejected | `payment_receipts.status` |
| skin_id | prospector, botanist, sentinel, voidwalker, artificer | `characters.skin_id` |
| sponsor_tier | diamond, gold, iron, stone | `sponsors.tier` |

Each mirrors a union type in `src/backend/data/types.ts`. **Changing one without the other
is how the app starts writing values the column rejects.**

## Schema

Only constraints that carry real weight are annotated. 27 tables, in FK dependency order:
the 21 from the original spec, plus `payment_receipts`, `audit_log`, and the four Auth.js
adapter tables.

Verified by `scripts/check-schema.sh`, which applies every ` ```sql ` block below to a
scratch database and asserts that each invariant rejects what it claims to.

### Identity — Auth.js adapter tables

```sql
-- Auth.js `users` replaces Supabase `auth.users`. The adapter's default id is
-- varchar(255); it is overridden to CHAR(36) ascii here because every other table
-- references it and MySQL requires FK column types to match EXACTLY (errno 3780).
CREATE TABLE users (
  id             CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name           VARCHAR(255) NULL,
  email          VARCHAR(320) NOT NULL,
  email_verified DATETIME(3) NULL,
  image          VARCHAR(2048) NULL,
  -- argon2id or bcrypt, hashed SERVER-SIDE. NULL for OAuth-only accounts.
  password_hash  VARCHAR(255) NULL,
  created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  -- ai_ci collation => case-insensitive, so Alice@x.com and alice@x.com collide.
  UNIQUE KEY users_email_uq (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

CREATE TABLE accounts (
  user_id             CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  type                VARCHAR(32) NOT NULL,
  provider            VARCHAR(64) NOT NULL,
  provider_account_id VARCHAR(191) NOT NULL,
  refresh_token       TEXT NULL,
  access_token        TEXT NULL,
  expires_at          BIGINT NULL,
  token_type          VARCHAR(32) NULL,
  scope               VARCHAR(255) NULL,
  id_token            TEXT NULL,
  session_state       VARCHAR(255) NULL,
  PRIMARY KEY (provider, provider_account_id),
  KEY accounts_user_idx (user_id),
  CONSTRAINT accounts_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

CREATE TABLE sessions (
  -- ascii: the token is base64url. utf8mb4 would reserve 4 bytes/char for no reason.
  session_token VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id       CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires       DATETIME(3) NOT NULL,
  PRIMARY KEY (session_token),
  KEY sessions_user_idx (user_id),
  CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

CREATE TABLE verification_tokens (
  identifier VARCHAR(320) NOT NULL,
  token      VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires    DATETIME(3) NOT NULL,
  PRIMARY KEY (identifier, token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
```

### Profiles and roles

```sql
CREATE TABLE profiles (
  id         CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  -- Denormalised from users.email, which stays authoritative. Kept because the
  -- Profile domain type carries it; update both in one transaction.
  email      VARCHAR(320) NOT NULL,
  full_name  VARCHAR(160) NULL,
  phone      VARCHAR(32) NULL,
  -- Participant fields, required by the registration console's intake record
  -- (BACKEND-API-CONTRACT.md §1) and collected by the registration form.
  --
  -- All NULL-able even though the console types them as required: an account
  -- exists from sign-up, and these are not asked for until the visitor
  -- registers for something. Completeness is an application check at
  -- registration time (`isParticipantComplete`), not a column constraint —
  -- NOT NULL here would make sign-up impossible.
  --
  -- ENUMs rather than lookup tables: these are closed wire-contract sets shared
  -- with another codebase, not editable reference data. A new value is a
  -- coordinated change in both repos, which is exactly what ALTER forces.
  gender        ENUM('male','female','other') NULL,
  date_of_birth DATE NULL,
  category      ENUM('participant','delegate','accompanist','faculty','volunteer','guest') NULL,
  tshirt_size   ENUM('XS','S','M','L','XL','XXL') NULL,
  emergency_name  VARCHAR(160) NULL,
  emergency_phone VARCHAR(32) NULL,
  dietary_pref  ENUM('veg','non_veg','vegan','jain') NULL,
  is_banned  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT profiles_user_fk FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- THE privilege-escalation boundary. Role is a row in a table the ordinary
-- application DB user cannot write (see Authorization without RLS). Never put role
-- on profiles (user-updatable) or in a session cookie (client-controlled).
CREATE TABLE user_roles (
  user_id    CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  role       ENUM('player','organizer','admin') NOT NULL,
  granted_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  granted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, role),
  KEY user_roles_granted_by_idx (granted_by),
  CONSTRAINT user_roles_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT user_roles_granter_fk FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
```

### Reference data

```sql
CREATE TABLE colleges (
  id         CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name       VARCHAR(160) NOT NULL,
  short_name VARCHAR(32) NOT NULL,
  city       VARCHAR(96) NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  UNIQUE KEY colleges_name_uq (name),
  UNIQUE KEY colleges_short_name_uq (short_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

CREATE TABLE departments (
  id         CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  college_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,  -- NULL = generic
  name       VARCHAR(160) NOT NULL,
  short_name VARCHAR(32) NULL,
  -- UNIQUE(college_id, name) does NOT dedupe generic departments, because NULLs are
  -- distinct in a unique key (true in Postgres too — this was a latent bug in the
  -- original spec). The generated column closes it.
  --
  -- VIRTUAL, not STORED: MySQL rejects a foreign key with ON DELETE CASCADE on a column
  -- that a STORED generated column derives from (errno 1215). VIRTUAL is exempt, is still
  -- indexable, and costs nothing here.
  college_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin
              AS (COALESCE(college_id, '00000000-0000-0000-0000-000000000000')) VIRTUAL,
  PRIMARY KEY (id),
  UNIQUE KEY departments_college_name_uq (college_key, name),
  KEY departments_college_idx (college_id),
  CONSTRAINT departments_college_fk FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

CREATE TABLE levels (
  level  SMALLINT UNSIGNED NOT NULL,
  min_xp INT UNSIGNED NOT NULL,
  title  VARCHAR(64) NOT NULL,
  PRIMARY KEY (level),
  UNIQUE KEY levels_min_xp_uq (min_xp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

CREATE TABLE event_categories (
  id                 CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  slug               VARCHAR(64) NOT NULL,
  name               VARCHAR(96) NOT NULL,
  description        TEXT NULL,
  -- Links to a WORLD_LOCATIONS key in src/frontend/lib/world/world-locations.ts.
  world_location_key VARCHAR(64) NULL,
  block_color        VARCHAR(32) NOT NULL DEFAULT 'mc-stone',
  sort_order         SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY event_categories_slug_uq (slug),
  -- Nullable + unique: many categories may have no world location (NULLs distinct),
  -- but no two may claim the same one. That is the intended behaviour here.
  UNIQUE KEY event_categories_world_key_uq (world_location_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

CREATE TABLE sponsors (
  id          CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name        VARCHAR(160) NOT NULL,
  tier        ENUM('diamond','gold','iron','stone') NOT NULL,
  website_url VARCHAR(2048) NULL,
  blurb       VARCHAR(500) NULL,
  sort_order  SMALLINT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
```

### Characters and XP

```sql
CREATE TABLE characters (
  id            CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id       CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  -- Default ai_ci collation => "Ridge", "ridge" and "Ridgé" all collide on the unique
  -- key. Deliberate: case or accent variation must not enable impersonation.
  player_name   VARCHAR(16) NOT NULL,
  college_id    CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  department_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  year_of_study TINYINT UNSIGNED NULL,
  -- Original archetypes, matching SkinId in src/backend/data/types.ts. The Postgres
  -- spec still listed Mojang's character names here; applied as written, every insert
  -- failed the CHECK.
  skin_id       ENUM('prospector','botanist','sentinel','voidwalker','artificer')
                  NOT NULL DEFAULT 'prospector',
  bio           VARCHAR(280) NULL,
  -- Denormalised cache of xp_ledger. Never incremented in place: always recomputed as
  -- the ledger SUM, so it cannot drift. See awardXp() below.
  total_xp      INT NOT NULL DEFAULT 0,
  level         SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  title         VARCHAR(64) NULL,
  created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY characters_user_uq (user_id),
  UNIQUE KEY characters_player_name_uq (player_name),
  -- created_at ASC as tiebreak gives a deterministic leaderboard: ranks do not shuffle
  -- between reloads when players are level-pegged. MySQL 8 honours DESC in an index.
  KEY characters_xp_idx (total_xp DESC, created_at ASC),
  KEY characters_college_idx (college_id),
  KEY characters_department_idx (department_id),
  -- Length bounds fold into the pattern; VARCHAR(16) already caps the upper end.
  CONSTRAINT characters_player_name_ck CHECK (REGEXP_LIKE(player_name, '^[A-Za-z0-9_]{3,16}$')),
  CONSTRAINT characters_year_ck CHECK (year_of_study IS NULL OR year_of_study BETWEEN 1 AND 6),
  CONSTRAINT characters_total_xp_ck CHECK (total_xp >= 0),
  CONSTRAINT characters_level_ck CHECK (level >= 1),
  CONSTRAINT characters_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT characters_college_fk FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE SET NULL,
  CONSTRAINT characters_department_fk FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

CREATE TABLE xp_ledger (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  amount      INT NOT NULL,
  -- VARCHAR, not TEXT: these three are in a unique key and TEXT cannot be indexed
  -- without a prefix length. 36 + 128 + 36 + 640 = 840 bytes, under InnoDB's 3072 cap.
  reason      VARCHAR(160) NOT NULL,
  source_type VARCHAR(32) NOT NULL,
  -- NOT NULL is load-bearing. Nullable would make the idempotency key useless for any
  -- grant without a source (NULLs are distinct in a unique key), so an admin grant
  -- could double-pay. XpRepository.award() requires a sourceId, so this is safe.
  source_id   CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  -- THE idempotency guard. Re-running "award attendance XP" cannot double-pay.
  UNIQUE KEY xp_ledger_idem_uq (user_id, source_type, source_id, reason),
  KEY xp_ledger_user_created_idx (user_id, created_at DESC),
  CONSTRAINT xp_ledger_amount_ck CHECK (amount <> 0),
  CONSTRAINT xp_ledger_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
```

### Events

```sql
CREATE TABLE events (
  id            CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  slug          VARCHAR(120) NOT NULL,
  title         VARCHAR(160) NOT NULL,
  tagline       VARCHAR(255) NULL,
  description   TEXT NULL,
  rules         TEXT NULL,
  category_id   CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  status        ENUM('draft','pending_review','published','registration_closed','ongoing','completed','cancelled')
                  NOT NULL DEFAULT 'draft',
  mode          ENUM('solo','team','either') NOT NULL DEFAULT 'solo',
  min_team_size SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  max_team_size SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  capacity      INT UNSIGNED NULL,   -- NULL = unlimited
  venue         VARCHAR(160) NULL,
  starts_at     DATETIME(3) NOT NULL,
  ends_at       DATETIME(3) NOT NULL,
  registration_opens_at  DATETIME(3) NULL,
  registration_closes_at DATETIME(3) NULL,
  xp_reward     INT UNSIGNED NOT NULL DEFAULT 50,
  entry_fee_inr INT UNSIGNED NOT NULL DEFAULT 0,
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  contact_email VARCHAR(320) NULL,
  created_by    CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY events_slug_uq (slug),
  KEY events_status_starts_idx (status, starts_at),
  KEY events_category_idx (category_id),
  KEY events_created_by_idx (created_by),
  CONSTRAINT events_time_order_ck CHECK (ends_at > starts_at),
  CONSTRAINT events_team_size_ck CHECK (max_team_size >= min_team_size AND min_team_size >= 1),
  CONSTRAINT events_capacity_ck CHECK (capacity IS NULL OR capacity > 0),
  CONSTRAINT events_category_fk FOREIGN KEY (category_id) REFERENCES event_categories(id) ON DELETE RESTRICT,
  CONSTRAINT events_creator_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- Scoped organiser rights. "Organizer" is not god-mode: the Photography Forest
-- organiser must not read Hackathon Mine's registration list.
CREATE TABLE event_organizers (
  event_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id  CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  can_scan BOOLEAN NOT NULL DEFAULT TRUE,
  can_edit BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (event_id, user_id),
  KEY event_organizers_user_idx (user_id),
  CONSTRAINT event_organizers_event_fk FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT event_organizers_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

CREATE TABLE schedule_slots (
  id        CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  event_id  CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  title     VARCHAR(160) NOT NULL,
  day_label VARCHAR(32) NOT NULL,
  starts_at DATETIME(3) NOT NULL,
  ends_at   DATETIME(3) NOT NULL,
  venue     VARCHAR(160) NULL,
  track     VARCHAR(64) NULL,
  is_break  BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id),
  KEY schedule_slots_event_idx (event_id),
  KEY schedule_slots_starts_idx (starts_at),
  CONSTRAINT schedule_time_order_ck CHECK (ends_at > starts_at),
  CONSTRAINT schedule_slots_event_fk FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
```

### Teams, registrations, attendance

```sql
CREATE TABLE teams (
  id        CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  event_id  CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name      VARCHAR(32) NOT NULL,
  -- Generated in TypeScript (MySQL forbids non-deterministic DEFAULT expressions);
  -- retry on duplicate-key error.
  join_code VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  leader_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY teams_join_code_uq (join_code),
  UNIQUE KEY teams_event_name_uq (event_id, name),
  KEY teams_leader_idx (leader_id),
  CONSTRAINT teams_name_ck CHECK (CHAR_LENGTH(name) >= 3),
  CONSTRAINT teams_event_fk FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT teams_leader_fk FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

CREATE TABLE team_members (
  team_id   CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id   CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  role      ENUM('leader','member') NOT NULL DEFAULT 'member',
  joined_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (team_id, user_id),
  KEY team_members_user_idx (user_id),
  CONSTRAINT team_members_team_fk FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT team_members_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

CREATE TABLE registrations (
  id       CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  event_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id  CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  team_id  CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  status   ENUM('pending','confirmed','waitlisted','cancelled','rejected') NOT NULL DEFAULT 'confirmed',
  registered_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  cancelled_at  DATETIME(3) NULL,
  PRIMARY KEY (id),
  -- Database-enforced guard against double registration. An application-level
  -- `if (already registered)` races under concurrent requests.
  UNIQUE KEY registrations_event_user_uq (event_id, user_id),
  KEY registrations_event_status_idx (event_id, status),
  KEY registrations_user_registered_idx (user_id, registered_at DESC),
  KEY registrations_team_idx (team_id),
  CONSTRAINT registrations_event_fk FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT registrations_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT registrations_team_fk FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

CREATE TABLE attendance (
  id       CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  event_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id  CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  registration_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  method   ENUM('qr','manual','self') NOT NULL DEFAULT 'qr',
  checked_in_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  scanned_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  token_jti  VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (id),
  UNIQUE KEY attendance_event_user_uq (event_id, user_id),   -- DOUBLE CHECK-IN IMPOSSIBLE
  KEY attendance_event_time_idx (event_id, checked_in_at DESC),
  KEY attendance_user_idx (user_id),
  KEY attendance_registration_idx (registration_id),
  KEY attendance_scanned_by_idx (scanned_by),
  CONSTRAINT attendance_event_fk FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT attendance_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT attendance_registration_fk FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE SET NULL,
  CONSTRAINT attendance_scanner_fk FOREIGN KEY (scanned_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- Replay protection, separate from attendance uniqueness: blocks reuse of a specific
-- token even if the attendance row was later deleted.
CREATE TABLE checkin_token_redemptions (
  jti         VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id     CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  event_id    CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  redeemed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  redeemed_by CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (jti),
  KEY checkin_redemptions_user_idx (user_id),
  KEY checkin_redemptions_event_idx (event_id),
  KEY checkin_redemptions_redeemer_idx (redeemed_by),
  CONSTRAINT checkin_redemptions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT checkin_redemptions_event_fk FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL,
  CONSTRAINT checkin_redemptions_redeemer_fk FOREIGN KEY (redeemed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
```

### Achievements

```sql
CREATE TABLE achievements (
  id            CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  code          VARCHAR(64) NOT NULL,
  name          VARCHAR(96) NOT NULL,
  description   VARCHAR(255) NOT NULL,
  flavor_text   VARCHAR(255) NULL,
  rarity        ENUM('common','uncommon','rare','epic','legendary') NOT NULL DEFAULT 'common',
  xp_reward     INT UNSIGNED NOT NULL DEFAULT 25,
  trigger_type  ENUM('manual','first_registration','event_attended','events_attended_count',
                     'team_created','profile_completed','xp_threshold') NOT NULL DEFAULT 'manual',
  -- A JSON default must be a parenthesised expression; a bare '{}' literal is rejected.
  trigger_config JSON NOT NULL DEFAULT (JSON_OBJECT()),
  is_secret     BOOLEAN NOT NULL DEFAULT FALSE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY achievements_code_uq (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

CREATE TABLE user_achievements (
  user_id        CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  achievement_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  unlocked_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  seen_at        DATETIME(3) NULL,   -- NULL => show the unlock cinematic
  PRIMARY KEY (user_id, achievement_id),   -- unlocking twice is impossible
  -- Replaces the Postgres partial index `WHERE seen_at IS NULL`. MySQL has none;
  -- this composite serves the same unseen-queue lookup.
  KEY user_achievements_unseen_idx (user_id, seen_at),
  KEY user_achievements_achievement_idx (achievement_id),
  CONSTRAINT user_achievements_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT user_achievements_achievement_fk FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
```

### Announcements and certificates

```sql
CREATE TABLE announcements (
  id         CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  scope      ENUM('global','event','college') NOT NULL DEFAULT 'global',
  event_id   CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  college_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  title      VARCHAR(160) NOT NULL,
  body       TEXT NOT NULL,
  severity   ENUM('info','success','warning','critical') NOT NULL DEFAULT 'info',
  is_pinned  BOOLEAN NOT NULL DEFAULT FALSE,
  published_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at   DATETIME(3) NULL,
  created_by   CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (id),
  -- Drives the 15s poll that replaces LISTEN/NOTIFY.
  KEY announcements_published_idx (published_at DESC),
  KEY announcements_event_idx (event_id),
  KEY announcements_college_idx (college_id),
  KEY announcements_creator_idx (created_by),
  CONSTRAINT announcements_scope_target_ck CHECK (
    (scope = 'global'  AND event_id IS NULL AND college_id IS NULL) OR
    (scope = 'event'   AND event_id IS NOT NULL) OR
    (scope = 'college' AND college_id IS NOT NULL)),
  CONSTRAINT announcements_event_fk FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT announcements_college_fk FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
  CONSTRAINT announcements_creator_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

CREATE TABLE certificates (
  id       CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id  CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  event_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  kind     ENUM('participation','winner','runner_up','special','volunteer') NOT NULL DEFAULT 'participation',
  serial   VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  storage_path VARCHAR(512) NULL,
  issued_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  revoked_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY certificates_serial_uq (serial),
  -- NOTE: event_id is nullable, and NULLs are distinct in a unique key, so this does
  -- NOT prevent two fest-wide 'special' certificates for one user. Enforce that in the
  -- issuing action if it matters.
  UNIQUE KEY certificates_user_event_kind_uq (user_id, event_id, kind),
  KEY certificates_event_idx (event_id),
  CONSTRAINT certificates_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT certificates_event_fk FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
```

### Payments and audit

```sql
CREATE TABLE payment_receipts (
  id              CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  registration_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  event_id        CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id         CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  -- Object-storage key, NEVER the file bytes. A base64 PDF in a LONGTEXT column also
  -- collides with max_allowed_packet, which is commonly 4MB on managed MySQL.
  storage_path    VARCHAR(512) NOT NULL,
  file_name       VARCHAR(255) NOT NULL,
  -- SHA-256 hex. Indexed so the same receipt submitted by several users is detectable
  -- — one of the named fraud modes of manual verification.
  file_hash       CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  file_size_bytes INT UNSIGNED NOT NULL,
  status          ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
  -- No FK, deliberately — same reasoning as audit_log.actor_id. ON DELETE SET NULL would
  -- both erase who approved a payment and violate payment_receipts_reviewed_ck below;
  -- MySQL rejects that combination outright (errno 3823). The reviewer id on a money
  -- record is history, not a live reference.
  reviewed_by     CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  reviewed_at     DATETIME(3) NULL,
  review_note     VARCHAR(500) NULL,
  submitted_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY payment_receipts_registration_uq (registration_id),
  -- Replaces the Postgres partial index `WHERE status = 'pending'` (admin queue).
  KEY payment_receipts_status_idx (status, submitted_at),
  KEY payment_receipts_hash_idx (file_hash),
  KEY payment_receipts_user_idx (user_id),
  KEY payment_receipts_event_idx (event_id),
  KEY payment_receipts_reviewer_idx (reviewed_by),
  -- A decided receipt must name who decided it, and when. Keeps the money trail
  -- attributable — which is why reviewed_by carries no FK (see above).
  CONSTRAINT payment_receipts_reviewed_ck CHECK (
    status = 'pending' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)),
  CONSTRAINT payment_receipts_registration_fk FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
  CONSTRAINT payment_receipts_event_fk FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT payment_receipts_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- Append-only. Deliberately NO foreign key on actor_id: deleting a user must not
-- rewrite or cascade away the history of what that user did.
CREATE TABLE audit_log (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id    CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,  -- NULL = system
  action      VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id   VARCHAR(64) NULL,
  before_json JSON NULL,
  after_json  JSON NULL,
  ip          VARBINARY(16) NULL,   -- INET6_ATON(); MySQL has no inet type
  user_agent  VARCHAR(500) NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY audit_log_entity_idx (entity_type, entity_id, created_at DESC),
  KEY audit_log_actor_idx (actor_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
```

### Optional

`announcement_reads` (per-user read/unread state) and `team_invites` (only if invites go
beyond the join code) are deferred. Neither is referenced by the current `Repository`
interface.

## Views

```sql
-- `rank` is a reserved word in MySQL 8 (the window function). It must be quoted, and
-- LeaderboardRow.rank expects exactly this name.
CREATE OR REPLACE VIEW leaderboard AS
SELECT RANK() OVER (ORDER BY c.total_xp DESC, c.created_at ASC) AS `rank`,
       c.id AS character_id, c.user_id, c.player_name, c.skin_id,
       c.level, c.total_xp, c.title, col.short_name AS college
FROM characters c
LEFT JOIN colleges col ON col.id = c.college_id;

CREATE OR REPLACE VIEW event_stats AS
SELECT e.id AS event_id,
       COALESCE(SUM(r.status = 'confirmed'), 0)  AS confirmed_count,
       COALESCE(SUM(r.status = 'waitlisted'), 0) AS waitlist_count,
       (SELECT COUNT(*) FROM attendance a WHERE a.event_id = e.id) AS checked_in_count,
       e.capacity,
       CASE WHEN e.capacity IS NULL THEN NULL
            ELSE GREATEST(0, e.capacity - COALESCE(SUM(r.status = 'confirmed'), 0))
       END AS seats_left
FROM events e
LEFT JOIN registrations r ON r.event_id = e.id
GROUP BY e.id;
```

`event_stats` groups by the primary key, so `e.capacity` is functionally dependent and
`ONLY_FULL_GROUP_BY` accepts it. A MySQL view cannot contain a derived table in `FROM`,
which is why `checked_in_count` is a scalar subquery.

## Integrity invariants

Nine invariants, currently enforced in JavaScript where they cannot survive concurrent
requests. Eight become plain keys; only two need application logic.

| Invariant | Mechanism | Where |
|---|---|---|
| No double registration | `UNIQUE (event_id, user_id)` | schema |
| No double check-in | `UNIQUE (event_id, user_id)` | schema |
| Check-in token single-use | `PRIMARY KEY (jti)` | schema |
| XP grants idempotent | `UNIQUE (user_id, source_type, source_id, reason)`, all four `NOT NULL` | schema |
| Achievement unlocks once | `PRIMARY KEY (user_id, achievement_id)` | schema |
| One receipt per registration | `UNIQUE (registration_id)` | schema |
| Player name unique | `UNIQUE` under `ai_ci` collation | schema |
| **Capacity respected** | `SELECT … FOR UPDATE` on the event row, then a locking count | `registerForEvent()` |
| **Team size respected** | `SELECT … FOR UPDATE` on the team row, then a locking count | `joinTeam()` |
| `total_xp` cannot drift | recomputed as `SUM(xp_ledger.amount)`, never incremented | `awardXp()` |

## The four transactions that carry risk

These replace the five Postgres `SECURITY DEFINER` functions. Each must reproduce the
`LocalRepository` behaviour that `/dev/data-test` already asserts.

### `awardXp` — idempotent, then recompute

Mirrors `LocalXp.award` and `recomputeCharacterXp` in `local-repository.ts`.

```ts
// ON DUPLICATE KEY UPDATE, not INSERT IGNORE: this absorbs only the duplicate-key
// case, so an FK violation or truncation still throws instead of vanishing.
const res = await tx.execute(sql`
  INSERT INTO xp_ledger (user_id, amount, reason, source_type, source_id)
  VALUES (${userId}, ${amount}, ${reason}, ${sourceType}, ${sourceId})
  ON DUPLICATE KEY UPDATE user_id = user_id
`);
if (res.affectedRows === 0) return;   // already granted — no double-pay, no recompute

// SUM, never `total_xp = total_xp + amount`. Summing means the cache cannot drift.
await tx.execute(sql`
  UPDATE characters c
     SET c.total_xp = (SELECT COALESCE(SUM(amount), 0) FROM xp_ledger WHERE user_id = c.user_id),
         c.level    = COALESCE((SELECT l.level FROM levels l WHERE l.min_xp <= c.total_xp
                                ORDER BY l.min_xp DESC LIMIT 1), 1),
         c.title    = (SELECT l.title FROM levels l WHERE l.min_xp <= c.total_xp
                       ORDER BY l.min_xp DESC LIMIT 1)
   WHERE c.user_id = ${userId}
`);
```

`affectedRows` semantics for `ON DUPLICATE KEY UPDATE`: **1** = inserted, **0** = existed
and the update was a no-op, **2** = an existing row actually changed. Only `1` means "this
grant is new".

The `UPDATE … SET total_xp = …, level = (… <= c.total_xp)` form reads `c.total_xp` for
`level` **before** the assignment in the same statement is visible, which is why level and
title must be computed from the freshly summed value — do this as two statements, or
compute level/title in TypeScript from the returned sum, as `recomputeCharacterXp` does
today. Two statements is clearer and is what the implementation should use.

### `registerForEvent` — capacity without a race

See the [REPEATABLE READ section](#the-correctness-trap-repeatable-read) for the locking
pattern. Beyond that it must preserve three existing behaviours from
`LocalRegistrations.register`:

- A verified one-time payment is required first, else `PAYMENT_NOT_VERIFIED`.
- An existing non-cancelled registration is **returned**, not re-inserted — the unique key
  forces this. A previously cancelled row is **reactivated in place**, not duplicated.
- Over capacity **waitlists** rather than throwing, so the UI can show a useful state.
  XP is awarded only for a `confirmed` seat.

### `cancel` — free a seat, promote the earliest waitlister

Lock `events` first, then `registrations` — the same order as `registerForEvent`, which is
what keeps the two from deadlocking against each other. XP is deliberately **not** clawed
back: the ledger is an audit trail, and reversing entries would let a register/cancel loop
farm achievements.

### `redeemCheckin` — replay-proof, single transaction

```ts
await db.transaction(async (tx) => {
  // PK violation on jti => REPLAYED. Let it throw; do not swallow with INSERT IGNORE.
  await tx.execute(sql`
    INSERT INTO checkin_token_redemptions (jti, user_id, event_id, redeemed_by)
    VALUES (${jti}, ${userId}, ${eventId}, ${scannerId})
  `);
  const res = await tx.execute(sql`
    INSERT INTO attendance (id, event_id, user_id, registration_id, method, scanned_by, token_jti)
    VALUES (${uuidv7()}, ${eventId}, ${userId}, ${registrationId}, 'qr', ${scannerId}, ${jti})
    ON DUPLICATE KEY UPDATE event_id = event_id
  `);
  if (res.affectedRows === 1) await awardXp(tx, { /* attendance grant */ });
});
```

Both guards are constraints inside one transaction, so there is no read-then-write race,
and a replayed token fails even if the attendance row was later deleted.

## Authorization without RLS

**MySQL has no row-level security.** The Postgres design used RLS as a backstop for a
missed application check; that safety net does not exist here, and the schema cannot
provide it. Three partial compensations:

**1. `assertRole()` at the top of every mutating server action**, re-derived from
`user_roles` on every call — never from the session cookie. A role cached in a session is
acceptable for deciding what to *render*; it is never the basis of a write, because a
revoked role persists in an unexpired session.

**2. Least-privilege grants, table by table.** MySQL privileges are cumulative and a
database-level grant **cannot be revoked at table level** — so never write
`GRANT … ON parallax.*`. Grant each table explicitly, and give the money and progression
tables to a separate user used only by the few server functions that write them.

```mysql
-- Application user: no write access at all to the tables that grant value or record money.
CREATE USER 'parallax_app'@'%' IDENTIFIED BY '<from secret manager>';
GRANT SELECT, INSERT, UPDATE, DELETE ON parallax.registrations   TO 'parallax_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON parallax.characters      TO 'parallax_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON parallax.teams           TO 'parallax_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON parallax.team_members    TO 'parallax_app'@'%';
GRANT SELECT                         ON parallax.xp_ledger       TO 'parallax_app'@'%';
GRANT SELECT                         ON parallax.attendance      TO 'parallax_app'@'%';
GRANT SELECT                         ON parallax.user_roles      TO 'parallax_app'@'%';
GRANT SELECT                         ON parallax.payment_receipts TO 'parallax_app'@'%';
-- …plus SELECT on every reference table and both views.

-- Privileged writer: used ONLY by awardXp, redeemCheckin, receipt review, role grants.
CREATE USER 'parallax_writer'@'%' IDENTIFIED BY '<from secret manager>';
GRANT INSERT         ON parallax.xp_ledger       TO 'parallax_writer'@'%';
GRANT INSERT         ON parallax.attendance      TO 'parallax_writer'@'%';
GRANT INSERT, UPDATE ON parallax.user_roles      TO 'parallax_writer'@'%';
GRANT UPDATE         ON parallax.payment_receipts TO 'parallax_writer'@'%';
GRANT INSERT         ON parallax.audit_log       TO 'parallax_writer'@'%';
```

**3. `audit_log` for every privileged write**, so a compromise is at least reconstructable.

Discipline this requires, and a CI check for each:

- The `parallax_writer` connection module starts with `import "server-only"` and throws if
  `typeof window !== "undefined"`.
- CI greps `src/**` and fails the build if `DATABASE_URL`, `WRITER_URL`, or any credential
  name appears outside `src/backend/db/`.
- **Be explicit in review:** a missing `assertRole()` on a mutating action is now
  unmitigated. Under RLS it would have been caught by the database. It will not be.

## Realtime announcements

MySQL has no `LISTEN/NOTIFY`, so `AnnouncementRepository.subscribe()` becomes polling. The
signature in `repository.ts` does not change, which is the point of the seam.

- Poll every **15s** on `published_at > lastSeen`, ordered ascending, indexed by
  `announcements_published_idx`.
- **Scope server-side.** The Postgres design relied on RLS to filter global / event-registered
  / same-college delivery automatically. That filtering must now be an explicit `WHERE` in
  the query — never a client-side filter, or every user receives every announcement and
  merely hides some of them.
- Poll only while the tab is visible (`document.visibilityState`); stop on `hidden`.
- One poller per session, in the authed layout — not per component.

## QR check-in

The token design is database-agnostic and carries over unchanged. A QR containing a
registration id is forgeable, infinitely replayable, and shareable — one screenshot in a
group chat checks in forty people. Use a rotating HMAC-signed token:

```text
FR1.<payloadB64url>.<sigB64url>
payload = { v:1, s:<user_id>, e:<event_id>|"*", j:<nonce>, w:<window>, x:<expiry> }
sig = HMAC-SHA256(payload, CHECKIN_TOKEN_SECRET)   // server-only env var
```

- **60-second expiry**, re-minted client-side every 25s → a screenshot is worthless, which
  kills the sharing attack. 60s (not 15s) survives bad venue wifi and scan queues.
- **`jti` primary key** in `checkin_token_redemptions` → single-use even inside that window.
- **Organizer scans player**, never the reverse. A static venue poster QR gets photographed
  and shared, letting people check in from their dorm.
- Verify order: authenticate scanner → assert `event_organizers.can_scan` → verify signature
  with `timingSafeEqual` → check window → check event active → check registration exists →
  `redeemCheckin`.
- **Camera requires HTTPS.** Test on a deployed preview, not `localhost`. This is the number
  one "camera doesn't work" cause.
- Provide a **manual check-in fallback** by player name, recorded with `method='manual'` and
  the organiser's id, for dead phone batteries.

## Known interface gap: payment receipts

`PaymentReceipt.fileData` in `src/backend/data/types.ts` is a base64 PDF string, because
localStorage has no filesystem. This table stores `storage_path` + `file_hash` instead.

**`PaymentReceiptRepository` is therefore the one place the repository seam genuinely
leaks.** `submit()` and the `fileData` field need reshaping when object storage lands —
probably `submit()` taking an upload handle and the read side returning a short-lived signed
URL. Do that as its own change, with `/dev/data-test` updated in the same commit; changing
it now would break `LocalRepository` for no benefit.

## Migration order

1. Provision MySQL 8.4; create `.env.local` (never commit it) with `DATABASE_URL`,
   `AUTH_SECRET`, `CHECKIN_TOKEN_SECRET`. Commit `.env.example` with empty values.
2. Enforce TLS (`?ssl-mode=REQUIRED`), confirm the port is not publicly reachable,
   IP-allowlist the app host, configure the connection pool.
3. Create `parallax_app` and `parallax_writer` with table-level grants. **Never run the app
   as `root`.**
4. Apply this DDL as a versioned migration; write the seed (colleges, departments, 7
   categories, 7 levels, ~15 achievements, sponsors). Migrations run through CI — never
   hand-run SQL against production.
5. **Run the invariant smoke test** (`scripts/check-schema.sh`). Do not skip this: it is the
   only thing that proves the keys above actually reject what they claim to.
6. Implement `MySqlRepository` against the existing `Repository` interface, behind Server
   Actions. Return the existing `DataError` codes so current UI error handling still works.
7. Run `/dev/data-test` against it — **it must pass unchanged**.
8. Flip the one line in `src/backend/data/index.ts`.
9. Move route protection from the client guard into `middleware.ts`; convert read-only
   screens to server components.
10. Only then build QR check-in, payments, and the organizer/admin dashboards, which are
    meaningless without a real server boundary.
