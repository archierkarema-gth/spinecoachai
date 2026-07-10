import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cloud sync config (docs/09 future layer).
 *
 * The URL and anon key are public by design (the anon key ships to every
 * browser). Data is NOT isolated by auth — instead each user picks a
 * high-entropy "sync code" that acts as a bearer token: rows are stored under
 * that code and only someone who knows it can read them back. Suitable for a
 * personal single-user app; not a substitute for real auth on shared data.
 */
const SUPABASE_URL = "https://btcjjmgbariyoyshzbzl.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0Y2pqbWdiYXJpeW95c2h6YnpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyODQ2NTEsImV4cCI6MjA5Nzg2MDY1MX0.dfcZqWOlqT6MY1t0W4jctcgRQlYId1agR0srwP99TsU";

const SYNC_CODE_KEY = "spinecoach_sync_code";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

/** The device's sync code, or null if the user hasn't set one yet. */
export function getSyncCode(): string | null {
  if (typeof window === "undefined") return null;
  const code = window.localStorage.getItem(SYNC_CODE_KEY);
  return code && code.trim() ? code.trim() : null;
}

export function setSyncCode(code: string): void {
  if (typeof window === "undefined") return;
  const trimmed = code.trim();
  if (trimmed) window.localStorage.setItem(SYNC_CODE_KEY, trimmed);
  else window.localStorage.removeItem(SYNC_CODE_KEY);
}

/** Generate a random, hard-to-guess sync code (bearer token). */
export function generateSyncCode(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cloud sync is usable once the user has set a sync code. */
export function isCloudConfigured(): boolean {
  return getSyncCode() !== null;
}
