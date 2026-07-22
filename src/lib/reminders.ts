/**
 * M16 reminder schedule (spec §8). Pure time helpers — no Notification API, no
 * DOM. Components read the schedule to render an in-app list and to decide the
 * next reminder. Actual OS push (service-worker driven) is layered on top of
 * this pure core separately.
 */

export interface DailyReminder {
  id: string;
  /** Local time "HH:MM". */
  time: string;
  label: string;
}

/** Fixed daily reminders (spec §8). Pre/post-workout ones are event-driven
 * (fired by the workout flow), so only the clock-based ones live here. */
export const DAILY_REMINDERS: DailyReminder[] = [
  { id: "morning", time: "07:00", label: "Schroth 3D breathing 5 mnt + Kegel pagi" },
  { id: "noon", time: "12:00", label: "Schroth breathing 3 mnt + cek postur" },
  { id: "evening", time: "21:00", label: "Kegel malam + Schroth side-lying (sisi PENDING_PT)" },
];

/** Periodic reminders (spec §8) — surfaced as informational cards. */
export const PERIODIC_REMINDERS: { id: string; label: string }[] = [
  { id: "deload", label: "Minggu ke-7: deload — volume 50%, intensitas 70%" },
  { id: "photo", label: "Bulanan: progress photo (samping & belakang, berdiri & forward bend)" },
  { id: "cobb", label: "3 bulan: reminder cek Cobb angle → dokter (app tidak menghitung)" },
];

function minutesOfDay(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Minutes until the reminder from `now` today, or negative if already passed. */
export function minutesUntil(now: Date, time: string): number {
  return minutesOfDay(time) - (now.getHours() * 60 + now.getMinutes());
}

/**
 * The next daily reminder at/after `now`. Wraps to tomorrow's first reminder
 * when all of today's have passed (`wrapped: true`).
 */
export function nextDaily(
  now: Date,
  reminders: DailyReminder[] = DAILY_REMINDERS
): { reminder: DailyReminder; minutesAway: number; wrapped: boolean } | null {
  if (reminders.length === 0) return null;
  const sorted = [...reminders].sort(
    (a, b) => minutesOfDay(a.time) - minutesOfDay(b.time)
  );
  for (const r of sorted) {
    const away = minutesUntil(now, r.time);
    if (away >= 0) return { reminder: r, minutesAway: away, wrapped: false };
  }
  const first = sorted[0];
  const minutesAway = 24 * 60 - (now.getHours() * 60 + now.getMinutes()) + minutesOfDay(first.time);
  return { reminder: first, minutesAway, wrapped: true };
}
