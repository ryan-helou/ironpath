# IronPath — Triathlon Training Coach 🔥

Your personal, adaptive triathlon training plan. Pick your race (Olympic, 70.3,
full Ironman, or a custom distance), share your PRs, and IronPath forges a full
**day-by-day** plan — swim, bike, run, brick, and strength — with a Runna-style
calendar, per-session pace/power/HR targets, and a plan that adapts when life
gets in the way.

Built as an installable **PWA** so you and your friends can add it straight to
your phone home screens — no App Store required.

## What's inside

- **Auth** — username + password, real accounts backed by Postgres (falls back
  to an in-memory store when no database is configured).
- **Onboarding** — race → date → experience level → days/week → PRs → limiter,
  then a molten arc-reactor loading animation as your plan is forged.
- **A real periodization engine (100% code, $0 per plan)** — Base → Build →
  Peak → Taper, 3:1 (or 2:1) load/deload cycles, the 80/20 intensity rule,
  progressive overload with per-level ramp caps, long-session caps, and a
  distance-specific taper. Pace/power/HR zones are derived from your PRs
  (Riegel prediction for run, CSS for swim, %FTP for bike).
- **Runna-style app** — a **Today** home, a **Plan** calendar (week strip +
  vertical day agenda + week pills), rich **workout detail** (zone-colored
  interval bar, warm-up/main/cool-down, targets, coach notes), **Progress**
  (weekly volume, compliance, time by sport), and **Profile**.
- **Adaptive** — mark done, **skip** (won't do), **move** (will do later),
  **swap sport**, "did something else", plus **ease this week** and **rebuild
  around today** when you fall behind.
- **Optional AI coach** — Claude Haiku 4.5, tightly cost-capped (a fraction of a
  cent per message). Entirely optional; the app works fully without a key.

## Tech

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Postgres (`pg`) ·
Anthropic SDK · PWA (manifest + service worker). Dependency-free auth (Node
`scrypt` + an HMAC-signed session cookie).

## Run locally

```bash
npm install
npm run dev            # http://localhost:3000
```

No database needed for local dev — it uses an in-memory store (data resets on
restart). To test with Postgres, set `DATABASE_URL` in `.env.local`.

```bash
npm run build && npm start        # production build
npx tsx scripts/test-engine.ts    # sanity-check the plan engine
```

## Deploy to Railway

1. Push this repo to GitHub, then in Railway: **New Project → Deploy from GitHub
   repo** and pick `ironpath`. (Or `railway up` from the Railway CLI.)
2. **Add a database:** in the project, **New → Database → PostgreSQL**. Railway
   creates a `DATABASE_URL` variable.
3. **Set variables** on the web service (Variables tab):
   - `DATABASE_URL` → `${{Postgres.DATABASE_URL}}` (reference the Postgres plugin)
   - `SESSION_SECRET` → any long random string
   - `ANTHROPIC_API_KEY` → *(optional)* your Anthropic key to enable the AI coach
4. Railway builds with Nixpacks (`railway.json` pins the build/start commands)
   and gives you a public URL. The app listens on `$PORT` automatically.

**Cost:** the Railway Hobby plan is $5/month and *includes* $5 of usage. A
small Next.js service + a tiny Postgres for a handful of friends sits
comfortably inside that. The AI coach (if enabled) runs on Haiku and is capped
to well under a cent per message.

## Share it with your friends 📲

Once it's live at your Railway URL, send friends the link. On their phones:

- **iPhone (Safari):** tap **Share → Add to Home Screen**.
- **Android (Chrome):** menu **⋮ → Install app / Add to Home Screen**.

It installs like a native app — full-screen, its own icon, works offline. Each
friend just creates their own account. (The app also shows an in-app install
prompt on the Profile tab.)

## Project layout

```
app/            routes, layout, PWA manifest, API routes (auth, state, coach)
components/     React UI (auth, onboarding, reactor/loading, app tabs, coach)
lib/            the engine + domain
  planEngine    periodization: phases, load curve, weekly scheduler
  workouts      structured swim/bike/run/brick/strength session builders
  paces/zones   PR → training zones (Riegel, CSS, %FTP, %HRmax)
  adapt         skip / move / swap / rebuild / ease adaptations
  db/auth-server  Postgres store (+ memory fallback) and session auth
public/         service worker, generated app icons
scripts/        icon generator, plan-engine test harness
```

---

*IronPath — your path to the finish line.*
