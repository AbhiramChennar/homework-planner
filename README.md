# Homework Planner

A study planner for students that schedules homework into the time you
actually have tonight, and **learns how long your homework really takes**.

Most students underestimate some subjects and overestimate others. This app
keeps track: when you finish an assignment you log how long it took (one
tap), and the app learns your personal bias per class ("you usually take
~45% longer than you guess on History"). Future estimates get corrected, so
your plans get more realistic over time.

**Try it:** the login page has a **Try the demo** button: sample classes and
a few weeks of history, stored only in your browser.

## Features

- **Quick add:** type `hist essay fri 45m` and press Enter. A live preview
  shows what it understood; anything missing opens a short form.
- **Tonight's plan:** pick how much time you have; get an ordered plan with
  start times and breaks. Overdue and due-soon work goes first, big projects
  due later get a chunk so they're started early, and anything urgent that
  didn't fit is flagged.
- **One-tap logging:** "Done" → "How long did it actually take?" → tap.
- **Learning estimates:** per-class bias with shrinkage, so a few data
  points can't swing predictions too far.
- **Insights:** how far off your guesses are vs. the app's predictions,
  bias by class, and error by week.
- **Installable:** add to your home screen on iPhone or Android; works at
  half a laptop screen and on phones.
- **Privacy:** email-only accounts, per-user database security, one-tap
  account deletion, and anonymized-only data for research.

## How it works

| Piece | File | Tests |
| --- | --- | --- |
| Quick-add parser | `lib/parser.ts` | `tests/parser.test.ts` |
| Scheduler | `lib/scheduler.ts` | `tests/scheduler.test.ts` |
| Estimator | `lib/estimator.ts` | `tests/estimator.test.ts` |
| Accuracy metrics | `lib/metrics.ts`, `lib/pilot.ts` | `tests/metrics.test.ts`, `tests/pilot.test.ts` |
| Database + security | `supabase/migrations/` | `tests/rls.test.ts`, `tests/admin.test.ts` |

The core logic is pure TypeScript functions, each with its own tests. The site is
a static Next.js export (no server), so it can be hosted anywhere; the browser
talks to Supabase directly, and Postgres row-level security makes sure each
user can only ever read or change their own rows. The database tests run the
real migrations in an in-memory Postgres (PGlite) to prove it.

Design decisions and trade-offs are written up in [NOTES.md](NOTES.md).

## Run it locally

```bash
npm install
cp .env.local.example .env.local   # then fill in your Supabase URL and anon key
npm run dev                        # http://localhost:3000
npm test                           # all tests
```

Without Supabase keys the app still runs in demo mode. Full setup and
deployment: [SETUP.md](SETUP.md).

## Stack

Next.js (App Router, static export) · TypeScript · Tailwind CSS · Supabase
(Postgres, Auth, RLS) · Vitest · PGlite · GitHub Pages
