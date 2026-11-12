# Adaptive Homework Planner — Project Rules

## Purpose
Students add their classes and assignments, get a schedule that fits their available time, and log how long each assignment actually took. Over time the app learns each student's estimation bias (per class) and corrects their estimates so schedules get more accurate.

## Layout target
- Primary target: a narrow window, about 600px wide (half a laptop screen in split view).
- Single column. No hover-only controls: everything must be reachable by tap/click and keyboard.
- Large tap targets (at least 44px tall).
- Must also work on phones (check at ~380px wide).

## Stack
- Next.js App Router, TypeScript in strict mode, Tailwind CSS.
- Supabase: Postgres, Auth (magic link) and row-level security (RLS). Every table has a `user_id` and RLS limits rows to `user_id = auth.uid()`.
- Vitest for unit tests (`npm test`).
- Hosting: Vercel.

## Architecture (decided; see NOTES.md)
- **Static site, no server.** `output: "export"` in next.config.ts so it runs on
  GitHub Pages or any static host. Don't add server actions, route handlers,
  middleware, or anything needing a server or the service-role key.
- The browser talks to Supabase directly with the anon key; RLS policies are
  the security boundary. Privileged operations are `security definer` SQL
  functions that check `auth.uid()` (e.g. `delete_my_account`, `admin_dataset`).
- All UI reads/writes go through the `DataStore` interface (`lib/data/`), with a
  Supabase implementation and a localStorage demo implementation.
- New database changes: a new file in `supabase/migrations/` (never edit an
  applied one), plus tests in `tests/` using the PGlite helper.
- Links and redirects must work under the GitHub Pages base path
  (`NEXT_PUBLIC_BASE_PATH`); use `next/link` / the router, and `BASE_PATH`
  from `lib/browser.ts` for anything else.

## Code organization
- Core logic lives in `lib/` as **pure functions with unit tests** (no database or network calls inside them):
  - `lib/parser.ts`: quick-add text → structured assignment
  - `lib/scheduler.ts`: fits assignments into available time
  - `lib/estimator.ts`: predicts real minutes from the estimate plus history
  - `lib/metrics.ts`: error calculations for insights/admin
- Pass the current time (`now: Date`) in as an argument instead of calling `new Date()` inside core logic, so tests are deterministic.
- Supabase helpers go in `lib/supabase/`. SQL migrations go in `supabase/migrations/`.
- UI components go in `components/`. Tests go in `tests/`. The Python analysis notebook goes in `analysis/`.
- For the parser, scheduler, estimator and metrics: write the tests first, then implement.

## Privacy
- Collect minimal personal data: **email only**. Users may be minors.
- Never put the Supabase service-role key in client code. Never commit `.env.local`.
- Exports for analysis must be anonymized (no emails, user ids, titles or descriptions).

## Style
- Keep code simple and explainable; the project owner needs to understand every file.
- Add short comments explaining non-obvious decisions (the "why", not the "what").
- Prefer a straightforward rule-based approach over a clever one unless there's a measured reason.
- One feature per change. Don't build ahead of the current step in PLAN.md.

## Commands
- `npm run dev`: start the dev server at http://localhost:3000
- `npm test`: run the Vitest tests once (`npm run test:watch` to re-run on save)
- `npm run lint`: run ESLint
