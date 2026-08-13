/**
 * Connection check — Person 1, step 1.
 *
 *   npm run db:check
 *
 * Proves the things you cannot prove by reading config: that the credentials
 * work, that TLS is actually negotiated, that the session settings took effect,
 * and — the question blocking the least-privilege design — whether your account
 * is allowed to CREATE USER and GRANT.
 *
 * Reads .env.local. Never prints a password. Safe to run against preproduction;
 * it issues no writes and no DDL.
 */

import { loadConfig, hasDistinctWriter } from "../src/backend/db/env";
import { getPools, closePools } from "../src/backend/db/client";
import type { Pool, RowDataPacket } from "mysql2/promise";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

let failures = 0;
let warnings = 0;

const pass = (m: string) => console.log(`  ${GREEN}PASS${RESET} ${m}`);
const warn = (m: string) => {
  warnings++;
  console.log(`  ${YELLOW}WARN${RESET} ${m}`);
};
const fail = (m: string) => {
  failures++;
  console.log(`  ${RED}FAIL${RESET} ${m}`);
};
const note = (m: string) => console.log(`       ${DIM}${m}${RESET}`);

async function q<T extends RowDataPacket>(pool: Pool, sql: string): Promise<T[]> {
  const [rows] = await pool.query<T[]>(sql);
  return rows;
}

/** Describe a connection without leaking the password. */
function redact(url: string): string {
  try {
    const u = new URL(url);
    return `${u.username}@${u.hostname}:${u.port || 3306}/${u.pathname.replace(/^\//, "")}`;
  } catch {
    return "(unparseable URL)";
  }
}

async function inspect(label: string, pool: Pool, url: string): Promise<void> {
  console.log(`\n${label}  ${DIM}${redact(url)}${RESET}`);

  // --- Connectivity -------------------------------------------------------
  let version: string;
  try {
    const rows = await q<RowDataPacket>(pool, "SELECT VERSION() AS v, CURRENT_USER() AS u");
    version = String(rows[0].v);
    pass(`connected — MySQL ${version}, authenticated as ${rows[0].u}`);
  } catch (err) {
    fail(`cannot connect: ${(err as Error).message}`);
    return;
  }

  // --- Server flavour -----------------------------------------------------
  // MariaDB is not a drop-in substitute for MySQL 8.4 here. The schema in
  // MYSQL-MIGRATION.md pins utf8mb4_0900_ai_ci on all 27 tables, and that
  // collation does not exist outside MySQL 8.
  const isMariaDB = /mariadb/i.test(version);

  if (isMariaDB) {
    fail(`server is MariaDB (${version}), not MySQL — the schema targets MySQL 8.4`);
  } else if (!/^8\.[0-9]/.test(version)) {
    warn(`server is ${version}; the schema targets MySQL 8.4`);
  } else {
    pass("server is MySQL 8.x");
  }

  // The single most consequential incompatibility: probe for it directly
  // rather than discovering it when migration 0001 fails.
  const coll = await q<RowDataPacket>(
    pool,
    "SHOW COLLATION LIKE 'utf8mb4_0900_ai_ci'",
  );
  if (coll.length > 0) {
    pass("utf8mb4_0900_ai_ci available — schema DDL will apply as written");
  } else {
    fail("utf8mb4_0900_ai_ci NOT available — all 27 CREATE TABLE statements will fail");
    const alt = await q<RowDataPacket>(
      pool,
      "SHOW COLLATION WHERE Charset = 'utf8mb4' AND Collation LIKE '%uca1400_ai_ci%'",
    );
    note(
      alt.length > 0
        ? `nearest equivalent on this server: ${String(alt[0].Collation)}`
        : "no uca1400 equivalent either; nearest is utf8mb4_unicode_ci (weaker)",
    );
  }

  // --- TLS ----------------------------------------------------------------
  // An empty Ssl_cipher means the connection is PLAINTEXT, regardless of what
  // the connection URL claims.
  const ssl = await q<RowDataPacket>(pool, "SHOW SESSION STATUS LIKE 'Ssl_cipher'");
  const cipher = ssl[0]?.Value ? String(ssl[0].Value) : "";
  if (cipher) {
    pass(`TLS active — ${cipher}`);
  } else {
    fail("connection is NOT encrypted (Ssl_cipher is empty)");
    note("credentials are crossing the network in plaintext; fix before preproduction");
  }

  // --- Session settings ---------------------------------------------------
  const s = (
    await q<RowDataPacket>(
      pool,
      "SELECT @@session.time_zone AS tz, @@session.transaction_isolation AS iso, " +
        "@@session.innodb_lock_wait_timeout AS lockwait",
    )
  )[0];

  s.tz === "+00:00"
    ? pass("session time_zone = +00:00 (UTC)")
    : fail(`session time_zone is ${s.tz}, expected +00:00 — DATETIME(3) values will shift`);

  s.iso === "READ-COMMITTED"
    ? pass("transaction_isolation = READ-COMMITTED")
    : fail(`transaction_isolation is ${s.iso}, expected READ-COMMITTED`);

  pass(`innodb_lock_wait_timeout = ${s.lockwait}s`);

  // --- Precision ----------------------------------------------------------
  // xp_ledger.id is BIGINT UNSIGNED and XpEntry.id is a string in the domain
  // types. If this arrives as a number, precision is already lost.
  const big = (
    await q<RowDataPacket>(pool, "SELECT 9223372036854775807 AS n, NOW(3) AS t")
  )[0];
  typeof big.n === "string"
    ? pass("BIGINT returned as string (bigNumberStrings active)")
    : fail(`BIGINT returned as ${typeof big.n} — precision loss above 2^53`);

  typeof big.t === "string"
    ? pass("DATETIME returned as string (dateStrings active)")
    : fail(`DATETIME returned as ${typeof big.t} — domain layer expects ISO strings`);

  // --- Grants -------------------------------------------------------------
  const grants = (await q<RowDataPacket>(pool, "SHOW GRANTS FOR CURRENT_USER()")).map(
    (r) => String(Object.values(r)[0]),
  );

  console.log(`\n  ${DIM}grants:${RESET}`);
  for (const g of grants) console.log(`       ${DIM}${g}${RESET}`);

  const canCreateUser = grants.some((g) => /\bCREATE USER\b|\bALL PRIVILEGES\b.*\bON \*\.\*/i.test(g));
  const hasGrantOption = grants.some((g) => /WITH GRANT OPTION/i.test(g));

  if (canCreateUser && hasGrantOption) {
    pass("account can CREATE USER and GRANT — the two-role split is available");
  } else {
    warn("account cannot CREATE USER / GRANT");
    note("you cannot create parallax_app + parallax_writer from this credential");
    note("ask your DB provider for a second user, or accept the documented gap");
  }

  if (grants.some((g) => /ALL PRIVILEGES ON \*\.\*/i.test(g))) {
    warn("this credential has ALL PRIVILEGES ON *.* — never run the app as this user");
  }
}

async function main(): Promise<void> {
  console.log("\nPARALLAX database connection check");

  const cfg = loadConfig();
  const pools = getPools();

  await inspect("APPLICATION", pools.app, cfg.DATABASE_URL);

  if (hasDistinctWriter(cfg)) {
    await inspect("WRITER", pools.writer, cfg.WRITER_DATABASE_URL!);
  } else {
    console.log(`\nWRITER`);
    warn("WRITER_DATABASE_URL is unset or identical to DATABASE_URL");
    note("the least-privilege invariant is NOT enforced: the application");
    note("credential can write xp_ledger, attendance, user_roles and payments");
    note("this is an accepted gap only if recorded in DECISIONS.md");
  }

  console.log(
    `\n${failures ? RED : GREEN}${failures} failed${RESET}, ` +
      `${warnings ? YELLOW : ""}${warnings} warnings${RESET}\n`,
  );

  await closePools();
  process.exit(failures > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(`\n${RED}${(err as Error).message}${RESET}\n`);
  await closePools();
  process.exit(1);
});
