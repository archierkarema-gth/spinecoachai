# Clinical Guardrails

AI must never:
- diagnose scoliosis
- promise Cobb angle reduction
- replace physicians
- recommend stopping treatment

Escalate to medical review if:
- neurological symptoms
- bowel/bladder changes
- severe worsening pain
- trauma
- fever with severe back pain

## Addendum — 2026-07-20: curve-targeted personalization (owner decision)

The owner explicitly opted into curve-targeted exercise/side selection for
this single-user personal app (`src/lib/schemas.ts` → `clinicalProfile`,
`src/lib/personal-seed.ts`). This **supersedes** the earlier generic-only
stance referenced in `docs/11_Roadmap_M9-M14.md`'s rejected-proposals list
for THIS app only — it does not relax anything above:

- The app still never diagnoses, never promises a Cobb angle reduction,
  never replaces a physician, never recommends stopping treatment. Curve
  data biases which side/variant of an already-safe exercise is picked; it
  never appears in output copy as a claim of correction.
- Every curve number and direction is the owner's own self-report (what
  their doctor told them), typed in by the owner — never computed,
  estimated, or inferred by the app.
- Directional cues on individual exercises (e.g. "reach left") are taken
  verbatim from the owner's own source material, not derived by the app
  from raw Cobb-angle numbers — the app has no clinical basis to invent new
  directional logic, only to encode what the owner's own record already
  specifies.

### Update — 2026-07-20: web-verified Schroth convention + engine-level side bias

Owner confirmed the elongate-concave / strengthen-convex convention matches
their physiotherapist's guidance, and asked for a web cross-check before
implementation ("jaga-jaga"). Verified against two independent sources:

- [Scoliosis Exercises - Schroth Method](https://schrothmethod.com/scoliosis-exercises/) —
  "Elongation/Stretching: The concave (collapsed) side receives widening and
  expansion"; "Activation/Strengthening: Convex-side muscles are engaged
  isometrically."
- [Breathing: A Schroth Manifesto | National Scoliosis Center](https://nationalscoliosiscenter.com/blog/scoliosis-insights/schroth-certified-therapy/breathing-and-schroth/) —
  "RAB directs air into and expands the concave (collapsed) side of the
  curve"; "The rib hump (thoracic prominence) occurs on the convex side."

Both agree: **elongate/breathe → concave side; strengthen/activate →
convex side**. This is now implemented systematically at the engine level
(`deriveCorrectiveSideBias` in `src/lib/decision-engine.ts`), keyed off the
owner's self-reported `clinicalProfile.mainCurve.direction` only (never the
upper/counter-curve, never computed/estimated) — not just as manually-tagged
cues on a handful of exercises.

This also **resolves** the Child's Pose contradiction previously flagged
here as open: the owner's source material describes a right-side reach that
lengthens the "short left side" — which looked contradictory against the
upper curve (convex-left, so concave should be right), but is in fact
correctly targeting the **main curve** (T8-9, convex-right → concave-left).
Once keyed to the correct curve segment, there is no contradiction. The
caution comment in `src/lib/exercise-seed.ts` → `ex-child-pose` has been
updated accordingly; this was owner-supplied data being correctly
attributed to the right curve segment, not silently overridden by app logic.