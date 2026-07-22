import { create } from "zustand";
import type { Assessment, User } from "@/lib/schemas";
import type { CheckIn } from "@/lib/exercise-schemas";
import type {
  AsymmetryLog,
  BenchmarkLog,
  ReassessmentLog,
  SessionLog,
  WorkoutLog,
} from "@/lib/log-schemas";
import {
  getAsymmetryLogsForUser,
  getBenchmarkLogsForUser,
  getFirstUser,
  getLatestAssessmentForUser,
  getLatestCheckInForUser,
  getLatestReassessmentForUser,
  getSessionLogsForUser,
  getWorkoutLogsForUser,
  seedPersonalDataIfEmpty,
  syncSeedExercises,
} from "@/lib/db";

interface AppState {
  hydrated: boolean;
  user: User | null;
  latestAssessment: Assessment | null;
  latestCheckIn: CheckIn | null;
  workoutLogs: WorkoutLog[];
  benchmarkLogs: BenchmarkLog[];
  latestReassessment: ReassessmentLog | null;
  sessionLogs: SessionLog[];
  asymmetryLogs: AsymmetryLog[];
  hydrate: () => Promise<void>;
  refreshLogs: () => Promise<void>;
  refreshBenchmarks: () => Promise<void>;
  refreshReassessment: () => Promise<void>;
  refreshM16Logs: () => Promise<void>;
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
  benchmarkLogs: [],
  latestReassessment: null,
  sessionLogs: [],
  asymmetryLogs: [],

  hydrate: async () => {
    await syncSeedExercises();
    await seedPersonalDataIfEmpty();
    const user = (await getFirstUser()) ?? null;
    const [
      latestAssessment,
      latestCheckIn,
      workoutLogs,
      benchmarkLogs,
      latestReassessment,
      sessionLogs,
      asymmetryLogs,
    ] = user
      ? await Promise.all([
          getLatestAssessmentForUser(user.id),
          getLatestCheckInForUser(user.id),
          getWorkoutLogsForUser(user.id),
          getBenchmarkLogsForUser(user.id),
          getLatestReassessmentForUser(user.id),
          getSessionLogsForUser(user.id),
          getAsymmetryLogsForUser(user.id),
        ])
      : [undefined, undefined, [], [], undefined, [], []];
    set({
      user,
      latestAssessment: latestAssessment ?? null,
      latestCheckIn: latestCheckIn ?? null,
      workoutLogs: workoutLogs ?? [],
      benchmarkLogs: benchmarkLogs ?? [],
      latestReassessment: latestReassessment ?? null,
      sessionLogs: (sessionLogs as SessionLog[]) ?? [],
      asymmetryLogs: (asymmetryLogs as AsymmetryLog[]) ?? [],
      hydrated: true,
    });
  },

  refreshLogs: async () => {
    const { user } = get();
    if (!user) return;
    const workoutLogs = await getWorkoutLogsForUser(user.id);
    set({ workoutLogs });
  },

  refreshBenchmarks: async () => {
    const { user } = get();
    if (!user) return;
    const benchmarkLogs = await getBenchmarkLogsForUser(user.id);
    set({ benchmarkLogs });
  },

  refreshReassessment: async () => {
    const { user } = get();
    if (!user) return;
    const latestReassessment = (await getLatestReassessmentForUser(user.id)) ?? null;
    set({ latestReassessment });
  },

  refreshM16Logs: async () => {
    const { user } = get();
    if (!user) return;
    const [sessionLogs, asymmetryLogs] = await Promise.all([
      getSessionLogsForUser(user.id),
      getAsymmetryLogsForUser(user.id),
    ]);
    set({ sessionLogs, asymmetryLogs });
  },

  setUser: (user) => set({ user }),
  setLatestAssessment: (assessment) => set({ latestAssessment: assessment }),
  setLatestCheckIn: (checkIn) => set({ latestCheckIn: checkIn }),
}));
