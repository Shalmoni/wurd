# wurd

One word a day. See what resonates.

`wurd` is a mobile-first social web app where each person posts exactly one word per local day. Posting unlocks a quiet daily feed. People can anonymously Echo words that resonate, follow friends, build a personal word diary, and earn XP through consistent participation.

## Current prototype

- One-word daily posting flow with a confirmation step
- Today feed with 12 two-column word cards
- Top Today and Friends views
- Anonymous Echo interactions by double-tap
- World map and rewind concept
- Personal word diary and streak concept
- Local browser persistence while the shared backend is connected
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

The planned backend covers passwordless accounts, profiles, daily words, friendships, anonymous Echoes, and XP. The initial schema lives in `supabase/migrations/` and enables Row Level Security on every exposed table.

Copy `.env.example` to `.env.local` after creating the Supabase project. Only use the public project URL and publishable key in the frontend; never expose a secret or service-role key.

See [PLAN.md](./PLAN.md) for the product and implementation roadmap.
