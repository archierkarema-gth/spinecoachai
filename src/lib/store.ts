import { create } from "zustand";
import type { Assessment, User } from "@/lib/schemas";
import type { CheckIn } from "@/lib/exercise-schemas";
import type { WorkoutLog } from "@/lib/log-schemas";
import {
  getFirstUser,
  getLatestAssessmentForUser,
  getLatestCheckInForUser,
  getWorkoutLogsForUser,
  seedExercisesIfEmpty,
} from "@/lib/db";

interface AppState {
  hydrated: boolean;
  user: User | null;
  latestAssessment: Assessment | null;
  latestCheckIn: CheckIn | null;
  workoutLogs: WorkoutLog[];
  hydrate: () => Promise<void>;
  refreshLogs: () => Promise<void>;
  setUser: (user: User) => void;
  setLatestAssessment: (assessment: Assessment) => void;
  setLatestCheckIn: (checkIn: CheckIn) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  hydrated: false,
  user: null,
  latestAssessment: null,
  latestCheckIn: null,
  workoutLogs: [],

  hydrate: async () => {
    await seedExercisesIfEmpty();
    const user = (await getFirstUser()) ?? null;
    const [latestAssessment, latestCheckIn, workoutLogs] = user
      ? await Promise.all([
          getLatestAssessmentForUser(user.id),
          getLatestCheckInForUser(user.id),
          getWorkoutLogsForUser(user.id),
        ])
      : [undefined, undefined, []];
    set({
      user,
      latestAssessment: latestAssessment ?? null,
      latestCheckIn: latestCheckIn ?? null,
      workoutLogs: workoutLogs ?? [],
      hydrated: true,
    });
  },

  refreshLogs: async () => {
    const { user } = get();
    if (!user) return;
    const workoutLogs = await getWorkoutLogsForUser(user.id);
    set({ workoutLogs });
  },

  setUser: (user) => set({ user }),
  setLatestAssessment: (assessment) => set({ latestAssessment: assessment }),
  setLatestCheckIn: (checkIn) => set({ latestCheckIn: checkIn }),
}));
