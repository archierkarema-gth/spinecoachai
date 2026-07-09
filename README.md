# SpineCoach AI

Adaptive bodyweight performance coach for adults with scoliosis. Offline-first
Next.js app; all data lives on-device in IndexedDB, with optional Supabase
cloud sync.

Built from the spec in [`docs/`](docs/) — those files are the source of truth.
The AI Decision Engine is rule-based and safety-first: it never diagnoses and
escalates red-flag symptoms to medical review (see
[`docs/04_Clinical_Guardrails.md`](docs/04_Clinical_Guardrails.md)).

## Stack

Next.js (App Router) · TypeScript · Tailwind v4 · Zustand · Zod · IndexedDB
(`idb`) · Supabase (optional) · Vitest.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # vitest
npm run build    # production build
```

## Feature flow

Initial Assessment → Daily Check-in → AI Decision Engine → Today's Workout →
finish session → Progress (streak, pain trend). Plus Exercise Library, Pain
Tracker, Progress Photos, Reports, and Settings.

## Cloud sync (optional)

The app runs fully offline by default. To enable multi-device sync:

1. Create a Supabase project.
2. Run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   in the SQL editor (creates per-user tables with row-level security).
3. Copy `.env.local.example` to `.env.local` and fill in
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Settings → Cloud sync → **Sinkronkan sekarang**.

Sync is an id-keyed upsert in both directions; the local copy always wins on a
shared id. Progress photos stay on-device (not synced in v1).

## Data & privacy

Health data (assessments, pain logs, posture photos) is stored locally. Reset
from Settings wipes every user record permanently.
