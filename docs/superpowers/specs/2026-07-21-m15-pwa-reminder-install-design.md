# M15 — PWA Install Prompt + Daily Check-in Reminder

Date: 2026-07-21

## Context

M9–M14 (progressive overload, recovery load, library expansion, plank
benchmark, weekly reassessment/deload, muscle & breathing preferences) are
all merged. A prior session (uncommitted in the working tree) added PWA
shell infra: `public/manifest.json`, `public/sw.js` (network-first nav /
cache-first assets, same-origin only), `src/components/pwa/sw-register.tsx`
(registers the SW, no UI), and icon assets — already wired into
`src/app/layout.tsx`. That infra has no install affordance and no reminder
mechanism yet.

Constraint carried from the app's architecture (docs/AGENTS.md, engine
principles in docs/11): the decision engine stays network-free and
deterministic. This milestone does not touch the engine — it is UI-only,
reading existing store state and browser APIs.

True background push (notifications while the app/tab is fully closed)
requires a push server + VAPID keys, which is out of scope for a personal,
single-user, no-backend app. This milestone implements local-only
affordances that only act while the app is open.

## Scope

### 1. Daily check-in reminder banner

A compact dismissible banner on the Dashboard (`src/app/page.tsx`), shown
above the existing "Sesi hari ini" card, when **all** of:

- `latestAssessment` exists (onboarding done — no point nudging before
  that).
- Local device time is `>= 16:00`.
- `latestCheckIn` was not created today (compared via the existing
  `todayKey()` date-key helper from `src/lib/schroth-schemas.ts`, same
  pattern already used for the Schroth daily count).

Dismissing hides it for the rest of that calendar day only
(`localStorage["reminder-dismissed-<todayKey>"]`); it reappears
automatically the next day if the condition is still true. This does not
change or replace the existing "Sesi hari ini" CTA card — it is an
additional nudge above it.

The comparison logic is extracted into a pure, testable function in
`src/lib/pwa.ts`:

```ts
function shouldShowReminder(params: {
  now: Date;
  hasAssessment: boolean;
  latestCheckInAt: number | null; // epoch ms, or null if none
  hourThreshold?: number; // default 16
}): boolean
```

No DOM/store access inside this function — the component wires store data
and `Date.now()` into it and applies the dismiss check separately.

### 2. Install prompt banner

A compact banner (`src/components/pwa/install-prompt.tsx`), mounted once
from the root layout alongside `<ServiceWorkerRegister />`, shown when
**all** of:

- The `beforeinstallprompt` event has fired and been captured (`event
  .preventDefault()`'d, event object kept in state).
- The app is not already running standalone
  (`matchMedia('(display-mode: standalone)').matches` is false).
- Not dismissed within the last 14 days
  (`localStorage["install-prompt-dismissed-at"]`, compared as an epoch-ms
  timestamp).

"Install" button calls `deferredEvent.prompt()`. Dismiss ("×") stores
`Date.now()` to the localStorage key and hides the banner. If the browser
never fires `beforeinstallprompt` (Safari, already installed, etc.), the
component renders nothing — no error, no fallback UI.

### 3. Commit existing PWA infra

The manifest/service-worker/register/icons from the prior session are
currently uncommitted. They ship in their own commit, ahead of this
milestone's new components, so history distinguishes "shell infra
inherited" from "M15 reminder + install prompt work."

## Non-goals

- No web push / VAPID / notification permission prompts.
- No IndexedDB schema change, no DB version bump.
- No change to `decision-engine.ts`, `store.ts` core logic, or the
  "Sesi hari ini" CTA card's existing behavior.
- No install-prompt or reminder state persisted beyond `localStorage`
  (pure UI/browser-affordance state, not clinical or session data).

## Testing

- `src/lib/__tests__/pwa.test.ts`: unit tests for `shouldShowReminder` —
  before/after the 16:00 threshold, checked-in today vs. yesterday vs.
  never, no assessment yet.
- Browser verification (manual, since `beforeinstallprompt` and real clock
  time aren't unit-testable): confirm the reminder banner appears/hides
  correctly by manipulating `latestCheckIn`/system context, confirm dismiss
  persists for the day, confirm the install banner's conditional render
  logic (event capture, standalone check, dismiss cooldown) via
  `javascript_tool` event dispatch in the Browser pane.

## Files touched

New:
- `src/lib/pwa.ts`
- `src/lib/__tests__/pwa.test.ts`
- `src/components/dashboard/reminder-banner.tsx`
- `src/components/pwa/install-prompt.tsx`

Changed:
- `src/app/page.tsx` — insert `<ReminderBanner />`.
- `src/app/layout.tsx` — insert `<InstallPrompt />`.

Unchanged but newly committed (inherited from prior session):
- `public/manifest.json`, `public/sw.js`,
  `src/components/pwa/sw-register.tsx`, `public/icons/*`.
