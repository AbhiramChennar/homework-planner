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

## Step 8: completion, PWA, deploy

- "Done" button on every assignment and plan row → "How long did it actually
  take?" with one-tap answers (your estimate, ±15, ±30; `lib/completion.ts`),
  a custom number, or Skip (done, no time logged). Undo bar for 10 seconds.
  Logging must be one tap: it's the data the estimator learns from.
- The one-tap answers center on the *student's estimate*, not the model's
  prediction, so the buttons don't nudge students toward the model's number
  (that would bias the accuracy comparison in step 10).
- PWA: `app/manifest.ts` (static manifest with base path), icons drawn by
  `scripts/make-icons.mjs` (no image libraries: geometry → pixels → PNG),
  `public/sw.js` service worker (network-first pages, cache-first hashed
  assets, never touches Supabase requests), registered only in production.
- Deploy: `ci/deploy.yml` (to be copied to `.github/workflows/`, see SETUP.md) runs lint + tests, builds with
  `NEXT_PUBLIC_BASE_PATH=/homework-planner`, publishes to GitHub Pages. The
  deploy is skipped until the Supabase variables are set in the repo, so it
  can't fail before Pages is enabled. Steps for you are in SETUP.md.
- Tested a production build served under `/homework-planner/` locally:
  redirects, links, deep links, manifest, icons and service worker scope all
  include the base path.

## Step 9: estimator layer 1 (personal bias)

- `lib/estimator.ts` (`predictMinutes`), tested by `tests/estimator.test.ts`.
- Layer 0 below 3 completions with logged times in the class; layer 1 at 3+.
- **Median**, not mean: one weird night (a 3.5× assignment) doesn't move it.
- **Clipping to [0.25, 4]**: a typo like 500 instead of 50 counts as 4×, not 12.5×.
- **Shrinkage** `(n × median + 5 × 1.0) / (n + 5)`: like starting with five
  imaginary assignments where the guess was exactly right. With 3 real
  completions at 1.5×, the ratio is 1.19; with 50, it's 1.45. The test
  "moves toward the student's real ratio" shows the whole curve.
- The prediction is computed when an assignment is created (or its estimate
  or class is edited) and stored in `predicted_minutes`, always, even in
  layer 0 (where it equals the estimate). Storing the prediction *at creation
  time* is what makes the accuracy comparison in step 10 honest: the model
  can't use the answer it's being graded on.
- Sample demo data gets predictions computed the same way, using only work
  completed before each assignment was created (tested: "no peeking").
- Cards show `~~40m~~ ~48m` plus "You usually take ~45% longer than you
  guess on History (4 done)". The percentage in the sentence is the raw
  median (the student's habit); the number is the shrunk prediction (the
  app being cautious).
- Plans are saved with `model_version: "v1-class-factor"`.

## Step 10: metrics and Insights

- `lib/metrics.ts`, tested by `tests/metrics.test.ts` (hand-computed cases:
  "the numbers match what you get by hand" is literally what the tests check).
- **MAPE** (mean absolute percentage error) is the headline measure: "off by
  38% on average". Percentages make a 10-minute miss on a 20-minute worksheet
  count more than on a 3-hour project.
- **Fair comparison:** estimate error and prediction error are computed on
  exactly the same assignments: finished, with a logged time *and* a stored
  prediction. Ties are reported separately (common early on, when the app
  is still in layer 0 and prediction = estimate).
- Insights unlocks at 5 logged completions, with a progress bar until then
  (logging has to feel worth it).
- Weekly chart (`components/ErrorChart.tsx`): plain SVG line chart, two
  series. Colors validated for color-blind separation in light and dark mode
  (orange = your guesses, blue = app). Legend + direct end labels, so color
  is never the only cue; crosshair tooltip on hover/touch, arrow keys for
  keyboard users, and a "Show as a table" view.

## Step 11: pilot admin dashboard and export

- **No service-role key.** PLAN.md suggested an `ADMIN_EMAILS` variable plus a
  server-only service-role key; a static site has no server to hide a key on.
  Instead (`supabase/migrations/20261111000200_admin_dashboard.sql`):
  - `admins` table (emails). RLS on with no policies and all grants revoked,
    so it's invisible to the API; you add yourself in the SQL Editor.
  - `is_admin()`: looks up the caller's email by `auth.uid()`, so it can't be faked.
  - `admin_dataset()`: `security definer`, refuses non-admins, and returns
    only anonymized rows. Users become random ids ("u1", "u2"…) that change on
    every call, so exports can't be linked to each other or back to accounts.
    Class names become a coarse subject (`class_category()`); titles,
    descriptions and emails never leave the database (a test checks the
    output for them).
- `tests/admin.test.ts` proves: admins get data, students get "not
  authorized", signed-out visitors get "permission denied", the admins table
  is unreadable, and the TypeScript `classCategory` (used by the demo) agrees
  with the SQL version.
- Dashboard math (`lib/pilot.ts`, tested): weekly active users, assignments
  added per active user per week, completions with time logged, retention
  ("did anything at least 1/2/3 weeks after signing up"), guess vs app
  error by week. Quiet weeks still show up as zeros.
- CSV export: completed assignments only, with user id, subject, category,
  description *length* (not text), estimated/predicted/actual minutes,
  lead time in hours (due − created), day of week, date. Step 12 suggests
  TF-IDF keywords from descriptions, but step 11 says no descriptions in the
  export; privacy wins (users may be minors). Description length is the
  stand-in feature.
- More page: feedback form (pilot checklist), "Delete my account" with a
  type-to-confirm step (pilot checklist), dashboard link for admins, demo reset.
