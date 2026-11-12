-- Pilot readiness: a feedback table and a "delete my account" function.
-- Run after 20261111000000_initial_schema.sql (paste into the SQL Editor → Run).


-- ─── feedback: short messages from the in-app feedback button ────────────────
create table public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  message     text not null check (length(trim(message)) between 1 and 2000),
  created_at  timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Students can send feedback but not read it back (not even their own): the
-- only reader is the admin dashboard, through an admin-only function.
create policy "feedback: insert own"
  on public.feedback for insert to authenticated
  with check (user_id = (select auth.uid()));


-- ─── delete_my_account(): removes the caller's account and all their data ────
-- Users can't delete rows in auth.users themselves, so this function runs with
-- the privileges of its owner (`security definer`). It's safe because it can
-- only ever delete the caller's own account: the id comes from auth.uid(), not
-- from an argument. Every table cascades from auth.users, so classes,
-- assignments, plans and feedback are deleted along with the account.
create function public.delete_my_account()
returns void
language sql
security definer
-- An empty search_path stops a caller from tricking the function into using
-- look-alike tables in another schema; everything below is fully qualified.
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

-- Postgres lets everyone execute new functions by default; limit it to signed-in users.
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
