"use client";

import { useEffect } from "react";

/**
 * Registers /public/sw.js so the app shell keeps working offline once each
 * route has been opened once. No UI — mounted once from the root layout.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline install is a nice-to-have; silently skip if unsupported
      // (e.g. non-HTTPS dev preview) rather than surfacing a console error.
    });
  }, []);

  return null;
}
