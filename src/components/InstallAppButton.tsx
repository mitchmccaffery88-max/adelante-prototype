import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallAppButtonProps {
  variant?: "default" | "ghost";
  size?: "default" | "sm" | "icon";
  className?: string;
  onInstalled?: () => void;
}

export const DISMISS_KEY = "adelante.installNudge.dismissed";

/** Shared hook for the browser's `beforeinstallprompt` event. */
export function usePwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
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
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* no-op */
    }
  };

  return { prompt: deferredPrompt, dismissed, dismiss };
}

/**
 * PWA install button. Listens for the browser's `beforeinstallprompt` event
 * and renders an install button when the app can be added to the home screen.
 * Renders nothing on platforms that do not support the prompt (e.g. iOS Safari
 * or already installed).
 */
export function InstallAppButton({
  variant = "default",
  size = "sm",
  className,
  onInstalled,
}: InstallAppButtonProps) {
  const { prompt, dismiss } = usePwaInstallPrompt();

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    dismiss();
    onInstalled?.();
  };

  if (!prompt) return null;

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={install}
      aria-label="Add Adelante to home screen"
    >
      <Download className="h-4 w-4 mr-1.5" />
      Install app
    </Button>
  );
}
