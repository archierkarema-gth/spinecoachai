# SpineCoach AI — Project Report

_Generated 2026-07-12_

## Overview

SpineCoach AI is an offline-first, privacy-preserving web app that generates
personalized daily bodyweight sessions for a scoliosis-aware training routine.
All "AI" is a **pure, deterministic, rule-based decision engine** — no model
calls, no network dependency for core logic. The app never diagnoses, never
estimates a Cobb angle, and never targets a specific curve; safety and recovery
always win over performance.

## At a glance

| Metric | Value |
|--------|-------|
| Development window | 2026-07-09 → 2026-07-12 |
| Commits | 37 |
| App routes (pages) | 12 |
| Test files / tests | 8 / 65 passing |
| Exercise library | 36 bodyweight-first movements |
| Stack | Next.js 16 (app router), React 19, TypeScript, Zod 4, Tailwind 4 |
| Storage | IndexedDB (`idb`) — offline-first |
| Optional sync | Supabase (offline-first cloud sync + cross-device sync code) |
| Deploy | Vercel (`arka168/spinecoach-ai`), Supabase project `hukidfeaycdwayljouor` — redeploy via `vercel --prod` |

## Architecture

- **Decision engine** (`src/lib/decision-engine.ts`) — pure functions:
  intensity from daily check-in, capability floor from activity + workout logs,
  goal weights from the assessment, a difficulty-window picker with generic
  left/right balancing, and session assembly under a time budget. No network,
  no model, fully unit-tested.
- **Schemas** (`src/lib/schemas.ts`, `exercise-schemas.ts`, `log-schemas.ts`) —
  Zod as the single source of truth; new fields are optional-with-default so
  existing IndexedDB records parse without migration.
- **Storage** (`src/lib/db.ts`) — IndexedDB via `idb`, offline-first. Optional
  Supabase sync layers on top without becoming a hard dependency.
- **UI** — Next.js app-router pages; the guided session player uses a
  `useCountdown` hook and an offline Web Audio countdown beep.
- **Clinical guardrails** (`docs/04_Clinical_Guardrails.md`) — red-flag
  escalation and intensity ceilings are never weakened; corrective work is
  never dropped to zero.

## Milestone status

| Milestone | Scope | Status |
|-----------|-------|--------|
| M1 | Scaffold — nav, theme, dashboard, assessment, IndexedDB | ✅ |
| M2 | Exercise system, daily check-in, decision engine | ✅ |
| M3 | Workout log, pain tracker, progress dashboard | ✅ |
| M4 | Progress photos, reports, settings (MVP complete) | ✅ |
| Cloud sync | Offline-first Supabase + cross-device sync code | ✅ |
| Guided session player | Timed, exercise-by-exercise, rest, post-session pain | ✅ |
| M8 | Engine personalization — goal weights, capability floor, library expansion | ✅ |
| Workout personalization | F1 beep, F2 advanced surfacing, F3 muscle-priority, F4 pull-ups | ✅ |

_Note: milestone numbering jumps M4 → M8 (historical labeling). No M5/M6/M7
were ever defined in docs, plans, or commits._

## MVP pages (PRD §MVP) — all shipped

Dashboard · Initial Assessment · Daily Check-in · Today's Workout ·
Exercise Library · Workout Log · Pain Tracker · Progress Photos · Reports ·
Settings — 10/10 present as routes.

## Latest feature: Workout Personalization

Merged to `master` at `b3b7668` (6 commits, 65/65 tests green, verified
end-to-end in the running app):

- **F1 — Countdown beep.** Offline Web Audio tone for the final 5s (5→0) with a
  persisted mute toggle. Pure `beepForSecond` mapping is unit-tested.
- **F2 — Advanced surfacing.** Capable users (capability floor ≥ 2) get a
  hardest-first pick, so the strength block leads with the toughest in-window
  move instead of an easy one. Ceiling/safety untouched.
- **F3 — 70/30 muscle-priority preset.** Owner-only mix that biases muscle
  domains while never zeroing corrective work (measured muscle share 0.569).
  Reached via per-domain slot biasing + a widened muscle floor + disabling
  hardest-first on corrective domains.
- **F4 — Pull-up program.** Four-move chain (Dead Hang → Scapular Pull →
  Negative Pull-up → Full Pull-up) gated behind an `ownedEquipment` allowlist;
  hidden for bodyweight-only users, surfaced for the seed owner (owns a bar).
- **Profile fields.** `trainingPreset` and `ownedEquipment` added to
  `userSchema` (optional + defaulted → no migration).

## Open items

- **Pull-up equipment tag mislabel** — workout cards label bar-required pull-up
  moves as "Bodyweight"; the tag ignores each exercise's `equipment` array.
  (Flagged as a follow-up task.)
- **Future scope (PRD, unspecced):** Wearables integration; any image feature
  must stay guardrail-safe (no Cobb estimation / no diagnosis).

## Verification

- Full suite: **65 tests / 8 files, all passing.**
- Type-check: `npx tsc --noEmit` clean.
- Last feature verified in-browser: pull-ups surfaced in the strength block,
  both personalization reasoning lines rendered, session-player mute toggle
  flips + persists, Web Audio beep path runs without console errors.

## Commands

- Test: `npm run test -- --run` (Vitest)
- Type-check: `npx tsc --noEmit`
- Lint: `npm run lint`
- Dev: `npm run dev` (port 3000)
- Deploy: `vercel --prod`
