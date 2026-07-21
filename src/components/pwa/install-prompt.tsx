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
