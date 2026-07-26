# Supabase migration plan

The app currently runs on `LocalRepository` (localStorage). This document is the
complete design for replacing it with Supabase Auth + Postgres, written while the
domain model was fresh so the swap is mechanical rather than archaeological.

## Why the swap is cheap

Nothing in the app imports a concrete data implementation. Screens and hooks
depend only on the `Repository` interface in `src/lib/data/repository.ts`, and
`src/lib/data/index.ts` is the single construction point:

```ts
// today
const instance = createLocalRepository();
// after migration
const instance = createSupabaseRepository();
```

Every repository method is already `async`, and the domain types in
`src/lib/data/types.ts` mirror the column names below one-to-one, so the Supabase
implementation is a mapping layer — no call sites change.

`src/app/dev/data-test` is the acceptance test. **It should pass unchanged
against the Supabase implementation.** If it does not, the interface contract was
broken.

## What localStorage is NOT giving you today

Be explicit about this, because it determines what must land before a real fest:

- **No security boundary.** Any user can edit their own roles, XP, or
  registrations in devtools. Organizer and admin dashboards are UI-only.
- **No trustworthy QR check-in.** Forgery cannot be detected without a
  server-held secret. Do not run attendance-based prizes on the prototype.
- **No cross-device data.** A user's character exists only in one browser.
- **Passwords are hashed but offline-attackable.** SHA-256 + salt in
  localStorage protects against casual disclosure, nothing more.

## Packages

```
@supabase/supabase-js @supabase/ssr
```

`@supabase/ssr`, not the deprecated auth-helpers — it is the only supported
cookie-based session path for the App Router.

Note: the current app is entirely client-side (`"use client"` under a
`SessionProvider`) because localStorage has no server presence. After migration,
data-fetching screens should become server components and route protection should
move from the client guard in `(realm)/layout.tsx` into `middleware.ts`.

## Role model — three layers

This is the part that gets apps owned. All three layers are required.

**Layer 1 — `public.user_roles` is the sole source of truth.** Role is a row in a
table whose RLS forbids all writes except by an admin.

> **Never** put `role` in `profiles` (user-updatable) or in
> `auth.users.raw_user_meta_data` (client-writable via `updateUser`). Any signed-in
> user could call `supabase.auth.updateUser({ data: { role: 'admin' } })` and own
> the database.

**Layer 2 — the JWT claim is a render cache only.** A custom access-token hook
copies the role into `app_metadata.app_role`. Middleware and layouts read it to
decide what to *render*. It is never the basis of a mutation decision, because a
revoked role persists in an unexpired token for up to an hour.

**Layer 3 — RLS re-derives the role from the table on every mutation.**

```sql
create or replace function public.has_role(p_role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles
                 where user_id = auth.uid() and role = p_role);
$$;

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select public.has_role('admin');
$$;

-- Scoped: is this user an organizer OF THIS event? "organizer" is not god-mode.
create or replace function public.manages_event(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from public.event_organizers
                 where event_id = p_event and user_id = auth.uid());
$$;
```

`manages_event` matters: an organizer of Photography Forest must not read
Hackathon Mine's registration list.

**Service-role key discipline.** `src/lib/supabase/admin.ts` must begin with
`import "server-only"` and throw if `typeof window !== "undefined"`. It bypasses
all RLS, so every call site needs an explicit role assertion first. Add a CI grep
that fails the build if `SERVICE_ROLE` appears anywhere in `src/**` outside that
file.

## Enums

```sql
create type public.app_role            as enum ('player','organizer','admin');
create type public.event_status        as enum ('draft','pending_review','published','registration_closed','ongoing','completed','cancelled');
create type public.event_mode          as enum ('solo','team','either');
create type public.registration_status as enum ('pending','confirmed','waitlisted','cancelled','rejected');
create type public.attendance_method   as enum ('qr','manual','self');
create type public.team_member_role    as enum ('leader','member');
create type public.rarity              as enum ('common','uncommon','rare','epic','legendary');
create type public.announcement_scope  as enum ('global','event','college');
create type public.announcement_severity as enum ('info','success','warning','critical');
create type public.certificate_kind    as enum ('participation','winner','runner_up','special','volunteer');
create type public.achievement_trigger as enum ('manual','first_registration','event_attended','events_attended_count','team_created','profile_completed','xp_threshold');
```

## Schema

Only the constraints that carry real weight are annotated.

```sql
create extension if not exists "pgcrypto";
create extension if not exists "citext";

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      citext not null,
  full_name  text,
  phone      text,
  is_banned  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.app_role not null,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.colleges (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short_name text not null unique,
  city text,
  is_active boolean not null default true
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  college_id uuid references public.colleges(id) on delete cascade,  -- null = generic
  name text not null,
  short_name text,
  unique (college_id, name)
);

create table public.characters (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users(id) on delete cascade,
  -- citext + unique: "Steve" and "steve" collide, as in Minecraft. Prevents
  -- impersonation via case variation.
  player_name   citext not null unique
                  check (char_length(player_name) between 3 and 16
                         and player_name ~ '^[A-Za-z0-9_]+$'),
  college_id    uuid references public.colleges(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  year_of_study smallint check (year_of_study between 1 and 6),
  skin_id       text not null default 'steve'
                  check (skin_id in ('steve','alex','creeper','enderman','miner')),
  bio           text check (char_length(bio) <= 280),
  -- Denormalised cache of xp_ledger, maintained by trigger. Never incremented
  -- in place: always recomputed as the ledger sum, so it cannot drift.
  total_xp      integer not null default 0 check (total_xp >= 0),
  level         smallint not null default 1 check (level >= 1),
  title         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- created_at asc as tiebreak gives a deterministic leaderboard: ranks do not
-- shuffle between reloads when players are level-pegged.
create index characters_xp_idx on public.characters(total_xp desc, created_at asc);

create table public.levels (
  level  smallint primary key,
  min_xp integer not null unique,
  title  text not null
);

create table public.xp_ledger (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  amount      integer not null check (amount <> 0),
  reason      text not null,
  source_type text not null,
  source_id   uuid,
  created_at  timestamptz not null default now(),
  -- THE idempotency guard. Re-running "award attendance XP" cannot double-pay.
  unique (user_id, source_type, source_id, reason)
);

create table public.event_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  world_location_key text unique,   -- links to WORLD_LOCATIONS in the client
  block_color text,
  sort_order smallint not null default 0
);

create table public.events (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  tagline       text,
  description   text,
  rules         text,
  category_id   uuid not null references public.event_categories(id) on delete restrict,
  status        public.event_status not null default 'draft',
  mode          public.event_mode not null default 'solo',
  min_team_size smallint not null default 1 check (min_team_size >= 1),
  max_team_size smallint not null default 1 check (max_team_size >= min_team_size),
  capacity      integer check (capacity > 0),   -- null = unlimited
  venue         text,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  registration_opens_at  timestamptz,
  registration_closes_at timestamptz,
  xp_reward     integer not null default 50 check (xp_reward >= 0),
  entry_fee_inr integer not null default 0 check (entry_fee_inr >= 0),
  requires_approval boolean not null default false,
  contact_email text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint events_time_order check (ends_at > starts_at)
);
create index events_status_starts_idx on public.events(status, starts_at);

create table public.event_organizers (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  can_scan boolean not null default true,
  can_edit boolean not null default true,
  primary key (event_id, user_id)
);

create table public.teams (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid not null references public.events(id) on delete cascade,
  name      text not null check (char_length(name) between 3 and 32),
  join_code text not null unique
              default upper(substr(encode(gen_random_bytes(6),'hex'),1,6)),
  leader_id uuid not null references auth.users(id) on delete cascade,
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (event_id, name)
);

create table public.team_members (
  team_id   uuid not null references public.teams(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      public.team_member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table public.registrations (
  id       uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  team_id  uuid references public.teams(id) on delete set null,
  status   public.registration_status not null default 'confirmed',
  registered_at timestamptz not null default now(),
  cancelled_at  timestamptz,
  -- Database-enforced guard against double registration. An application-level
  -- `if (already registered)` races under concurrent requests.
  unique (event_id, user_id)
);
create index registrations_event_idx on public.registrations(event_id, status);

create table public.attendance (
  id       uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  registration_id uuid references public.registrations(id) on delete set null,
  method   public.attendance_method not null default 'qr',
  checked_in_at timestamptz not null default now(),
  scanned_by uuid references auth.users(id) on delete set null,
  token_jti text,
  unique (event_id, user_id)   -- DOUBLE CHECK-IN IMPOSSIBLE
);

-- Replay protection, separate from attendance uniqueness: blocks reuse of a
-- specific token even if the attendance row was later deleted.
create table public.checkin_token_redemptions (
  jti         text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  event_id    uuid references public.events(id) on delete set null,
  redeemed_at timestamptz not null default now(),
  redeemed_by uuid references auth.users(id) on delete set null
);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  flavor_text text,
  rarity public.rarity not null default 'common',
  xp_reward integer not null default 25 check (xp_reward >= 0),
  trigger_type public.achievement_trigger not null default 'manual',
  trigger_config jsonb not null default '{}'::jsonb,
  is_secret boolean not null default false,
  is_active boolean not null default true,
  sort_order smallint not null default 0
);

create table public.user_achievements (
  user_id        uuid not null references auth.users(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  unlocked_at    timestamptz not null default now(),
  seen_at        timestamptz,   -- null => show the unlock cinematic
  primary key (user_id, achievement_id)   -- unlocking twice is impossible
);
create index user_achievements_unseen_idx
  on public.user_achievements(user_id) where seen_at is null;

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  scope public.announcement_scope not null default 'global',
  event_id   uuid references public.events(id) on delete cascade,
  college_id uuid references public.colleges(id) on delete cascade,
  title text not null,
  body  text not null,
  severity public.announcement_severity not null default 'info',
  is_pinned boolean not null default false,
  published_at timestamptz not null default now(),
  expires_at   timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  constraint announcements_scope_target check (
    (scope = 'global'  and event_id is null and college_id is null) or
    (scope = 'event'   and event_id is not null) or
    (scope = 'college' and college_id is not null))
);

create table public.schedule_slots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  title text not null,
  day_label text not null,
  starts_at timestamptz not null,
  ends_at   timestamptz not null,
  venue text,
  track text,
  is_break boolean not null default false,
  constraint schedule_time_order check (ends_at > starts_at)
);

create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tier text not null check (tier in ('diamond','gold','iron','stone')),
  website_url text,
  blurb text,
  sort_order smallint not null default 0,
  is_active boolean not null default true
);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  kind public.certificate_kind not null default 'participation',
  serial text not null unique,
  storage_path text,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, event_id, kind)
);
```

## RLS policies

Enable RLS on **every** table. A table with RLS enabled and no policy denies all
access, which is the correct default — add policies deliberately.

```sql
alter table public.profiles enable row level security;
create policy "own profile readable" on public.profiles
  for select using (id = auth.uid() or public.is_staff());
create policy "own profile updatable" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

alter table public.user_roles enable row level security;
create policy "roles readable by self and admin" on public.user_roles
  for select using (user_id = auth.uid() or public.is_admin());
-- Only admins may write roles. This is the privilege-escalation boundary.
create policy "roles admin-write" on public.user_roles
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.characters enable row level security;
-- Characters are public: the leaderboard and profile pages need them.
create policy "characters public read" on public.characters for select using (true);
create policy "own character writable" on public.characters
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.events enable row level security;
create policy "published events public" on public.events
  for select using (status in ('published','registration_closed','ongoing','completed')
                    or public.manages_event(id));
create policy "organizers edit own events" on public.events
  for update using (public.manages_event(id)) with check (public.manages_event(id));
create policy "admins insert events" on public.events
  for insert with check (public.is_staff());

alter table public.registrations enable row level security;
create policy "own registrations readable" on public.registrations
  for select using (user_id = auth.uid() or public.manages_event(event_id));
create policy "self register" on public.registrations
  for insert with check (user_id = auth.uid());
create policy "self cancel" on public.registrations
  for update using (user_id = auth.uid() or public.manages_event(event_id))
           with check (user_id = auth.uid() or public.manages_event(event_id));

alter table public.attendance enable row level security;
create policy "own attendance readable" on public.attendance
  for select using (user_id = auth.uid() or public.manages_event(event_id));
-- Attendance is NEVER client-writable: it is written by the check-in endpoint
-- using the service role after verifying a signed token.
create policy "attendance staff-write" on public.attendance
  for insert with check (public.manages_event(event_id));

alter table public.xp_ledger enable row level security;
create policy "own ledger readable" on public.xp_ledger
  for select using (user_id = auth.uid() or public.is_staff());
-- No client INSERT policy at all. XP is awarded only by server-side functions.

alter table public.user_achievements enable row level security;
create policy "own achievements readable" on public.user_achievements
  for select using (user_id = auth.uid());
create policy "own achievements seen-updatable" on public.user_achievements
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.announcements enable row level security;
create policy "announcements scoped read" on public.announcements
  for select using (
    scope = 'global'
    or (scope = 'event' and exists (
          select 1 from public.registrations r
          where r.event_id = announcements.event_id and r.user_id = auth.uid()))
    or (scope = 'college' and exists (
          select 1 from public.characters c
          where c.user_id = auth.uid() and c.college_id = announcements.college_id))
  );
create policy "announcements staff-write" on public.announcements
  for insert with check (public.is_staff());
```

Reference tables (`colleges`, `departments`, `event_categories`, `levels`,
`achievements`, `sponsors`, `schedule_slots`) get `for select using (true)` and
admin-only writes.

**Ship an RLS test script with these migrations.** Exercise every table as anon /
player / organizer-of-A / organizer-of-B / admin, asserting both allow *and*
deny. A missing `with check` on an update policy is invisible until exploited.

## Server-side functions the client cannot bypass

```sql
-- Capacity without a race. Counting then inserting in application code lets two
-- concurrent requests both see the last seat.
create or replace function public.register_for_event(p_event uuid)
returns public.registrations language plpgsql security definer as $$
declare v_cap integer; v_count integer; v_row public.registrations;
begin
  perform pg_advisory_xact_lock(hashtext(p_event::text));
  select capacity into v_cap from public.events where id = p_event;
  select count(*) into v_count from public.registrations
   where event_id = p_event and status = 'confirmed';

  insert into public.registrations (event_id, user_id, status)
  values (p_event, auth.uid(),
          case when v_cap is not null and v_count >= v_cap
               then 'waitlisted' else 'confirmed' end)
  returning * into v_row;

  if v_row.status = 'confirmed' then
    perform public.award_xp(auth.uid(), 10, 'Registered', 'registration', p_event);
  end if;
  return v_row;
end $$;

-- Atomic check-in: both guards are constraints inside one transaction, so there
-- is no read-then-write race and a replayed token fails even if the attendance
-- row was later deleted.
create or replace function public.redeem_checkin(
  p_jti text, p_user uuid, p_event uuid
) returns public.attendance language plpgsql security definer as $$
declare v_row public.attendance;
begin
  insert into public.checkin_token_redemptions (jti, user_id, event_id, redeemed_by)
  values (p_jti, p_user, p_event, auth.uid());          -- PK violation => REPLAYED

  insert into public.attendance (event_id, user_id, method, scanned_by, token_jti)
  values (p_event, p_user, 'qr', auth.uid(), p_jti)
  on conflict (event_id, user_id) do nothing
  returning * into v_row;                               -- null => ALREADY_CHECKED_IN

  if v_row.id is not null then
    perform public.award_xp(p_user, (select xp_reward from public.events where id = p_event),
                            'Attended', 'attendance', p_event);
  end if;
  return v_row;
end $$;
```

`award_xp` inserts into `xp_ledger` with `on conflict do nothing` (the unique
tuple makes it idempotent) and then recomputes `characters.total_xp` as the
ledger **sum**, never an increment.

## QR check-in (Phase 8 — needs HTTPS)

A QR containing a registration id is forgeable, infinitely replayable, and
shareable (one screenshot in a group chat checks in forty people). Use a rotating
HMAC-signed token instead:

```
FR1.<payloadB64url>.<sigB64url>
payload = { v:1, s:<user_id>, e:<event_id>|"*", j:<nonce>, w:<window>, x:<expiry> }
sig = HMAC-SHA256(payload, CHECKIN_TOKEN_SECRET)   // server-only env var
```

- **60-second expiry**, re-minted client-side every 25s → a screenshot is
  worthless, which kills the sharing attack. 60s (not 15s) survives bad venue
  wifi and scan queues.
- **`jti` primary key** in `checkin_token_redemptions` → single-use even inside
  that window.
- **Organizer scans player**, never the reverse. A static venue poster QR gets
  photographed and shared, letting people check in from their dorm.
- Verify order: authenticate scanner → assert `event_organizers.can_scan` →
  verify signature with `timingSafeEqual` → check window → check event active →
  check registration exists → `redeem_checkin`.
- **Camera requires HTTPS.** Test on a Vercel preview, not `localhost`. This is
  the number one "camera doesn't work" cause.
- Provide a **manual check-in fallback** by player name, recorded with
  `method='manual'` and the organizer's id, for dead phone batteries.

## Realtime announcements

Use `postgres_changes` on `public.announcements`, **not** Broadcast: it respects
RLS on the subscriber's JWT, so the scoping policy above automatically governs
who receives what. Broadcast would require re-implementing scope logic in client
code and would let a client subscribe to any channel name it guesses.

```sql
alter publication supabase_realtime add table public.announcements;
alter publication supabase_realtime add table public.user_achievements;
alter table public.announcements replica identity full;
```

Client rules, all learned the hard way:

- **One** `RealtimeProvider` in the authed layout → one websocket per session.
- The browser client must be a **module-level singleton**; creating one per
  render opens a socket per render.
- Clean up with `removeChannel`, not `unsubscribe` — the latter leaks the channel
  in the registry and StrictMode's double-mount then yields two live channels.
- Call `supabase.realtime.setAuth(token)` after every session refresh, or the
  socket keeps an expired JWT and silently stops delivering rows after an hour.
- Realtime payloads carry only the changed row. Anything needing a join is
  fetched by invalidating a query — never reconstruct joined data from the payload.
- On reconnect, refetch: realtime is a nudge, the database is the truth.

## Migration order

1. Create the project; add `.env.local` (never commit it).
2. Write migrations + seed; `supabase db reset` until clean.
3. **Write and run the RLS test script.** Do not skip this.
4. Implement `SupabaseRepository` against the existing interface.
5. Run `/dev/data-test` against it — it must pass unchanged.
6. Flip the one line in `src/lib/data/index.ts`.
7. Move route protection from the client guard into `middleware.ts`; convert
   read-only screens to server components.
8. Only then build QR check-in and the organizer/admin dashboards, which are
   meaningless without a real server boundary.
