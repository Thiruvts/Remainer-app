# Personal Growth Planner — React + Supabase + Vercel

A starter app for a 60-day plan (Oct 16–Dec 14, 2026). Users can create accounts, track six daily habits, follow a topic-based learning schedule, log workout/sleep/energy, complete weekly reviews, carry missed tasks forward, export progress to CSV, and enable in-browser reminders. Progress can be saved to Supabase. Row Level Security protects each user's rows.

## Architecture

- **Frontend:** React + TypeScript + Vite, hosted on Vercel.
- **Authentication:** Supabase Auth (email/password).
- **Database:** Supabase Postgres.
- **Authorization:** Postgres Row Level Security (RLS); every row is tied to `auth.users.id`.
- **Backend:** Supabase handles auth and data API for this initial version. No separate Express server is required yet.

## 1. Create the Supabase backend

1. Create a project at https://supabase.com and save the database password somewhere safe.
2. Open **SQL Editor → New query**.
3. Paste and run `supabase/schema.sql`.
4. Open **Project Settings → API** (or the project's Connect/API keys panel). Copy the **Project URL** and the **publishable key** (older projects may label the browser-safe key `anon`).
5. In **Authentication → URL Configuration**, set the local Site URL to `http://localhost:5173` while developing. Add `http://localhost:5173/**` to the redirect URL allow list if you use confirmation or password-reset links.
6. Configure email confirmation according to your preference. If enabled, users must click the confirmation email before signing in.

**Security:** Never put a Supabase `service_role` or secret key in a `VITE_*` variable, frontend code, GitHub, or Vercel client environment. Only use the publishable/anon key in this browser app. Keep RLS enabled.

## 2. Run locally on Windows

Install Node.js LTS from https://nodejs.org if needed, then open PowerShell in this folder:

```powershell
npm install
Copy-Item .env.example .env.local
```

Edit `.env.local` and replace the placeholder values:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

Then run:

```powershell
npm run dev
```

Open the local URL Vite prints (normally `http://localhost:5173`). After changing `.env.local`, stop and restart the dev server. The local demo mode can be previewed without Supabase, but it only saves in that browser and is not suitable for public multi-user accounts.

## 3. Push to GitHub

Create an empty GitHub repository, then from PowerShell in the project folder:

```powershell
git init
git add .
git commit -m "Initial personal growth planner"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Do not commit `.env.local`. The `.gitignore` file already excludes it. If a secret is ever committed, rotate it immediately.

## 4. Deploy to Vercel (free URL)

1. Sign in at https://vercel.com and choose **Add New → Project**.
2. Import your GitHub repository.
3. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist` (normally auto-detected).
4. In project **Settings → Environment Variables**, add these for **Production**, **Preview**, and **Development** as appropriate:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = your publishable/anon key
5. Click **Deploy**. Vercel will provide a free `https://your-project-name.vercel.app` URL on its free tier, subject to current plan limits.
6. Copy the deployed URL. In Supabase **Authentication → URL Configuration**, set **Site URL** to your production URL and add that exact URL plus any needed auth callback paths to the redirect allow list. Keep `http://localhost:5173/**` for local testing.
7. Redeploy in Vercel if you changed environment variables after the first deployment.

## 5. Verify multi-user privacy

1. Create user A and save progress on Day 1.
2. Sign out, create user B, and confirm Day 1 is empty for B.
3. Sign back into A and confirm the saved progress is present.
4. Refresh the app and verify saved data remains.
5. In Supabase, verify RLS is enabled on `planner_progress`. Do not add a permissive public policy.

## Added improvements

- **Learning-specific focus:** AI Full-Stack topics rotate by week; the first 15 days have a harmonic-pattern study sequence, followed by ongoing chart review.
- **Weekly review:** record wins, blockers, next week's priorities, and a 1–5 week rating. The review is stored against the last day of that week.
- **Missed-task recovery:** move unfinished daily tasks to the next day without changing the original day's checkboxes. Carry-over items can be cleared when completed.
- **CSV export:** download a spreadsheet-friendly export of all 60 days, daily notes, health check-ins, carry-over tasks, and weekly review fields.
- **Daily browser reminder:** choose a time and allow notifications. The app must remain open in a browser tab; reminders do not run after the browser closes. For reliable reminders while offline/closed, add a server-side scheduled job and email/push provider.

## Database upgrade note

If you already ran an earlier version of `supabase/schema.sql`, open Supabase **SQL Editor** and run the updated `supabase/schema.sql` again. It adds `recovery_tasks` and `weekly_review` columns using `ADD COLUMN IF NOT EXISTS`, while retaining the existing user-specific RLS policies. If you see a missing-column error, confirm the updated script completed successfully.

The task checklist is still a starter template. Edit `TASKS`, `AI_TOPICS`, and `HARMONIC_TOPICS` in `src/App.tsx` to tailor the schedule. A separate Node/Express API can be added later for privileged integrations, external API calls, or reliable scheduled notifications. Never expose service-role keys in browser code.
