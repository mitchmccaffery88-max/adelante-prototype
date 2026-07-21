import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const INSTALL_DISMISS_KEY = "adelante.installNudge.dismissed";

/** Shared hook for the browser's `beforeinstallprompt` event. */
export function usePwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(INSTALL_DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(INSTALL_DISMISS_KEY, "1");
    } catch {
      /* no-op */
    }
  };

  return { prompt: deferredPrompt, dismissed, dismiss };
}
