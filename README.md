# Gym Tracker

A Telegram Mini App for tracking gym workouts with a personal trainer.

It does two things:

1. **Workout blocks.** A block is exactly 12 workouts, rotating through 5 muscle groups. Logging a workout is one tap — the server stamps today's date and the next group in the rotation. After the 12th workout a new block starts automatically.
2. **Working-weight log.** Exercises are grouped by muscle group; each entry records exercise, weight and date, and every exercise gets a progress chart.

**Access model:** anyone with the link can read (including the trainer). Only the owner, identified by their Telegram ID, can write.

## Status

Stage 0 — infrastructure. The deployed app is a hello-world that proves the pipeline works (Hosting → `/api` → Cloud Function, Telegram theme and `initData` arriving). The real screens and business logic land in stages 1–3. See §10 of the plan for the stage checklists.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | Vite + React + TypeScript, `telegram-web-app.js`, Chart.js (planned) |
| Hosting | Firebase Hosting |
| Database | Cloud Firestore (`asia-southeast1`) |
| Writes | Cloud Functions for Firebase (2nd gen), Node 22, TypeScript |
| Auth | Telegram `initData` HMAC verification + owner Telegram ID |

Requires a Firebase project on the Blaze plan. At this usage level costs stay inside the free tier.

## Architecture

```
Telegram (owner / trainer)
        │  opens t.me/<bot>/app
        ▼
Firebase Hosting ── static frontend
        │
        ├── reads  ──► Firestore directly (rules: read = true)
        │
        └── writes ──► Cloud Function `api`
                          ├─ verify initData signature
                          ├─ user.id == OWNER_TELEGRAM_ID ?
                          └─ write via Admin SDK (transactions)
```

The client never writes to Firestore — the rules are `allow write: if false`. Every mutation is a `POST /api` with an `{ action, payload }` body, handled by a single HTTPS function. Hosting rewrites `/api` to that function, so the frontend talks to its own origin and CORS never comes up.

All business logic (block number, next muscle group) runs server-side inside a transaction. Opened outside Telegram, the app is read-only.

## Repository layout

```
firebase.json            hosting → web/dist, rewrite /api → function `api`
firestore.rules          public read, no client writes
firestore.indexes.json   composite index for weightLogs
functions/               Cloud Function `api` (TypeScript, Node 22)
web/                     Vite + React frontend
spec/                    plan, stage docs and UI mockups
```

[spec/gym-tracker-plan.md](spec/gym-tracker-plan.md) is the source of truth for the data model, API actions, business rules and per-screen UI. [spec/stage-0-infra.md](spec/stage-0-infra.md) covers the infrastructure setup in detail. Both are in Russian.

## Setup

Prerequisites: Node 22, `firebase-tools`, `gcloud`, and a Telegram bot created via [@BotFather](https://t.me/BotFather).

```bash
npm --prefix functions install
npm --prefix web install
firebase login
```

Infrastructure (GCP project, Firebase, Firestore in `asia-southeast1`, enabled APIs) is described step by step in [spec/stage-0-infra.md](spec/stage-0-infra.md) §0.1–0.2.

Configuration:

```bash
# bot token — Secret Manager only, never committed
firebase functions:secrets:set BOT_TOKEN --project gym-tracker-tg

# owner's Telegram ID — local env file, gitignored
cp functions/.env.example functions/.env.gym-tracker-tg
# then edit OWNER_TELEGRAM_ID
```

The owner's Telegram ID is whatever `user.id` the app prints when you open it from Telegram.

## Development

```bash
npm --prefix web run dev        # vite dev server
npm --prefix web run build      # tsc -b && vite build → web/dist
npm --prefix web run lint       # oxlint

npm --prefix functions run build        # tsc → functions/lib
npm --prefix functions run build:watch
npm --prefix functions run serve        # build + functions emulator
npm --prefix functions run logs
```

`initData` is only delivered when the app is opened through `t.me/<bot>/<app>` or the bot's menu button — a plain browser tab always falls back to read-only mode.

## Deploy

```bash
firebase deploy --only firestore:rules,firestore:indexes,functions,hosting --project gym-tracker-tg
```

The predeploy hooks in `firebase.json` build `web/` and `functions/` for you.
