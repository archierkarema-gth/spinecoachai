# M16 — Targeted Split + Schroth Integration (redesign spec)

Source: owner spec `spinecoach-redesign-spec.md` (2026-07-22). This doc records
how that spec maps onto the codebase and what shipped in each phase, so the
build order is auditable and the clinical guardrails stay explicit.

## Ground truth (spec §0, FINAL — owner's orthopedic record)

Double major curve:

| Region | Apex | Cobb | Convex | Concave |
|---|---|---|---|---|
| Thoracic T1–T5 | T3–T4 | 32° | LEFT | RIGHT |
| Thoracic T6–T12/L1 | T8–T9 | 29° | RIGHT | LEFT |

Rib hump RIGHT posterior (forward bend 8°). This matches `personal-seed.ts`
(`upperCurve.direction: left`, `mainCurve.direction: right`, `ribHumpSide: right`).

## Schroth — what may be hardcoded (spec §1)

Breathing direction is pure geometry → safe to author:
- Upper (T1–T5): breathe into RIGHT upper (concave right).
- Lower (T6–T12): breathe into LEFT lower (concave left).

MUST NOT hardcode — carried as `schrothCuePendingPT: true`, rendered editable
with a "menunggu validasi Schroth PT" badge, never pre-filled with a guessed side:
- strengthen vs stretch side (3-curve vs 4-curve — PT's call),
- rotational derotation direction,
- loaded-side choice on unilateral therapeutic moves (suitcase carry, asymmetric superman).

Rationale: if these are inverted and followed daily, the curve deepens.
Breathing is safe to derive; strengthen/stretch/rotation are not.

## Clinical non-negotiables (carried from docs/04 + owner memory)

- The app never claims or projects a Cobb-angle reduction. Progression/projection
  is about movement capability only.
- Rib-hump and asymmetry inputs are LOGGED, never auto-labeled "memburuk"
  (self-measure is noisy) — surface trend + "cek PT", not a clinical claim.
- Bodyweight only.

## Phase map

- **Phase 1 (this session) — data + logic core (spec §1,2,4,5-data,6):**
  - `exercise-schemas.ts`: category / level / family / progression prev-next /
    rep+hold targets / schroth cue + PENDING_PT / mirror / PT-gate / contra fields.
  - `schemas.ts`: `User.ptCleared` (default false).
  - `log-schemas.ts`: `SessionLog`, `AsymmetryLog`.
  - `exercise-seed.ts`: normalizer derives new fields for existing moves;
    `[NEW]` moves + Appendix-A families seeded; §4 contra/PT flags set.
  - `split.ts`: fixed Mon–Sat templates + Sunday/week-7 deload (spec §5).
  - `progression.ts`: auto-promote/demote (spec §6.3–6.4) + 6-month projection (§6B).
  - `db.ts`: v8 — `sessionLogs`, `asymmetryLogs` stores + helpers.
  - Unit tests for split + progression.
  - Old dynamic `decision-engine.ts` left intact so the app still builds; it is
    superseded and removed when the workout UI is rewired.

- **Phase 1 — DONE.**

- **Phase 2 (spec §3, §5-UI) — DONE:**
  - `split.ts` → `resolveToday` drives `workout/page.tsx`; day-of-week picks the day.
  - Pain questionnaire GATE removed — the workout no longer requires a check-in;
    session goes straight to preview → play → log.
  - `session-player.ts` + `SessionPlayer` decoupled from the old engine (take
    `PlayerBlock[]`); pain slider dropped.
  - New `SessionLogForm`: per-exercise SessionLog (reps/hold, form, rpe, mirror)
    + the demoted 1-tap AsymmetryLog (§3) + the §6.5 accuracy caveat.
  - Persist dual-writes SessionLog + AsymmetryLog and still a WorkoutLog so
    progress/report history stays intact.
  - `decision-engine.ts` (+ its test) deleted — nothing referenced it.
  - Dashboard CTA repointed from `/checkin` to `/workout`.
  - Still open in a later pass: `/checkin` route + its bottom-nav tab are now
    orphaned (harmless); progression map + safety strip on the dashboard.

- **Phase 3a (spec §7) — DONE:**
  - `progression-view.ts`: `buildProgressionMap` (per foundational family:
    current level, active move, next unlock + PT/contra lock, 6-month
    projection) and `buildSafetyStrip` (ptCleared, unreviewed asymmetry count,
    neutral alert). Skill-lines excluded (§6B.3).
  - `ProgressionMap` + `SafetyStrip` components on `/progress`, sorted
    behind-first. Store now carries `sessionLogs` + `asymmetryLogs`
    (`refreshM16Logs`), refreshed when a session is logged.

- **Phase 3b (spec §8) — DONE:** pure timers `breathing-timer.ts` (phase machine)
  + `kegel-timer.ts` (quick/elevator schedules) + `reminders.ts` (daily schedule,
  `nextDaily`), all unit-tested. Pages `/breathing`, `/kegel` (writes `kegelLogs`),
  dashboard `RemindersCard`. OS push (service-worker) deferred — pure schedule
  is the tested core, surfaced in-app.

- **Phase 3c (spec §9) — DONE:** `/ribhump` (log-only, no "worsening" claim,
  `ribHumpLogs`), `/asymmetry` (logger + review toggle, `setAsymmetryReviewed`),
  `/mirror` (plumb + horizontal overlay, local-only, nothing stored), `/poses`
  (Schroth library from schroth-category exercises, PENDING_PT badges). All
  linked under "Alat skoliosis" in `/more`. DB → v9 (`ribHumpLogs`, `kegelLogs`).

- **Open loose ends:** `/checkin` route + its bottom-nav tab remain orphaned;
  OS push notifications not yet wired (in-app reminders only).

## Level rename (spec §6.1)

| Level | Name | old tier |
|---|---|---|
| 1 | Beginner | B |
| 2 | Intermediate | I |
| 3 | Advanced | A |
| 4 | Master | E |

Existing `difficulty` (beginner/intermediate/advanced) maps 1/2/3; Master (4) is
new and only reachable via explicitly-seeded elite moves.
