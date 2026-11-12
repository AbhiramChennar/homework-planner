-- Pilot admin dashboard: who's an admin, and an anonymized dataset for them.
--
-- The site is static, so it can't hide a service-role key. Instead, admin
-- access is decided inside the database: admin_dataset() checks the caller
-- against the admins table and refuses everyone else. Even admins only ever
-- get anonymized rows: random per-user ids, a coarse subject instead of the
-- class name, and no titles, descriptions or emails.


-- ─── admins: emails allowed to see the pilot dashboard ───────────────────────
-- Add yourself in the SQL Editor (it can't be done from the app):
--   insert into public.admins (email) values ('you@example.com');
create table public.admins (
  email text primary key check (email = lower(email))
);

-- RLS on with no policies: nobody can read or change this table through the
-- API. Only the SQL Editor (and the security-definer functions below) can.
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;


-- ─── is_admin(): is the signed-in user an admin? ─────────────────────────────
-- Used by the app to decide whether to show the dashboard link. It looks up
-- the caller's email from auth.users by their id, so it can't be faked.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join public.admins a on a.email = lower(u.email)
    where u.id = auth.uid()
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;


-- ─── class_category(name): "AP US History" → "social_studies" ────────────────
-- Class names are typed by students, so they aren't exported. A coarse subject
-- keeps the useful signal (math vs essays) without the identifying detail.
-- Order matters: "computer science" must match before "science".
create function public.class_category(class_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when n ~ '(computer|programming|coding|\mcs\M)' then 'computer_science'
    when n ~ '(calc|algebra|geometry|math|stat|trig)' then 'math'
    when n ~ '(bio|chem|physics|science|anatomy|environmental|earth)' then 'science'
    when n ~ '(english|lit|writing|language arts|composition|rhetoric)' then 'english'
    when n ~ '(history|gov|econ|psych|social|geography|civics|sociology)' then 'social_studies'
    when n ~ '(spanish|french|german|chinese|mandarin|latin|japanese|italian|korean|arabic|\masl\M)' then 'world_language'
    when n ~ '(art|music|band|choir|orchestra|theater|theatre|drama|design|photo)' then 'arts'
    else 'other'
  end
  from (select lower(class_name) as n) s;
$$;


-- ─── admin_dataset(): everything the dashboard and export need, anonymized ───
-- Returns {"users": [...], "assignments": [...]}. Each user gets a random id
-- ("u1", "u2"…) that is consistent within one call but different next time,
-- so exports can't be linked to each other or back to accounts.
create function public.admin_dataset()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  with ids as (
    select id, 'u' || row_number() over (order by random()) as anon
    from auth.users
  )
  select jsonb_build_object(
    'users', coalesce((
      select jsonb_agg(jsonb_build_object('u', ids.anon, 'signed_up_at', u.created_at))
      from auth.users u join ids on ids.id = u.id
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'u', ids.anon,
        'class_category', public.class_category(c.name),
        'category', a.category,
        'description_length', coalesce(length(a.description), 0),
        'created_at', a.created_at,
        'due_at', a.due_at,
        'completed_at', a.completed_at,
        'status', a.status,
        'estimated_minutes', a.estimated_minutes,
        'predicted_minutes', a.predicted_minutes,
        'actual_minutes', a.actual_minutes
      ))
      from public.assignments a
      join public.classes c on c.id = a.class_id
      join ids on ids.id = a.user_id
    ), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

revoke execute on function public.admin_dataset() from public, anon;
grant execute on function public.admin_dataset() to authenticated;
