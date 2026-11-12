# Setup and deployment

Everything here needs your accounts, so it's yours to do. Each step says how
to check it worked. Do them in order.

## 1. Create the database tables (Supabase)

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Open `supabase/migrations/` in this repo. For **each file, in order of
   its name** (oldest first):
   - paste the whole file into the editor and click **Run**.
   - It should say "Success. No rows returned".
3. Check: **Table Editor** shows `classes`, `assignments`, `plans`, `feedback`
   (and any later tables), each with a shield icon / "RLS enabled".

If you ever need to start over: run `drop table public.feedback, public.plans,
public.assignments, public.classes cascade;` first (this deletes all data).

## 1b. Make yourself the pilot admin

In the SQL Editor, run (with **your** email, lowercase):

```sql
insert into public.admins (email) values ('you@example.com');
```

Check: sign in to the app → **More** → "Open pilot dashboard" appears. From
another account, `/admin/` says it's only for the organizer.

## 2. Sign-in settings (Supabase → Authentication)

**URL Configuration** (so magic links send people to the right site):
- **Site URL:** `https://abhiramchennar.github.io/homework-planner/`
- **Redirect URLs**, add both:
  - `http://localhost:3000/**`
  - `https://abhiramchennar.github.io/homework-planner/**`

**Sending email to classmates:** Supabase's built-in email sender is meant
for testing: it only allows a few emails per hour, which isn't enough for a
class. Before inviting people, set up your own email sender under
**Authentication → Emails → SMTP Settings**. A free option many people use is
[Resend](https://resend.com) (its docs have a Supabase guide). Then raise the
limit under **Authentication → Rate Limits**.

Once custom SMTP is set up (Supabase only allows editing email templates
after that), do this too:

**Emails → Templates → Magic Link:** add the 6-digit code to the email, so
people can type it instead of tapping the link (needed for the iPhone
home-screen app, which can't receive links). For example:

```html
<h2>Your sign-in link</h2>
<p><a href="{{ .ConfirmationURL }}">Sign in to Homework Planner</a></p>
<p>Or type this code in the app: <strong>{{ .Token }}</strong></p>
```

Until then the email has only the link, which is fine on a computer.

Check: run the app locally (`npm run dev`), sign in with your own email, and
confirm you land on the app.

## 3. Publish on GitHub Pages

0. **Add the deploy workflow.** It's in `ci/deploy.yml` rather than
   `.github/workflows/`, because the GitHub login saved on your Mac isn't
   allowed to add workflow files (pushing one was refused). Easiest fix,
   on github.com:
   - Open the repo → **Add file → Create new file**.
   - Name it `.github/workflows/deploy.yml` (typing the `/` makes folders).
   - Paste in the contents of `ci/deploy.yml` → **Commit changes**.
   - Back in your terminal, run `git pull` so your Mac has it too.
   (Alternative: give your token the `workflow` scope, then
   `git mv ci/deploy.yml .github/workflows/deploy.yml`, commit and push.)
1. On GitHub: repo **Settings → Pages → Build and deployment → Source:
   "GitHub Actions"**.
2. Repo **Settings → Secrets and variables → Actions → Variables** tab →
   **New repository variable**, add two (same values as your `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   (Variables, not secrets: these values are visible in any website that uses
   Supabase. The database's row-level security is what protects the data.)
3. Go to the **Actions** tab → "Test and deploy" → **Run workflow** (or push
   any commit).
4. Check: after ~2 minutes the site is at
   `https://abhiramchennar.github.io/homework-planner/`.

The workflow runs lint and all tests before
every deploy, so a broken build never goes live.

## 4. Check it isn't blocked at school

School web filters categorize sites by domain and content. This app is a
plain study tool (no games, ads, chat or video, title and description say
"study planner"), which helps, but you can only really know by trying:

- Open the site on a school Chromebook / school Wi-Fi.
- If `github.io` is blocked (some schools block it because people host games
  there), options, from easiest:
  1. **Netlify** or **Cloudflare Pages**: free, connect the GitHub repo,
     build command `npm run build`, output folder `out`, and add the two
     variables above. These give a different domain that may not be blocked.
     (Vercel works too, but `vercel.app` is also often used for game sites.)
  2. **Your own domain** (about $10/year, e.g. `homeworkplanner.app`): a new
     domain with only your app on it is categorized by its content
     (education). All the hosts above support custom domains.
  3. **Ask school IT to allow it.** A teacher or club adviser asking on your
     behalf works best; this is also a good moment to get their blessing for
     the pilot (see the pilot checklist in PLAN.md).
- If you move hosts, update the Supabase URL settings in step 2. When you're
  not on GitHub Pages, don't set `NEXT_PUBLIC_BASE_PATH` (the site is at the
  root of its domain).

## 5. Install it on your phone

- **iPhone (Safari):** Share → **Add to Home Screen**. Sign in with the
  **code** from the email (links open in Safari, not the home-screen app).
- **Android (Chrome):** menu → **Install app** / **Add to Home screen**.

## Environment variables (reference)

| Variable | Where | What |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`, GitHub variable | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local`, GitHub variable | Supabase anon/publishable key (public by design) |
| `NEXT_PUBLIC_BASE_PATH` | set by the GitHub workflow | `/homework-planner` on GitHub Pages; empty elsewhere |

Never use the Supabase **service_role** / **secret** key anywhere in this
project. The app doesn't need it.
