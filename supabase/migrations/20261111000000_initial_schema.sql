-- Initial schema for the Adaptive Homework Planner: classes, assignments, plans.
--
-- How to run: paste this whole file into the Supabase dashboard → SQL Editor → Run.
--
-- Shared design decisions:
-- * Every table has a user_id that points at Supabase's built-in auth.users table.
--   `default auth.uid()` fills it in with the signed-in user, so app code doesn't
--   have to send it (and can't usefully fake it: the RLS policies below reject
--   any row whose user_id isn't the caller's).
-- * `on delete cascade` from auth.users means deleting a user's account also
--   deletes all their data (needed for the "Delete my account" pilot checklist item).
-- * CHECK constraints keep bad data out of the database itself, so the
--   accuracy analysis later doesn't have to clean up typos like 0 or -5 minutes.


-- ─── classes: the classes a student is taking ────────────────────────────────
create table public.classes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),  -- "AP US History"
  short_name  text,                                          -- "hist" (used by quick-add)
  color       text,                                          -- e.g. "#3b82f6"
  created_at  timestamptz not null default now()
);


-- ─── assignments: one piece of homework ──────────────────────────────────────
create table public.assignments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- `on delete restrict`: a class can't be deleted while it still has assignments
  -- (step 4 shows a friendly message for this; the database is the backstop).
  class_id           uuid not null references public.classes (id) on delete restrict,
  title              text not null check (length(trim(title)) > 0),
  description        text,
  category           text check (category in ('reading', 'problem_set', 'essay', 'project', 'study', 'other')),
  due_at             timestamptz not null,
  -- Keeping all three minute columns is the core of the project:
  -- estimated = the student's guess, predicted = the model's guess at creation time,
  -- actual = what really happened. Comparing them proves whether the model helps.
  estimated_minutes  int not null check (estimated_minutes > 0),
  predicted_minutes  int check (predicted_minutes > 0),
  actual_minutes     int check (actual_minutes > 0),
  status             text not null default 'todo' check (status in ('todo', 'done')),
  created_at         timestamptz not null default now(),
  completed_at       timestamptz,
  -- A done assignment always has a completion time, and a todo one never does.
  -- This keeps "undo" honest: setting status back to 'todo' must clear completed_at.
  constraint completed_at_matches_status
    check ((status = 'done') = (completed_at is not null))
);

-- The app's two most common queries: "my todo assignments" and "my assignments by due date".
create index assignments_user_status_idx on public.assignments (user_id, status);
create index assignments_user_due_idx    on public.assignments (user_id, due_at);


-- ─── plans: every schedule the app generates (kept for later analysis) ───────
create table public.plans (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  available_minutes  int not null check (available_minutes > 0),
  -- [{ "assignment_id": "...", "minutes": 45, "order": 1 }, ...]
  -- Stored as JSON rather than a separate table because a plan is a snapshot:
  -- it's written once and read back whole, never queried item by item.
  items              jsonb not null check (jsonb_typeof(items) = 'array'),
  -- Which estimator produced the minutes: 'baseline' | 'v1-class-factor' | 'v2-pooled'.
  model_version      text not null default 'baseline',
  created_at         timestamptz not null default now()
);


-- ─── Row-level security ──────────────────────────────────────────────────────
-- The browser talks to the database directly with the public "anon/publishable"
-- key, so RLS is what actually keeps one student's data away from another.
-- With RLS enabled and no matching policy, a query sees zero rows / is rejected.
--
-- Every policy applies only `to authenticated` (signed-in users). Signed-out
-- visitors (the `anon` role) get no policy at all, so they can't read or write anything.
--
-- `(select auth.uid())` instead of plain `auth.uid()`: Supabase's recommended
-- form. Wrapping it in a select lets Postgres compute the user id once per query
-- instead of once per row, which matters as tables grow.
--
-- USING      = which existing rows you can see/change/delete.
-- WITH CHECK = what a row must look like after your insert/update.

alter table public.classes     enable row level security;
alter table public.assignments enable row level security;
alter table public.plans       enable row level security;


-- classes ---------------------------------------------------------------------

-- Read: you only see your own classes.
create policy "classes: select own"
  on public.classes for select to authenticated
  using (user_id = (select auth.uid()));

-- Create: a new class must belong to you.
create policy "classes: insert own"
  on public.classes for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Edit: you can only edit your own classes (USING), and you can't hand one
-- to another user by changing its user_id (WITH CHECK).
create policy "classes: update own"
  on public.classes for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Delete: only your own classes.
create policy "classes: delete own"
  on public.classes for delete to authenticated
  using (user_id = (select auth.uid()));


-- assignments -----------------------------------------------------------------

-- Read: you only see your own assignments.
create policy "assignments: select own"
  on public.assignments for select to authenticated
  using (user_id = (select auth.uid()));

-- Create: the assignment must belong to you AND be attached to one of YOUR
-- classes. Without the second check, someone who learned another student's
-- class id could attach their own assignments to it.
create policy "assignments: insert own"
  on public.assignments for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.classes c
      where c.id = class_id and c.user_id = (select auth.uid())
    )
  );

-- Edit: only your own assignments, and after the edit it must still be yours
-- and still point at one of your classes (same reasoning as insert).
create policy "assignments: update own"
  on public.assignments for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.classes c
      where c.id = class_id and c.user_id = (select auth.uid())
    )
  );

-- Delete: only your own assignments.
create policy "assignments: delete own"
  on public.assignments for delete to authenticated
  using (user_id = (select auth.uid()));


-- plans -----------------------------------------------------------------------

-- Read: you only see plans generated for you.
create policy "plans: select own"
  on public.plans for select to authenticated
  using (user_id = (select auth.uid()));

-- Create: a saved plan must belong to you.
create policy "plans: insert own"
  on public.plans for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Edit: only your own plans, and they must stay yours.
create policy "plans: update own"
  on public.plans for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Delete: only your own plans.
create policy "plans: delete own"
  on public.plans for delete to authenticated
  using (user_id = (select auth.uid()));
