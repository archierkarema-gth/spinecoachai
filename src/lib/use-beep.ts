"use client";

/**
 * Offline countdown audio for the session player. Tones are synthesized with a
 * Web Audio oscillator — no asset files, works fully offline. The AudioContext
 * is created lazily on first playback (which happens after a user gesture, so
 * autoplay policy never blocks it). Mute state persists in localStorage.
 */

const MUTE_KEY = "spinecoach_beep_muted";

export type BeepCue = "tick" | "final";

/** Which cue to play for a given remaining-seconds value (pure, testable). */
export function beepForSecond(remaining: number): BeepCue | null {
  if (remaining === 0) return "final";
  if (remaining >= 1 && remaining <= 5) return "tick";
  return null;
}

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function isBeepMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTE_KEY) === "1";
}

export function setBeepMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

/** Play a short cue. No-op when muted or Web Audio is unavailable. */
export function playCue(cue: BeepCue): void {
  if (isBeepMuted()) return;
  const audio = getCtx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  const now = audio.currentTime;
  const freq = cue === "final" ? 1320 : 880;
  const dur = cue === "final" ? 0.25 : 0.08;
  osc.frequency.value = freq;
  osc.type = "sine";
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
  osc.connect(gain).connect(audio.destination);
  osc.start(now);
  osc.stop(now + dur);
}
