import { create } from "zustand";
import type { Assessment, User } from "@/lib/schemas";
import type { CheckIn } from "@/lib/exercise-schemas";
import {
  getFirstUser,
  getLatestAssessmentForUser,
  getLatestCheckInForUser,
  seedExercisesIfEmpty,
} from "@/lib/db";

interface AppState {
  hydrated: boolean;
  user: User | null;
  latestAssessment: Assessment | null;
  latestCheckIn: CheckIn | null;
  hydrate: () => Promise<void>;
  setUser: (user: User) => void;
  setLatestAssessment: (assessment: Assessment) => void;
  setLatestCheckIn: (checkIn: CheckIn) => void;
}

export const useAppStore = create<AppState>((set) => ({
  hydrated: false,
  user: null,
  latestAssessment: null,
  latestCheckIn: null,

  hydrate: async () => {
    await seedExercisesIfEmpty();
    const user = (await getFirstUser()) ?? null;
    const [latestAssessment, latestCheckIn] = user
      ? await Promise.all([
          getLatestAssessmentForUser(user.id),
          getLatestCheckInForUser(user.id),
        ])
      : [undefined, undefined];
    set({
      user,
      latestAssessment: latestAssessment ?? null,
      latestCheckIn: latestCheckIn ?? null,
      hydrated: true,
    });
  },

  setUser: (user) => set({ user }),
  setLatestAssessment: (assessment) => set({ latestAssessment: assessment }),
  setLatestCheckIn: (checkIn) => set({ latestCheckIn: checkIn }),
}));
