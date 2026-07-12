# Workout Personalization — Design

**Date:** 2026-07-12
**Status:** Approved for planning
**Author:** Claude Code (with Archie)

Four independent, mostly-additive enhancements to the SpineCoach workout engine
and session player. None changes the clinical guardrails: the app still never
diagnoses, never targets a specific curve, and safety/recovery still win over
performance (docs/04, docs/05).

Build order: **F2 → F4 → F3 → F1** (F1 is independent and can land any time).

---

## F1 — Countdown sound (5→0)

**Goal:** audible countdown for the final 5 seconds of every timed phase.

**Behavior:** while the phase timer is running, play a short tick at each of
remaining = 5, 4, 3, 2, 1, and a distinct longer/higher final tone at 0.
Applies to both exercise and rest phases.

**Design:**
- New module `src/lib/use-beep.ts`:
  - Lazy `AudioContext` singleton created/resumed on a user gesture (the play
    tap), so browser autoplay policy never blocks it. No audio asset files —
    tones are synthesized via an oscillator, so it works fully offline.
  - `playTick()` — short blip (e.g. ~880 Hz, ~80 ms).
  - `playFinal()` — longer/higher tone (e.g. ~1320 Hz, ~250 ms).
  - Mute state persisted in `localStorage` (key `spinecoach_beep_muted`);
    exported getter/setter.
- Pure helper `beepForSecond(remaining: number): "tick" | "final" | null`
  (`5..1 → "tick"`, `0 → "final"`, else `null`) — unit-testable without audio.
- `session-player.tsx`:
  - Effect watches `timer.remaining` while `timer.running`; a `lastBeepedSecond`
    ref guards against double-fire on re-render. Resets when the phase changes.
  - Mute toggle (speaker icon) in the player header, wired to `use-beep` state.

**Out of scope:** volume control, custom sounds, haptics.

---

## F2 — Surface advanced exercises

**Problem:** generated sessions in practice only ever show beginner and
intermediate moves. Advanced exercises exist in the library but are almost never
programmed, because `pickForDomain` sorts **easiest-first** and fills the block
from the bottom of the difficulty window — there are always enough easier moves,
so advanced is never reached.

**Goal:** advanced moves appear for a capable user on a full-intensity day.
Keep the existing three tiers (beginner / intermediate / advanced) — **no new
enum, no schema change.**

**Design (`src/lib/decision-engine.ts`):**
- `pickForDomain` gains a selection-direction bias:
  - When the user is **capable** (`floorRank >= 2`), sort the in-window pool
    **hardest-first** (descending difficulty) so the top of the window is
    chosen first. At `full` intensity (ceiling = advanced) this surfaces
    advanced moves.
  - When `floorRank === 1` (genuine beginner), keep the current easiest-first
    behavior.
  - Left/right balancing and the empty-window relaxation are preserved; only
    the ordering within the pool changes.
- Capability already reaches `floorRank` 3 (active baseline 2 + clean streak
  +1) and `DIFFICULTY_CEILING.full` is already `3` (advanced), so no change to
  `deriveCapability` or the ceiling table is required — only the selection
  ordering.
- Add a reasoning line when advanced moves are programmed
  (e.g. "Kesiapan & progres bagus — naik ke variasi tingkat lanjut.").

**Safety:** the difficulty **ceiling** is untouched — low-readiness days still
cap at light/moderate. This only changes *which* in-window move is picked, never
the window itself, so a bad-readiness day can never jump to advanced.

---

## F3 — 70/30 muscle / scoliosis preset (Archie only)

**Goal:** every session generated for Archie targets ~70% muscle-building and
~30% scoliosis-corrective work. Other profiles keep the balanced default.

**Design:**
- `userSchema` gains `trainingPreset: z.enum(["balanced", "muscle-priority"])`,
  optional with default `"balanced"`. `SEED_USER` (Archie) = `"muscle-priority"`.
- Domain groups:
  - **muscle** = `strength`, `conditioning`
  - **scoliosis-corrective** = `breathing`, `mobility`, `stability`
  - neutral/support (unchanged): `core`, `balance`, `recovery`
- `generateSession` reads the preset (threaded via `EngineInputs`, sourced from
  the current user). When `muscle-priority`:
  - Bias per-domain slot counts so muscle domains get more slots and corrective
    domains fewer, targeting ~70/30 of **session time**.
  - **Corrective domains keep a minimum of 1 slot each** — scoliosis work is
    never zeroed out (respects the existing "never drop a safety domain"
    guarantee).
  - Add a reasoning line noting the muscle-priority split.
- Balanced profiles: current behavior, unchanged.

**Note:** the 70/30 is a target the time-budget fitting approximates, not a hard
guarantee on any single short session; over a normal-length session it lands
close.

---

## F4 — Pull-up program (equipment allowlist)

**Goal:** Archie owns a pull-up bar; add a pull-up progression that feeds the
muscle-building goal. Bar-based moves must not appear for users without one.

**Design:**
- `userSchema` gains `ownedEquipment: z.array(z.string())`, optional with
  default `[]`. `SEED_USER` (Archie) = `["pull-up bar"]`.
- `pickForDomain` equipment filter changes from `equipment.length === 0` to an
  **allowlist**: an exercise is eligible if every required equipment item is in
  the user's `ownedEquipment` (bodyweight — empty array — is always eligible).
  Threaded from `generateSession` via `EngineInputs`.
  - **Default (empty allowlist) = bodyweight-only, unchanged for everyone
    else.** The clinical bodyweight constraint holds globally; only a bar owner
    unlocks bar moves.
- New `strength`-domain chain, all `equipment: ["pull-up bar"]`, bilateral:
  1. `ex-dead-hang` — **beginner** (grip/decompression hang)
  2. `ex-scapular-pull` — **intermediate** (active/scapular hang)
  3. `ex-negative-pullup` — **advanced**
  4. `ex-full-pullup` — **advanced**
  With progression/regression links chained in order; contraindications cover
  shoulder pain and any neurological symptom (generic, not curve-specific).
- Because these are `strength`, they count toward F3's 70% muscle target, and
  their advanced entries give F2's hardest-first selection real content to pick.

---

## Cross-cutting

- **Migration:** both new `userSchema` fields are optional with Zod defaults, so
  existing IndexedDB user records parse without a data migration.
- **No RLS / sync change:** synced records are unaffected; `Assessment`/`User`
  payloads simply gain optional fields.
- **Testing (vitest, TDD per existing pattern):**
  - `beepForSecond` mapping (F1).
  - `pickForDomain` hardest-first for capable users, easiest-first for floor 1
    (F2).
  - Equipment allowlist: pull-up chain present with the bar, absent without it
    (F4).
  - `muscle-priority` session lands ~70/30 by time within tolerance and never
    drops a corrective domain to 0 (F3).

## Non-goals

- No new difficulty enum tier.
- No change to intensity gating, ceilings, or red-flag escalation.
- No curve-specific or diagnostic logic.
- No general equipment library — `ownedEquipment` is a simple allowlist seeded
  for the owner; a UI to edit it is out of scope for this spec.
