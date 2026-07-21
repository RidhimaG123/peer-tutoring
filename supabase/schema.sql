-- =====================================================================
-- supabase/schema.sql
--
-- MANUALLY RECONSTRUCTED SCHEMA — NOT a `pg_dump` / `supabase db dump`
-- output.
--
-- `supabase db dump` requires Docker, which is unavailable in this
-- environment. The MCP `execute_sql` tool also returned an internal
-- error ("crypto is not defined") for every query attempted this
-- session, so a real dump could not be generated automatically either.
--
-- This file was assembled by hand from, in order:
--   - mcp__supabase__list_tables (verbose) output for the `public`
--     schema (columns, types, defaults, checks, PKs, FKs)
--   - mcp__supabase__list_extensions output
--   - mcp__supabase__get_advisors output
--   - `select * from pg_policies where schemaname = 'public'` results,
--     run manually by the project owner via the SQL Editor
--   - `select pg_get_functiondef(oid) from pg_proc where proname =
--     'handle_new_user' ...` output, run manually by the project owner
--   - the exact migration SQL applied via mcp__supabase__apply_migration
--     during this session's security fixes (Fix 1-4)
--
-- Sections marked "UNVERIFIED" below were never directly observed
-- this session (exact trigger wiring/names, touch_updated_at's body,
-- FK ON DELETE/UPDATE actions, check-constraint names, index
-- inventory beyond PKs/the one confirmed unique constraint). Treat
-- those as best-guess placeholders, not ground truth — confirm/replace
-- against the live database (e.g. once Docker or a working SQL
-- connection is available) before relying on this file.
--
-- Project: peer-tutoring-mvp (fdrqimnmexvzjkikccic)
-- Reconstructed: 2026-07-22
-- =====================================================================


-- ---------------------------------------------------------------------
-- Extensions
-- Confirmed installed via list_extensions (installed_version was
-- non-null for these). Postgres 17 (this project's engine version)
-- has gen_random_uuid() built into core, so pgcrypto may not even be
-- required for the defaults below — included for parity with what's
-- actually installed on the project.
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;


-- ---------------------------------------------------------------------
-- Table: profiles
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key,
  role text not null check (role = any (array['student', 'mentor', 'admin'])),
  created_at timestamptz default timezone('utc'::text, now()),
  display_name text,
  headline text,
  bio text,
  subjects text[] default '{}'::text[],
  updated_at timestamptz default now(),
  grade text,
  availability_preference text,
  email text,
  year text,
  constraint profiles_id_fkey foreign key (id) references auth.users (id) -- UNVERIFIED: ON DELETE action
);

alter table public.profiles enable row level security;

-- Fix 1 (this session): replaced the original `profiles_select_authed`
-- policy (`using (true)` for role `authenticated` — exposed every
-- column, including email/grade/year, to every logged-in user) with a
-- self-only policy, plus the column-limited public view below.
create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Public directory view (Fix 1): safe columns only, all rows.
-- Deliberately NOT security_invoker — it must run as its (privileged)
-- owner to bypass the self-only policy above and surface every user's
-- safe fields for the mentor directory. This is flagged by the
-- Supabase advisor as "security_definer_view"; that flag is expected
-- and was accepted as part of Fix 1, not a bug.
--
-- NOTE: the app's mentor-directory query needs to be pointed at this
-- view instead of `profiles` directly, or it will only return the
-- caller's own row now that `profiles` itself is locked to self-only.
create view public.profiles_public as
select id, display_name, role, grade, subjects, headline, bio
from public.profiles;

revoke all on public.profiles_public from anon, public;
grant select on public.profiles_public to authenticated;


-- ---------------------------------------------------------------------
-- Table: matches
-- ---------------------------------------------------------------------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique,
  mentor_id uuid not null,
  created_at timestamptz not null default now(),
  status text default 'active'::text,
  constraint matches_student_id_fkey foreign key (student_id) references public.profiles (id), -- UNVERIFIED: ON DELETE action
  constraint matches_mentor_id_fkey foreign key (mentor_id) references public.profiles (id)     -- UNVERIFIED: ON DELETE action
);

alter table public.matches enable row level security;

create policy "Users can create own matches"
  on public.matches
  for insert
  to public
  with check (auth.uid() = student_id);

create policy "Users can delete own matches"
  on public.matches
  for delete
  to public
  using (auth.uid() = student_id);

create policy "Users can view their matches"
  on public.matches
  for select
  to authenticated
  using ((auth.uid() = student_id) or (auth.uid() = mentor_id));

-- No UPDATE policy exists on matches (confirmed during audit) —
-- `status` cannot currently be changed via the API. Not touched by
-- this session's fixes; flagging in case it's an oversight rather
-- than intentional.


-- ---------------------------------------------------------------------
-- Table: sessions
-- ---------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid,
  mentor_id uuid,
  status text default 'requested'::text
    check (status = any (array['requested', 'confirmed', 'declined', 'completed'])),
  created_at timestamptz default timezone('utc'::text, now()),
  rating integer,
  feedback text,
  requested_time text,
  student_tags text[],
  mentor_tags text[],
  student_rating_of_mentor integer,
  mentor_rating_of_student integer,
  mentor_feedback_of_student text,
  meeting_type text check (meeting_type = any (array['online', 'in-person'])),
  subject text,
  constraint sessions_student_id_fkey foreign key (student_id) references public.profiles (id), -- UNVERIFIED: ON DELETE action
  constraint sessions_mentor_id_fkey foreign key (mentor_id) references public.profiles (id)     -- UNVERIFIED: ON DELETE action
);

alter table public.sessions enable row level security;

create policy "Students can create own session requests"
  on public.sessions
  for insert
  to public
  with check (auth.uid() = student_id);

create policy "Users can view own sessions"
  on public.sessions
  for select
  to public
  using ((auth.uid() = student_id) or (auth.uid() = mentor_id));

create policy "Users can update own sessions"
  on public.sessions
  for update
  to public
  using ((auth.uid() = student_id) or (auth.uid() = mentor_id))
  with check ((auth.uid() = student_id) or (auth.uid() = mentor_id));

-- Fix 2 (this session): the row-level policy above only controls
-- which ROWS can be touched. Postgres RLS cannot compare OLD vs NEW
-- column values inside a policy, so column-level separation (student
-- vs. mentor writable columns) is enforced here, in a trigger,
-- instead.
create or replace function public.enforce_session_update_columns()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  is_student boolean := auth.uid() = old.student_id;
  is_mentor  boolean := auth.uid() = old.mentor_id;
begin
  if is_student then
    if new.id is distinct from old.id
       or new.student_id is distinct from old.student_id
       or new.mentor_id is distinct from old.mentor_id
       or new.created_at is distinct from old.created_at
       or new.subject is distinct from old.subject
       or new.requested_time is distinct from old.requested_time
       or new.meeting_type is distinct from old.meeting_type
       or new.status is distinct from old.status
       or new.mentor_rating_of_student is distinct from old.mentor_rating_of_student
       or new.mentor_tags is distinct from old.mentor_tags
       or new.mentor_feedback_of_student is distinct from old.mentor_feedback_of_student
    then
      raise exception 'Students may only update rating, feedback, student_tags, student_rating_of_mentor';
    end if;
  elsif is_mentor then
    if new.id is distinct from old.id
       or new.student_id is distinct from old.student_id
       or new.mentor_id is distinct from old.mentor_id
       or new.created_at is distinct from old.created_at
       or new.subject is distinct from old.subject
       or new.requested_time is distinct from old.requested_time
       or new.meeting_type is distinct from old.meeting_type
       or new.rating is distinct from old.rating
       or new.feedback is distinct from old.feedback
       or new.student_tags is distinct from old.student_tags
       or new.student_rating_of_mentor is distinct from old.student_rating_of_mentor
    then
      raise exception 'Mentors may only update status, mentor_rating_of_student, mentor_tags, mentor_feedback_of_student';
    end if;
  else
    raise exception 'Not authorized to update this session';
  end if;

  return new;
end;
$$;

create trigger enforce_session_update_columns
  before update on public.sessions
  for each row
  execute function public.enforce_session_update_columns();


-- ---------------------------------------------------------------------
-- Table: notifications
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  type text not null,
  message text not null,
  read boolean default false,
  created_at timestamptz default now(),
  constraint notifications_user_id_fkey foreign key (user_id) references public.profiles (id) -- UNVERIFIED: ON DELETE action
);

alter table public.notifications enable row level security;

-- Fix 3 (this session): table previously had RLS enabled with ZERO
-- policies (default-deny for every role, confirmed via advisor lint
-- "rls_enabled_no_policy"). Added self-read only; deliberately no
-- INSERT policy for authenticated/anon — inserts are meant to come
-- from a server route using the service_role key, which bypasses RLS
-- regardless of what policies exist.
create policy notifications_select_own
  on public.notifications
  for select
  to authenticated
  using (auth.uid() = user_id);

-- No "mark as read" feature exists yet (confirmed with project owner)
-- — no UPDATE policy added for the `read` column.


-- ---------------------------------------------------------------------
-- Function: handle_new_user
-- Fires on new auth.users signups to create the matching profiles row.
-- Body confirmed via pg_get_functiondef(), run manually by the project
-- owner in the SQL Editor.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
-- UNVERIFIED: original search_path setting — the advisor flags this
-- function as having a mutable search_path (i.e. not explicitly set).
-- Fix 4 (this session) addressed only the anon/authenticated EXECUTE
-- grant below, not this warning.
as $$
begin
  insert into public.profiles (id, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'student')
  );
  return new;
end;
$$;

-- UNVERIFIED: the exact trigger definition on auth.users was never
-- directly observed this session (pg_get_triggerdef() was not run).
-- The statement below is the standard Supabase convention and is
-- believed correct — signup was manually tested and confirmed working
-- after Fix 4 — but the name/timing here is inferred, not confirmed.
-- create trigger on_auth_user_created
--   after insert on auth.users
--   for each row
--   execute function public.handle_new_user();

-- Fix 4 (this session): revoked unnecessary public API exposure.
-- handle_new_user() is a RETURNS TRIGGER function, so Postgres refuses
-- to execute it outside of an actual trigger context — this grant was
-- never actually exploitable as a direct-call vector, but it was
-- needless surface area (Postgres grants EXECUTE to PUBLIC by default
-- on function creation unless revoked).
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;


-- ---------------------------------------------------------------------
-- Function: touch_updated_at
-- UNVERIFIED — NOT RECONSTRUCTED.
--
-- This function's existence is confirmed only via the security
-- advisor ("Function public.touch_updated_at has a role mutable
-- search_path"). Its actual body, and which table(s)/trigger(s)
-- invoke it (profiles.updated_at is the obvious candidate given that
-- column exists, but this was never confirmed), were not retrieved
-- this session. The commented-out block below is a guess at the
-- conventional implementation — do not treat it as accurate.
-- ---------------------------------------------------------------------
-- create or replace function public.touch_updated_at()
-- returns trigger
-- language plpgsql
-- as $$
-- begin
--   new.updated_at = now();
--   return new;
-- end;
-- $$;
--
-- create trigger <unknown_name>
--   before update on public.profiles
--   for each row
--   execute function public.touch_updated_at();


-- ---------------------------------------------------------------------
-- Indexes
-- UNVERIFIED — beyond the primary keys and the `matches.student_id`
-- unique constraint (both confirmed via list_tables), no index
-- inventory was retrieved this session. There may be additional
-- indexes (e.g. on foreign key columns for join performance) not
-- captured here.
-- ---------------------------------------------------------------------
