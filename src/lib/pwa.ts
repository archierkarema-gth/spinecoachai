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
