# M15 — PWA Install Prompt + Daily Reminder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dismissible daily check-in reminder banner on the Dashboard and a dismissible install-prompt banner app-wide, plus commit the already-present-but-uncommitted PWA shell infra (manifest, service worker, icons, register component).

**Architecture:** Two small, independent, pure-logic-plus-thin-component features. Both read from existing Zustand store state and `localStorage` only — no schema/DB changes, no network calls, no changes to the decision engine.

**Tech Stack:** Next.js (client components), Zustand (`useAppStore`), Vitest, Tailwind (existing `Card`/`Button` primitives).

## Global Constraints

- No IndexedDB schema change, no DB version bump (spec section "Non-goals").
- No web push / VAPID / `Notification.requestPermission()` (spec section "Non-goals").
- No change to `decision-engine.ts`, `store.ts` core logic, or the existing "Sesi hari ini" CTA card's behavior (spec section "Non-goals").
- Reminder banner only shown when `latestAssessment` exists, local time `>= 16:00`, and `latestCheckIn` is not from today, using the existing `todayKey()` helper pattern from `src/lib/schroth-schemas.ts` (spec section 1).
- Install banner only shown when `beforeinstallprompt` was captured, app is not standalone, and not dismissed within 14 days (spec section 2).
- Dismiss state lives only in `localStorage`, never IndexedDB (spec section "Non-goals").

---

### Task 1: Commit inherited PWA shell infra

**Files:**
- Add (already on disk, untracked): `public/manifest.json`, `public/sw.js`, `src/components/pwa/sw-register.tsx`, `public/icons/apple-touch-icon.png`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png`

**Interfaces:**
- Consumes: nothing (files already exist on disk from a prior session; already wired into `src/app/layout.tsx` via `<ServiceWorkerRegister />` and `manifest: "/manifest.json"` in the metadata export).
- Produces: nothing new for later tasks — this is a pure commit-what's-already-working step.

- [ ] **Step 1: Verify the files are exactly what's expected and nothing else is staged**

Run: `git status --short public/manifest.json public/sw.js src/components/pwa/sw-register.tsx public/icons/`
Expected: all four paths listed with `??` (untracked).

- [ ] **Step 2: Stage and commit**

```bash
git add public/manifest.json public/sw.js src/components/pwa/sw-register.tsx public/icons/
git commit -m "feat(pwa): add app shell manifest, service worker, and icons

Inherited from a prior session; already wired into layout.tsx. Committing
as its own step so history separates shell infra from the M15 reminder
and install-prompt work built on top of it."
```

- [ ] **Step 3: Confirm nothing else got swept in**

Run: `git show --stat HEAD`
Expected: only the 4 files (7 including the 4 icon files individually) from Step 1 listed, no `src/app/` or `src/lib/` files.

---

### Task 2: `shouldShowReminder` pure function + tests

**Files:**
- Create: `src/lib/pwa.ts`
- Test: `src/lib/__tests__/pwa.test.ts`

**Interfaces:**
- Consumes: nothing (pure function, no imports from store/DB).
- Produces: `shouldShowReminder(params: ShouldShowReminderParams): boolean` and `type ShouldShowReminderParams = { now: Date; hasAssessment: boolean; latestCheckInAt: number | null; hourThreshold?: number }`, used by Task 3's `ReminderBanner` component.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/pwa.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { shouldShowReminder } from "@/lib/pwa";

function at(hour: number, minute = 0): Date {
  return new Date(2026, 6, 21, hour, minute, 0, 0); // 2026-07-21 local time
}

describe("shouldShowReminder", () => {
  it("is false before the hour threshold even with no check-in", () => {
    expect(
      shouldShowReminder({
        now: at(15, 59),
        hasAssessment: true,
        latestCheckInAt: null,
      })
    ).toBe(false);
  });

  it("is true at/after the hour threshold with no check-in yet", () => {
    expect(
      shouldShowReminder({
        now: at(16, 0),
        hasAssessment: true,
        latestCheckInAt: null,
      })
    ).toBe(true);
  });

  it("is false if the latest check-in was already today", () => {
    const now = at(18, 0);
    const checkedInToday = new Date(2026, 6, 21, 9, 0, 0, 0).getTime();
    expect(
      shouldShowReminder({
        now,
        hasAssessment: true,
        latestCheckInAt: checkedInToday,
      })
    ).toBe(false);
  });

  it("is true if the latest check-in was yesterday", () => {
    const now = at(18, 0);
    const checkedInYesterday = new Date(2026, 6, 20, 9, 0, 0, 0).getTime();
    expect(
      shouldShowReminder({
        now,
        hasAssessment: true,
        latestCheckInAt: checkedInYesterday,
      })
    ).toBe(true);
  });

  it("is false when there is no assessment yet, regardless of time", () => {
    expect(
      shouldShowReminder({
        now: at(20, 0),
        hasAssessment: false,
        latestCheckInAt: null,
      })
    ).toBe(false);
  });

  it("respects a custom hourThreshold", () => {
    expect(
      shouldShowReminder({
        now: at(17, 30),
        hasAssessment: true,
        latestCheckInAt: null,
        hourThreshold: 18,
      })
    ).toBe(false);
    expect(
      shouldShowReminder({
        now: at(18, 30),
        hasAssessment: true,
        latestCheckInAt: null,
        hourThreshold: 18,
      })
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/pwa.test.ts`
Expected: FAIL — `Cannot find module '@/lib/pwa'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/pwa.ts`:

```ts
/**
 * Pure PWA-affordance helpers. No DOM/localStorage/store access here —
 * components wire in `Date.now()`, store state, and localStorage
 * separately so this stays unit-testable without a browser environment.
 */

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface ShouldShowReminderParams {
  now: Date;
  hasAssessment: boolean;
  /** epoch ms of the latest check-in, or null if none exists yet */
  latestCheckInAt: number | null;
  /** local hour (0-23) after which the reminder may show; default 16 */
  hourThreshold?: number;
}

export function shouldShowReminder({
  now,
  hasAssessment,
  latestCheckInAt,
  hourThreshold = 16,
}: ShouldShowReminderParams): boolean {
  if (!hasAssessment) return false;
  if (now.getHours() < hourThreshold) return false;
  if (latestCheckInAt === null) return true;
  return localDateKey(new Date(latestCheckInAt)) !== localDateKey(now);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/pwa.test.ts`
Expected: PASS — 6 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pwa.ts src/lib/__tests__/pwa.test.ts
git commit -m "feat(m15): add shouldShowReminder pure helper"
```

---

### Task 3: `ReminderBanner` component wired into Dashboard

**Files:**
- Create: `src/components/dashboard/reminder-banner.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `shouldShowReminder` and `ShouldShowReminderParams` from `@/lib/pwa` (Task 2); `useAppStore` fields `latestAssessment: Assessment | null` and `latestCheckIn: CheckIn | null` (both already exist in `src/lib/store.ts`); `Card` from `@/components/ui/card`.
- Produces: `ReminderBanner` default export (no props), inserted into `src/app/page.tsx`'s JSX. No other task depends on its internals.

- [ ] **Step 1: Write the component**

Create `src/components/dashboard/reminder-banner.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { shouldShowReminder } from "@/lib/pwa";

function todayKeyLocal(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function ReminderBanner() {
  const { latestAssessment, latestCheckIn } = useAppStore();
  const [dismissed, setDismissed] = useState(true); // default hidden until client mount

  useEffect(() => {
    const key = `reminder-dismissed-${todayKeyLocal(new Date())}`;
    setDismissed(window.localStorage.getItem(key) === "1");
  }, []);

  const visible =
    !dismissed &&
    shouldShowReminder({
      now: new Date(),
      hasAssessment: !!latestAssessment,
      latestCheckInAt: latestCheckIn?.createdAt ?? null,
    });

  if (!visible) return null;

  function dismiss() {
    const key = `reminder-dismissed-${todayKeyLocal(new Date())}`;
    window.localStorage.setItem(key, "1");
    setDismissed(true);
  }

  return (
    <Card className="flex-row items-center justify-between gap-3 border-transparent bg-primary/10">
      <p className="text-sm text-foreground">
        Belum check-in hari ini. Yuk isi biar sesi hari ini pas.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Link href="/checkin">
          <Button variant="default" className="px-3 py-1.5 text-xs">
            Check-in
          </Button>
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Tutup pengingat"
          className="text-muted-foreground"
        >
          ×
        </button>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Wire it into the Dashboard**

In `src/app/page.tsx`, add the import near the other component imports (after the `Button` import):

```ts
import { ReminderBanner } from "@/components/dashboard/reminder-banner";
```

Then insert `<ReminderBanner />` as the first child inside the `<div className="flex flex-col gap-4 px-5">` wrapper, immediately before the `{!latestAssessment ? (` block:

```tsx
      <div className="flex flex-col gap-4 px-5">
        <ReminderBanner />
        {!latestAssessment ? (
```

- [ ] **Step 3: Run the full test suite and typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 TypeScript errors; all test files pass (188 tests: 182 prior + 6 from Task 2).

- [ ] **Step 4: Manual browser verification**

Start dev server, open Dashboard. In the browser console, force the condition:

```js
localStorage.clear();
```

Then use `javascript_tool` to check `document.querySelector('body').innerText` includes "Belum check-in hari ini" only when local system time is past 16:00 and there's no check-in from today — verify by temporarily lowering `hourThreshold`'s effective check is not needed; instead confirm the banner is ABSENT before 16:00 (expected, given real clock) and note in the report that full on/off toggling is covered by the Task 2 unit tests, not re-derived by hand in the browser. Confirm dismiss (click ×) removes it and `localStorage` gains a `reminder-dismissed-<today>` key. Reload — banner stays hidden. Confirm no console errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/reminder-banner.tsx src/app/page.tsx
git commit -m "feat(m15): add daily check-in reminder banner to Dashboard"
```

---

### Task 4: `InstallPrompt` component wired into root layout

**Files:**
- Create: `src/components/pwa/install-prompt.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: browser `beforeinstallprompt` event (untyped in lib.dom.d.ts — cast via a local interface), `window.matchMedia`, `window.localStorage`. No store/DB dependency.
- Produces: `InstallPrompt` default export (no props), mounted once in `src/app/layout.tsx` next to `<ServiceWorkerRegister />`.

- [ ] **Step 1: Write the component**

Create `src/components/pwa/install-prompt.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "install-prompt-dismissed-at";
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

export function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const lastDismissed = Number(
      window.localStorage.getItem(DISMISS_KEY) ?? "0"
    );
    if (Date.now() - lastDismissed < COOLDOWN_MS) {
      setDismissed(true);
    }

    function handler(e: Event) {
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferredEvent || dismissed) return null;

  async function install() {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    setDeferredEvent(null);
  }

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  }

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 flex items-center justify-between gap-3 border-t border-border bg-card px-5 py-3">
      <p className="text-sm text-foreground">
        Install SpineCoach di layar utama biar lebih cepat dibuka.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={install}
          className="rounded-[var(--radius-sm)] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          Install
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Tutup"
          className="text-muted-foreground"
        >
          ×
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the root layout**

In `src/app/layout.tsx`, add the import next to `ServiceWorkerRegister`:

```ts
import { InstallPrompt } from "@/components/pwa/install-prompt";
```

Then render it next to `<ServiceWorkerRegister />`:

```tsx
        <ServiceWorkerRegister />
        <InstallPrompt />
```

- [ ] **Step 3: Run typecheck and full test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 TypeScript errors; all tests still pass (188).

- [ ] **Step 4: Manual browser verification**

Start dev server, open any page. In the Browser pane, use `javascript_tool` to simulate the event since real Chromium install-eligibility heuristics are slow/unreliable in an automated pass:

```js
const evt = new Event('beforeinstallprompt', { cancelable: true });
evt.prompt = () => Promise.resolve();
evt.userChoice = Promise.resolve({ outcome: 'accepted' });
window.dispatchEvent(evt);
```

Confirm the bottom banner appears with "Install SpineCoach di layar utama...". Click the × dismiss button, confirm it disappears and `localStorage.getItem('install-prompt-dismissed-at')` is a non-empty timestamp string. Reload and re-dispatch the event — confirm the banner stays hidden (cooldown respected). Confirm no console errors in either state.

- [ ] **Step 5: Commit**

```bash
git add src/components/pwa/install-prompt.tsx src/app/layout.tsx
git commit -m "feat(m15): add custom install-prompt banner"
```

---

### Task 5: Full verification pass

**Files:** none (verification only)

**Interfaces:** none.

- [ ] **Step 1: Full typecheck, lint, tests, build**

Run: `npx tsc --noEmit && npx eslint . && npx vitest run && npm run build`
Expected: 0 tsc errors, 0 eslint errors, 188/188 tests pass, build succeeds with all existing routes plus no new route (both features are components, not pages).

- [ ] **Step 2: Dev-server smoke test in the Browser pane**

Start dev server, load Dashboard and confirm no console/server errors, confirm the "Sesi hari ini" card is unchanged, confirm bottom nav is not visually broken by the (currently-not-visible, since no real `beforeinstallprompt` fired) install banner's `fixed bottom-16` positioning — resize to mobile viewport (375×812) and screenshot to confirm no overlap with `bottom-nav`.

- [ ] **Step 3: Update the roadmap doc**

Append to `docs/11_Roadmap_M9-M14.md` (or create a short `docs/12_Roadmap_M15.md` if the existing file's title makes an M15 entry awkward — use judgment matching the existing doc's style) noting M15 is done: install prompt + daily reminder banner, no push/VAPID, no schema change. Commit:

```bash
git add docs/
git commit -m "docs(m15): mark PWA install prompt + reminder milestone done"
```
