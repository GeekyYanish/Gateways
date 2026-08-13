import "server-only";

import fs from "node:fs";
import mysql from "mysql2/promise";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";

import { loadConfig, hasDistinctWriter, type DbConfig } from "./env";

/**
 * The two connection pools (PARALLAX Backend Implementation Plan, §2 and §4).
 *
 *   app    — public reads, profile updates, event reads, registrations,
 *            team membership. Least privilege.
 *   writer — XP awards, role grants, attendance, payment verification, audit.
 *            Server-only, small pool, never imported by general modules.
 *
 * The split is the whole point: MySQL has no row-level security, so a missed
 * `assertRole()` has no database backstop (see DECISIONS.md). Separate
 * credentials mean the application pool physically cannot perform the writes
 * that grant value or record money, even if application code is wrong.
 *
 * Do not add a third pool, and do not export the raw pools outside this module.
 */

/* -------------------------------------------------------------------------- */
/* Pool configuration                                                          */
/* -------------------------------------------------------------------------- */

/**
 * TLS options.
 *
 * mysql2 does NOT honour `?ssl-mode=REQUIRED` in a connection URL — that is a
 * MySQL CLI flag. TLS must be set here, explicitly, or the connection is
 * silently plaintext. `rejectUnauthorized` stays true unless deliberately
 * disabled, because encryption without certificate verification does not
 * protect against an active man in the middle.
 */
function sslOptions(cfg: DbConfig): mysql.PoolOptions["ssl"] {
  if (cfg.DB_SSL_INSECURE) {
    return { rejectUnauthorized: false, minVersion: "TLSv1.2" };
  }
  if (cfg.DB_SSL_CA_PATH) {
    return {
      ca: fs.readFileSync(cfg.DB_SSL_CA_PATH, "utf8"),
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
    };
  }
  return { rejectUnauthorized: true, minVersion: "TLSv1.2" };
}

/**
 * Build pool options from a mysql:// URL.
 *
 * The URL is decomposed by hand rather than passed to mysql2 as `uri`, because
 * the `uri` form quietly drops options it does not recognise — including the
 * TLS setting above, which is exactly the one that must not be dropped.
 */
function poolOptions(
  url: string,
  connectionLimit: number,
  cfg: DbConfig,
): mysql.PoolOptions {
  const u = new URL(url);

  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.replace(/^\//, "")),

    ssl: sslOptions(cfg),

    // --- The settings MYSQL-MIGRATION.md marks as not optional -------------
    timezone: "Z", // or DATETIME(3) values shift silently by the server offset
    supportBigNumbers: true,
    bigNumberStrings: true, // xp_ledger.id is BIGINT; JS loses precision at 2^53
    dateStrings: true, // domain types are ISO strings, not Date

    // --- Bounded pool ------------------------------------------------------
    connectionLimit,
    waitForConnections: true,
    queueLimit: 0,
    maxIdle: connectionLimit,
    idleTimeout: 60_000,
    connectTimeout: 10_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 30_000,

    // Multiple statements per query is an SQL-injection amplifier. Off.
    multipleStatements: false,
  };
}

/**
 * Apply per-connection session settings.
 *
 * These cannot go in `poolOptions` because they are SQL, not driver config.
 * mysql2 queues queries on a connection in issue order, so statements fired
 * from the `connection` event land before anything the acquiring caller sends.
 */
function attachSessionSettings(pool: mysql.Pool, cfg: DbConfig): void {
  pool.on("connection", (conn) => {
    /**
     * Issue a setting, falling back to an alternate spelling if the server does
     * not recognise it.
     *
     * MySQL and MariaDB diverge on two of these. A failed SET must not kill the
     * connection — an unsupported timeout variable is a degradation worth
     * reporting (db:check does), not a reason to refuse to serve traffic.
     */
    /**
     * NOTE: despite the published types, the `connection` event emits mysql2's
     * CORE (callback-style) connection even on a promise pool. Calling
     * `.catch()` on `conn.query(...)` here throws "result of query is not a
     * promise" at runtime. The cast below is deliberate and load-bearing.
     */
    const raw = conn as unknown as {
      query: (sql: string, cb: (err: unknown) => void) => void;
    };

    const trySet = (sql: string, fallback?: string) => {
      raw.query(sql, (err) => {
        if (err && fallback) raw.query(fallback, () => {});
      });
    };

    // READ COMMITTED, not the REPEATABLE READ default: capacity and membership
    // counts must see committed changes while explicit SELECT ... FOR UPDATE
    // locks enforce correctness.
    // See MYSQL-MIGRATION.md, "The correctness trap: REPEATABLE READ".
    // MariaDB below 11.1 spells this `tx_isolation`.
    trySet(
      "SET SESSION transaction_isolation = 'READ-COMMITTED'",
      "SET SESSION tx_isolation = 'READ-COMMITTED'",
    );

    trySet("SET SESSION time_zone = '+00:00'");
    trySet(`SET SESSION innodb_lock_wait_timeout = ${cfg.DB_LOCK_WAIT_TIMEOUT_S}`);

    // Statement timeout. MySQL: max_execution_time, milliseconds, SELECT only.
    // MariaDB: max_statement_time, SECONDS as a float, all statement types.
    trySet(
      `SET SESSION max_execution_time = ${cfg.DB_STATEMENT_TIMEOUT_MS}`,
      `SET SESSION max_statement_time = ${cfg.DB_STATEMENT_TIMEOUT_MS / 1000}`,
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Pool construction                                                           */
/* -------------------------------------------------------------------------- */

export type Db = MySql2Database<Record<string, never>>;

type Handle = { pool: mysql.Pool; db: Db };

/**
 * Memoised across hot reloads. Next's dev server re-evaluates modules on every
 * edit; without this, each save leaks a pool and you exhaust max_connections
 * after a few dozen edits.
 */
const globalForDb = globalThis as unknown as {
  __parallaxApp?: Handle;
  __parallaxWriter?: Handle;
};

function build(url: string, size: number, cfg: DbConfig): Handle {
  const pool = mysql.createPool(poolOptions(url, size, cfg));
  attachSessionSettings(pool, cfg);
  return { pool, db: drizzle(pool) };
}

/** The least-privilege application connection. Use this by default. */
export function getAppDb(): Db {
  const cfg = loadConfig();
  globalForDb.__parallaxApp ??= build(cfg.DATABASE_URL, cfg.DB_POOL_SIZE, cfg);
  return globalForDb.__parallaxApp.db;
}

/**
 * The privileged writer connection.
 *
 * Import ONLY from the handful of server functions that award XP, grant roles,
 * record attendance, verify payments, or write audit rows. If you are reaching
 * for this from a read path, you want `getAppDb()`.
 */
export function getWriterDb(): Db {
  const cfg = loadConfig();
  const url = cfg.WRITER_DATABASE_URL ?? cfg.DATABASE_URL;
  globalForDb.__parallaxWriter ??= build(url, cfg.DB_WRITER_POOL_SIZE, cfg);
  return globalForDb.__parallaxWriter.db;
}

/** Raw pools. For health checks and diagnostics only — prefer the Drizzle handles. */
export function getPools(): { app: mysql.Pool; writer: mysql.Pool } {
  getAppDb();
  getWriterDb();
  return {
    app: globalForDb.__parallaxApp!.pool,
    writer: globalForDb.__parallaxWriter!.pool,
  };
}

/**
 * Graceful shutdown. Call from a SIGTERM handler or at the end of a script, or
 * the process hangs on open sockets.
 */
export async function closePools(): Promise<void> {
  await Promise.allSettled([
    globalForDb.__parallaxApp?.pool.end(),
    globalForDb.__parallaxWriter?.pool.end(),
  ]);
  globalForDb.__parallaxApp = undefined;
  globalForDb.__parallaxWriter = undefined;
}

export { hasDistinctWriter };
