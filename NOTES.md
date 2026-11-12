# Build notes and design decisions

A running log of what was built in each step, the key decisions, and where
the build differs from PLAN.md. Useful for interviews and write-ups: every
decision here should be something you can explain.

## Big decision: a static site (no server)

**What:** The app is exported as plain HTML/JS/CSS (`output: "export"` in
`next.config.ts`). The browser talks to Supabase directly with the public
anon/publishable key.

**Why:** You want the app on a GitHub site (GitHub Pages only serves static
files), and school web filters sometimes block a hosting domain. A static
site runs unchanged on GitHub Pages, Vercel, Netlify or Cloudflare Pages, so
if one domain is blocked you can move it in minutes.

**Why it's still secure:** The database protects itself. Row-level security
(RLS) policies make Postgres refuse to return or change any row whose
`user_id` isn't the signed-in user's, no matter what the browser sends.
`tests/rls.test.ts` proves this against a real Postgres.

**What changed from PLAN.md because of it:**
- Step 3: no server middleware. `components/AppShell.tsx` redirects signed-out
  visitors in the browser. Uses `@supabase/supabase-js` instead of `@supabase/ssr`.
- Step 4: no server actions; writes go through `lib/data/` straight to Supabase.
- Step 7: no `app/api/schedule/route.ts`; `buildPlan` runs in the browser
  (it's a pure function anyway).
- Step 11: no service-role key at all (a static site can't keep a secret).
  Admin access is checked inside the database instead (see step 11 notes).

## Demo mode

`lib/data/localStore.ts` is a second implementation of the same `DataStore`
interface that keeps data in the browser's localStorage, filled with sample
data from `lib/demoData.ts`. "Try the demo" on the login page uses it.

Why: (1) anyone (a teacher, an admissions reader, an interviewer) can try the
app without an account, and nothing is collected; (2) the whole UI can be
tested without a real login.

## Step 2: database schema

- `supabase/migrations/20261111000000_initial_schema.sql`: classes,
  assignments, plans.
  - `user_id default auth.uid()`: the database fills in the owner, so app code
    can't get it wrong.
  - `on delete cascade` from `auth.users`: deleting an account deletes all its data.
  - `class_id ... on delete restrict`: can't delete a class that has assignments.
  - CHECK constraints: minutes > 0, category/status from a fixed list, and
    `completed_at` set exactly when status is `done`. Clean data now means less
    cleaning before the analysis in step 12.
  - RLS: one policy per operation per table, all `to authenticated`.
    Assignment insert/update also checks the class belongs to you.
  - `(select auth.uid())` instead of `auth.uid()`: Supabase's recommended form;
    evaluated once per query instead of once per row.
- `supabase/migrations/20261111000100_feedback_and_account_deletion.sql`:
  feedback table (insert-only for students) and `delete_my_account()`
  (`security definer`, deletes only `auth.uid()`; `search_path = ''` to avoid
  schema-spoofing tricks).
- `tests/rls.test.ts` + `tests/helpers/db.ts`: runs the real migrations in
  PGlite (Postgres compiled to WebAssembly) with small stand-ins for Supabase's
  `auth` schema and roles. Catching a real bug: the first version of the
  helper granted permissions *after* the migrations, which undid the
  migration's `revoke`; Supabase uses *default* privileges set beforehand.
- `lib/types.ts`: hand-written types (readable; regenerate-able later with
  `supabase gen types`). They're `type` aliases rather than `interface`s
  because supabase-js needs plain object types.

## Step 3: login

- Magic link via `signInWithOtp`. Also accepts the 6-digit code from the email:
  an iPhone home-screen app has separate storage from Safari, so tapping the
  link would sign in Safari, not the app. The code works anywhere.
- `flowType: "implicit"` rather than PKCE: PKCE links only work in the browser
  that requested them; students often request on a laptop and open email on a phone.
- `components/AuthProvider.tsx`: session state (loading / signedOut / signedIn),
  picks the Supabase or demo DataStore.
- `components/DataProvider.tsx`: loads classes + assignments once and shares
  them across pages.
- Privacy note on the login page (pilot checklist item).

## Step 4: classes

- `app/(main)/classes/page.tsx` + `components/ClassForm.tsx`.
- Short name is suggested from the class name (`suggestShortName` in
  `lib/classColors.ts`: skips "AP", "Honors", etc., so "AP US History" →
  "hist") and must be unique, because quick-add matches on it.
- The add form stays open after each add, since new users add 5–7 classes in a row.
- Delete asks for confirmation inline (no browser `confirm()` popup) and is
  blocked when the class has assignments, both in the UI and in the database
  (`on delete restrict`).
- New users with zero classes are redirected to /classes with a welcome
  message (`FirstRunRedirect` in `components/AppShell.tsx`).
- No server actions (static site): writes go through the DataStore.

## Step 5: quick-add parser

- `lib/parser.ts`, tested by `tests/parser.test.ts` (60 cases; read the tests,
  they're the specification).
- Order matters: duration → date → class → leftover title. Durations and
  dates are taken first so "fri" or "45m" can never be read as a class.
- Class matching: an exact short name wins; otherwise a word that is the start
  of exactly one class name (at least 3 letters, so "ch 5" isn't Chemistry).
  Ambiguous prefixes ("phys" → Physics or Physical Education) match nothing
  rather than guessing.
- Weekday names mean the next occurrence; today's weekday means today, since an
  11:59pm deadline today hasn't passed yet.
- "1/5" typed in November means next January: a month/day more than 60 days
  in the past rolls to next year; anything more recent is overdue work.
- Impossible dates (13/45) are rejected rather than rolled over by `new Date()`.
- Category keywords stay in the title ("essay" is both the category and a
  good title).

## Step 6: assignments page

- `app/(main)/assignments/page.tsx`, `components/QuickAdd.tsx`,
  `components/AssignmentForm.tsx`, `components/AssignmentCard.tsx`,
  `components/Dialog.tsx`, `lib/dates.ts` (+ tests).
- Quick-add shows chips for what it understood as you type; missing required
  parts show in amber. Enter saves when class + date + minutes are known
  (title falls back to the category or "Homework"); otherwise it opens the
  full form with the missing fields marked "(needed)" and focused.
- Quick-add clears the box immediately and saves in the background (restoring
  the text if saving fails). An earlier version made the box read-only while
  saving, and fast typing of the next assignment got lost: found in testing.
- Dialogs use the native `<dialog>` element: Escape-to-close, focus trapping
  and the backdrop come from the browser instead of custom code.
- Grouping (`dueGroup`) uses calendar days, not 24-hour periods, so
  something due at 12:05am is "Tomorrow" even if it's only 9 hours away.
  Rounds day differences so daylight-saving changes don't break it.
- "n" focuses quick-add unless you're typing in a field.

## Step 7: scheduler and Tonight view

- `lib/scheduler.ts` (`buildPlan`), tested by `tests/scheduler.test.ts`.
- Choices the plan left open, decided here:
  - **Breaks count toward your time.** "I have 2 hours" means the plan
    fits in 2 hours of clock time, breaks included.
  - **Breaks go between assignments**, once 50+ minutes of work have built
    up, never in the middle of one, and never at the very end.
  - **Greedy with skipping:** if the next most urgent thing doesn't fit, it's
    skipped and smaller later items are tried. Simple and explainable; not
    "optimal", but optimal packing would be harder to explain and the real
    error comes from bad time estimates, not packing.
  - **Chunks:** an assignment over 50 minutes due 3+ days away gets one chunk
    (25–50 minutes) per plan. Starts big projects early without crowding out
    tonight's urgent work.
  - The ordering is explicit tiers (overdue / within 24h / later), then due
    time, then shorter first.
- Tonight page (`app/(main)/page.tsx`): quick buttons 30m/1h/2h/3h or a custom
  time ("1h30", uses `parseDurationText` from the parser). Start times begin
  at the next 5-minute mark and are fixed when the plan is made.
- The current plan is kept on the device (`lib/currentPlan.ts`) so it's still
  there after switching pages; it expires at midnight. Every plan is also
  saved to the `plans` table with `model_version` for later analysis.
- No `/api/schedule` route: the scheduler is a pure function and runs in the browser.
