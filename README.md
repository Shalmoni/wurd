# wurd

One word a day. See what resonates.

`wurd` is a mobile-first social web app where each person posts exactly one word per local day. Posting unlocks a quiet daily feed. People can anonymously Echo words that resonate, follow friends, build a personal word diary, and earn XP through consistent participation.

## Current app

- One-word daily posting flow with a confirmation step
- Today feed with 8 two-column word cards
- Top Today and Friends views
- Anonymous Echo interactions by a single tap
- World map and rewind concept
- Personal word diary and streak concept
- Google sign-in and username onboarding when Supabase is configured
- Shared daily words, anonymous Echoes, streaks, XP, and word history
- Level 2 emoji and Level 3 word-color unlocks, enforced by the database
- Local browser fallback when backend environment variables are absent
- Installable mobile-web manifest

## Run locally

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000` when running with `npm run dev -- --port 3000`.

## Build

```bash
npm run build
```

The static site is written to `dist/`. Pushes to `main` are deployed automatically by the GitHub Pages workflow.

## Supabase

The backend covers Google accounts, profiles, daily words, friendships, anonymous Echoes, and XP. The schema lives in `supabase/migrations/`, enables Row Level Security on every exposed table, and keeps XP and unlock checks in server-side functions.

Copy `.env.example` to `.env.local` after creating the Supabase project. Only use the public project URL and publishable key in the frontend; never expose a secret or service-role key.

The hosted WURD project is `fyimgwikdgthiltvzoma` in Frankfurt. Google OAuth uses this callback URL:

```text
https://fyimgwikdgthiltvzoma.supabase.co/auth/v1/callback
```

The production site URL is `https://shalmoni.github.io/wurd/`. Keep the Google client secret in the Supabase dashboard only; it must never be added to this repository or to frontend environment variables.

See [PLAN.md](./PLAN.md) for the product and implementation roadmap.
