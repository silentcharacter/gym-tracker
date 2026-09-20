# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

The spec and UI strings are in Russian. Keep writing those in Russian to match what is already there.

**Code comments are in English only** — including commit-adjacent artefacts inside the code (TODO/FIXME notes, JSDoc). If you come across a Russian comment in the code, translate it while you are editing that spot.

## What this is

A Telegram Mini App for tracking gym workouts: blocks of 12 workouts rotating across 5 muscle groups, plus a working-weight log with charts.

**The spec is the source of truth:** [spec/gym-tracker-plan.md](spec/gym-tracker-plan.md) (data model, API, business logic, per-screen UI, stages, acceptance criteria) and [spec/stage-0-infra.md](spec/stage-0-infra.md) (infrastructure, decisions taken, risks). UI mockups live in `spec/mockup/*.png` and are referenced from §8 of the plan. Check the spec before making changes, and update it when a decision diverges from what it describes.

## Current state

Stage 0 (infrastructure) — the code is a hello-world skeleton, not an implementation:

- `functions/src/index.ts` — a single `api` function returning `{ ok, ts, hasInitData }`, with no signature check and no database access. initData verification, actions and `domain/` are stage 1.
- `web/src/App.tsx` — a debug page (prints `user.id`, `themeParams.bg_color`, the `/api` response). None of the screens from §8 exist yet.
- The Firestore SDK is not wired into the client yet (`web/package.json` only has react), and none of the §4 collections exist in the database.
- There is no test runner. Stage 1 calls for unit tests of `domain/rotation.ts` and `auth.ts`; the runner gets picked when those appear.

Use the checklists in §10 of the plan to see what is already done.

## Commands

```bash
# frontend
npm --prefix web run dev        # vite dev server
npm --prefix web run build      # tsc -b && vite build → web/dist
npm --prefix web run lint       # oxlint

# functions
npm --prefix functions run build        # tsc → functions/lib
npm --prefix functions run build:watch
npm --prefix functions run serve        # build + functions-only emulator
npm --prefix functions run logs

# deploy (predeploy hooks in firebase.json build web and functions themselves)
firebase deploy --only firestore:rules,firestore:indexes,functions,hosting --project gym-tracker-tg
```

Project: `gym-tracker-tg`. Firestore and functions region: `asia-southeast1` (the database region can only be changed by recreating the database).

## Architecture

```
Telegram → Firebase Hosting (web/dist)
             ├── reads  → Firestore directly from the client (rules: read = true)
             └── writes → POST /api → Cloud Function `api` (initData check → owner gate → Admin SDK)
```

Three things drive nearly every decision here:

1. **The client never writes to Firestore.** `firestore.rules` is `allow write: if false` for everything. Every mutation goes through the `api` function. Reads are open to anyone — a deliberate decision (§7 of the plan).
2. **One HTTPS function, one endpoint.** Every request is `POST /api` with a `{ action, payload }` body; the action list is in §6 of the plan. The frontend calls its own origin: `firebase.json` rewrites to the function (two rules — `/api` and `/api/**`, because the `/api/**` glob does not match the path without a trailing segment), so CORS is not involved.
3. **All business logic lives on the server, inside transactions.** Block number, position in block and next muscle group are computed by the function, not the client. The client only renders.

Authorization: the client sends `Authorization: tma <initData>`; the function verifies the HMAC signature (`secret = HMAC_SHA256("WebAppData", BOT_TOKEN)`), the freshness of `auth_date`, and that `user.id == OWNER_TELEGRAM_ID` — otherwise `403`. There is exactly one owner. Read-only mode on the client is driven by the `whoami` response and just hides buttons; the real protection is server-side.

### Business-logic invariants

- The next muscle group is derived **from `state.lastGroupId`**, not from `totalCount % 5` — otherwise a manual group change breaks the rotation. If `lastGroupId` is missing from the current group list, the next group is the first one.
- Group order is configured through `updateConfig` and does not reset `lastGroupId`.
- The block boundary (12) and the rotation (5 groups) are independent: 12 is not a multiple of 5, so the rotation carries across block boundaries.
- Only the **last** workout (highest `seq`) can be deleted or undone, after which `state` is recomputed from the new last entry.
- "Today" is computed by the server in `config.timezone` (`Asia/Bangkok`); the client may pass `date` explicitly to backdate an entry.
- `exercises.lastWeight/lastDate` are denormalized: the `addWeight` and `deleteWeight` actions must keep them in sync.

### Secrets

- `BOT_TOKEN` — Secret Manager only, via `defineSecret` (`firebase functions:secrets:set BOT_TOKEN`). It never enters git.
- `OWNER_TELEGRAM_ID` — `defineString`, value stored in `functions/.env.<project-id>` (gitignored; template in `functions/.env.example`).

## UI conventions

- `Telegram.WebApp.MainButton` is **not used**: it pins itself to the bottom of the window and clashes with the tab bar. A screen's primary action is a regular full-width button anchored above the bottom tab bar. Telegram's `BackButton` is used, though.
- Theming comes from `Telegram.WebApp.themeParams` via CSS variables; call `ready()` + `expand()` on start; fire `HapticFeedback` on a successful write.
