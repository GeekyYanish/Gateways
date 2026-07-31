#!/usr/bin/env bash
#
# Applies the DDL in MYSQL-MIGRATION.md to a scratch database, then asserts that the
# integrity invariants actually reject what they claim to reject.
#
# Step 5 of the migration order. It is the only thing that proves the unique keys are
# real rather than aspirational, so do not skip it — and run it in CI on every change
# to MYSQL-MIGRATION.md.
#
# Usage:
#   scripts/check-schema.sh
#   MYSQL_OPTS="--socket=/tmp/px3399.sock" scripts/check-schema.sh
#   MYSQL_OPTS="-h db.internal -P 3306 -p" MYSQL_USER=root scripts/check-schema.sh
#
# It DROPs and recreates $SCHEMA_CHECK_DB. Never point it at a database you care about.

set -euo pipefail

DB="${SCHEMA_CHECK_DB:-parallax_schema_check}"
USER="${MYSQL_USER:-root}"
# shellcheck disable=SC2206  # deliberate word-splitting of caller-supplied client flags
OPTS=(${MYSQL_OPTS:-})
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOC="$ROOT/MYSQL-MIGRATION.md"
SQL="$(mktemp -t parallax-schema)"
trap 'rm -f "$SQL"' EXIT

pass=0 fail=0
ok()   { printf '  \033[32mPASS\033[0m %s\n' "$1"; pass=$((pass + 1)); }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$1"; fail=$((fail + 1)); }
my()   { mysql "${OPTS[@]}" -u "$USER" "$DB" -N -B "$@"; }

# Asserts the statement is REJECTED. An invariant that does not reject is not an invariant.
expect_fail() {
  local label="$1" stmt="$2"
  if my -e "$stmt" >/dev/null 2>&1; then bad "$label (statement was ACCEPTED)"; else ok "$label"; fi
}
expect_ok() {
  local label="$1" stmt="$2" err
  if err="$(my -e "$stmt" 2>&1)"; then ok "$label"; else bad "$label — $err"; fi
}
expect_eq() {
  local label="$1" stmt="$2" want="$3" got
  got="$(my -e "$stmt" 2>&1 | tr -d '[:space:]')"
  if [[ "$got" == "$want" ]]; then ok "$label"; else bad "$label (want $want, got $got)"; fi
}

# ---------------------------------------------------------------------------
# 1. The DDL applies cleanly.
# ---------------------------------------------------------------------------
# Only ```sql fences are executable DDL; ```mysql fences are operational examples
# (grants with placeholder credentials, session settings) and must not be applied.
python3 - "$DOC" "$SQL" <<'PY'
import re, sys, pathlib
doc, out = sys.argv[1], sys.argv[2]
blocks = re.findall(r'```sql\n(.*?)```', pathlib.Path(doc).read_text(), re.S)
if not blocks:
    sys.exit("no ```sql blocks found in %s" % doc)
pathlib.Path(out).write_text("\n".join(blocks))
print("extracted %d sql blocks" % len(blocks))
PY

echo "==> applying schema to \`$DB\`"
mysql "${OPTS[@]}" -u "$USER" -e "DROP DATABASE IF EXISTS \`$DB\`;
  CREATE DATABASE \`$DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
mysql "${OPTS[@]}" -u "$USER" "$DB" < "$SQL"

echo "==> object counts"
my -e "SELECT CONCAT('  tables: ', COUNT(*)) FROM information_schema.tables
       WHERE table_schema='$DB' AND table_type='BASE TABLE'"
my -e "SELECT CONCAT('  views:  ', COUNT(*)) FROM information_schema.views WHERE table_schema='$DB'"
my -e "SELECT CONCAT('  fks:    ', COUNT(*)) FROM information_schema.referential_constraints WHERE constraint_schema='$DB'"
my -e "SELECT CONCAT('  checks: ', COUNT(*)) FROM information_schema.check_constraints WHERE constraint_schema='$DB'"

# ---------------------------------------------------------------------------
# 2. Fixtures.
# ---------------------------------------------------------------------------
echo "==> seeding fixtures"
my -e "
INSERT INTO users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111','player@example.edu'),
  ('22222222-2222-2222-2222-222222222222','organizer@example.edu');
INSERT INTO colleges (id, name, short_name) VALUES
  ('c1111111-1111-1111-1111-111111111111','Example Institute of Technology','EIT');
INSERT INTO levels (level, min_xp, title) VALUES (1,0,'Wanderer'), (2,100,'Pathfinder');
INSERT INTO event_categories (id, slug, name) VALUES
  ('e1111111-1111-1111-1111-111111111111','code','Code');
INSERT INTO events (id, slug, title, category_id, status, capacity, xp_reward, starts_at, ends_at)
VALUES ('a1111111-1111-1111-1111-111111111111','hackathon-mine','Hackathon Mine',
        'e1111111-1111-1111-1111-111111111111','published',1,50,
        '2026-09-01 09:00:00.000','2026-09-01 18:00:00.000');
INSERT INTO achievements (id, code, name, description) VALUES
  ('b1111111-1111-1111-1111-111111111111','first_steps','First Steps','Registered for an event.');
INSERT INTO registrations (id, event_id, user_id) VALUES
  ('d1111111-1111-1111-1111-111111111111','a1111111-1111-1111-1111-111111111111',
   '11111111-1111-1111-1111-111111111111');
"

echo "==> invariants"

# The regression test for the stale skin_id constraint. The Postgres spec still listed
# Mojang's character names; applied as written, every character insert failed.
expect_ok "character insert accepts the real archetype 'prospector'" \
  "INSERT INTO characters (id, user_id, player_name, skin_id, college_id)
   VALUES ('f1111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111',
           'RidgeWalker','prospector','c1111111-1111-1111-1111-111111111111')"

expect_fail "skin_id rejects a value outside the archetype enum" \
  "INSERT INTO characters (id, user_id, player_name, skin_id)
   VALUES ('f2222222-2222-2222-2222-222222222222','22222222-2222-2222-2222-222222222222','Steve2','steve')"

# Case AND accent variation must not enable impersonation.
expect_fail "player_name unique is case-insensitive (ridgewalker vs RidgeWalker)" \
  "INSERT INTO characters (id, user_id, player_name, skin_id)
   VALUES ('f3333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222','ridgewalker','botanist')"

expect_fail "player_name rejects characters outside [A-Za-z0-9_]" \
  "INSERT INTO characters (id, user_id, player_name, skin_id)
   VALUES ('f4444444-4444-4444-4444-444444444444','22222222-2222-2222-2222-222222222222','bad name!','botanist')"

expect_fail "player_name rejects fewer than 3 characters" \
  "INSERT INTO characters (id, user_id, player_name, skin_id)
   VALUES ('f5555555-5555-5555-5555-555555555555','22222222-2222-2222-2222-222222222222','ab','botanist')"

expect_fail "no double registration for the same (event, user)" \
  "INSERT INTO registrations (id, event_id, user_id)
   VALUES ('d2222222-2222-2222-2222-222222222222','a1111111-1111-1111-1111-111111111111',
           '11111111-1111-1111-1111-111111111111')"

# XP idempotency: the second grant must be absorbed, reporting 0 affected rows.
my -e "INSERT INTO xp_ledger (user_id, amount, reason, source_type, source_id)
       VALUES ('11111111-1111-1111-1111-111111111111',10,'Registered','registration',
               'a1111111-1111-1111-1111-111111111111')
       ON DUPLICATE KEY UPDATE user_id = user_id" >/dev/null
expect_eq "repeated XP grant reports ROW_COUNT() = 0 (idempotent, no double-pay)" \
  "INSERT INTO xp_ledger (user_id, amount, reason, source_type, source_id)
   VALUES ('11111111-1111-1111-1111-111111111111',10,'Registered','registration',
           'a1111111-1111-1111-1111-111111111111')
   ON DUPLICATE KEY UPDATE user_id = user_id;
   SELECT ROW_COUNT()" "0"

expect_eq "the ledger holds exactly one row after the duplicate grant" \
  "SELECT COUNT(*) FROM xp_ledger WHERE user_id='11111111-1111-1111-1111-111111111111'" "1"

expect_fail "xp_ledger rejects a zero-amount grant" \
  "INSERT INTO xp_ledger (user_id, amount, reason, source_type, source_id)
   VALUES ('11111111-1111-1111-1111-111111111111',0,'Nothing','admin',
           'a1111111-1111-1111-1111-111111111111')"

my -e "INSERT INTO attendance (id, event_id, user_id)
       VALUES ('aa111111-1111-1111-1111-111111111111','a1111111-1111-1111-1111-111111111111',
               '11111111-1111-1111-1111-111111111111')" >/dev/null
expect_fail "no double check-in for the same (event, user)" \
  "INSERT INTO attendance (id, event_id, user_id)
   VALUES ('aa222222-2222-2222-2222-222222222222','a1111111-1111-1111-1111-111111111111',
           '11111111-1111-1111-1111-111111111111')"

my -e "INSERT INTO checkin_token_redemptions (jti, user_id, event_id)
       VALUES ('jti-abc-123','11111111-1111-1111-1111-111111111111',
               'a1111111-1111-1111-1111-111111111111')" >/dev/null
expect_fail "a replayed check-in token (same jti) is rejected" \
  "INSERT INTO checkin_token_redemptions (jti, user_id, event_id)
   VALUES ('jti-abc-123','22222222-2222-2222-2222-222222222222',
           'a1111111-1111-1111-1111-111111111111')"

my -e "INSERT INTO user_achievements (user_id, achievement_id)
       VALUES ('11111111-1111-1111-1111-111111111111','b1111111-1111-1111-1111-111111111111')" >/dev/null
expect_fail "an achievement unlocks only once" \
  "INSERT INTO user_achievements (user_id, achievement_id)
   VALUES ('11111111-1111-1111-1111-111111111111','b1111111-1111-1111-1111-111111111111')"

expect_ok "one receipt per registration is accepted" \
  "INSERT INTO payment_receipts (id, registration_id, event_id, user_id, storage_path,
                                 file_name, file_hash, file_size_bytes)
   VALUES ('ab111111-1111-1111-1111-111111111111','d1111111-1111-1111-1111-111111111111',
           'a1111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111',
           'receipts/2026/abc.pdf','fee.pdf',REPEAT('a',64),20480)"

expect_fail "a second receipt for the same registration is rejected" \
  "INSERT INTO payment_receipts (id, registration_id, event_id, user_id, storage_path,
                                 file_name, file_hash, file_size_bytes)
   VALUES ('ab222222-2222-2222-2222-222222222222','d1111111-1111-1111-1111-111111111111',
           'a1111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111',
           'receipts/2026/def.pdf','fee2.pdf',REPEAT('b',64),20480)"

expect_fail "a verified receipt must name its reviewer" \
  "UPDATE payment_receipts SET status='verified'
   WHERE id='ab111111-1111-1111-1111-111111111111'"

expect_fail "an event cannot end before it starts" \
  "INSERT INTO events (id, slug, title, category_id, starts_at, ends_at)
   VALUES ('a9999999-9999-9999-9999-999999999999','bad-time','Bad Time',
           'e1111111-1111-1111-1111-111111111111','2026-09-02 10:00:00.000','2026-09-01 10:00:00.000')"

expect_fail "max_team_size cannot be below min_team_size" \
  "INSERT INTO events (id, slug, title, category_id, min_team_size, max_team_size, starts_at, ends_at)
   VALUES ('a8888888-8888-8888-8888-888888888888','bad-team','Bad Team',
           'e1111111-1111-1111-1111-111111111111',4,2,'2026-09-01 09:00:00.000','2026-09-01 18:00:00.000')"

expect_fail "a global announcement cannot target an event" \
  "INSERT INTO announcements (id, scope, event_id, title, body)
   VALUES ('ac111111-1111-1111-1111-111111111111','global',
           'a1111111-1111-1111-1111-111111111111','Bad','Scope mismatch')"

expect_fail "an event-scoped announcement must name an event" \
  "INSERT INTO announcements (id, scope, title, body)
   VALUES ('ac222222-2222-2222-2222-222222222222','event','Bad','Missing event')"

# Generic departments (college_id IS NULL) are deduped by the college_key generated
# column, because NULLs are distinct in a plain unique key.
my -e "INSERT INTO departments (id, college_id, name)
       VALUES ('de111111-1111-1111-1111-111111111111',NULL,'Physics')" >/dev/null
expect_fail "two generic departments cannot share a name" \
  "INSERT INTO departments (id, college_id, name)
   VALUES ('de222222-2222-2222-2222-222222222222',NULL,'Physics')"
expect_ok "a college-scoped department may reuse a generic department's name" \
  "INSERT INTO departments (id, college_id, name)
   VALUES ('de333333-3333-3333-3333-333333333333','c1111111-1111-1111-1111-111111111111','Physics')"

expect_fail "email uniqueness is case-insensitive" \
  "INSERT INTO users (id, email) VALUES ('99999999-9999-9999-9999-999999999999','Player@Example.edu')"

echo "==> views"
expect_ok "leaderboard is queryable" "SELECT \`rank\`, player_name, total_xp FROM leaderboard"
expect_ok "event_stats is queryable" "SELECT event_id, confirmed_count, seats_left FROM event_stats"
expect_eq "event_stats reports the seat consumed by the confirmed registration" \
  "SELECT seats_left FROM event_stats WHERE event_id='a1111111-1111-1111-1111-111111111111'" "0"

echo
printf '%s passed, %s failed\n' "$pass" "$fail"
[[ "$fail" -eq 0 ]] || exit 1
