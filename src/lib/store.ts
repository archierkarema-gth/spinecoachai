import { create } from "zustand";
import type { Assessment, User } from "@/lib/schemas";
import { getFirstUser, getLatestAssessmentForUser } from "@/lib/db";

interface AppState {
  hydrated: boolean;
  user: User | null;
  latestAssessment: Assessment | null;
  hydrate: () => Promise<void>;
  setUser: (user: User) => void;
  setLatestAssessment: (assessment: Assessment) => void;
}

export const useAppStore = create<AppState>((set) => ({
  hydrated: false,
  user: null,
  latestAssessment: null,

  hydrate: async () => {
    const user = (await getFirstUser()) ?? null;
    const latestAssessment = user
      ? ((await getLatestAssessmentForUser(user.id)) ?? null)
      : null;
    set({ user, latestAssessment, hydrated: true });
  },

  setUser: (user) => set({ user }),
  setLatestAssessment: (assessment) => set({ latestAssessment: assessment }),
}));
