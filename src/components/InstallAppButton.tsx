import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "adelante.installNudge.dismissed";

/**
 * Dismissible PWA install nudge. Listens for the browser's
 * `beforeinstallprompt` event and offers a lightweight card prompting
 * the user to add Adelante to their home screen. If the browser never
 * fires the event (e.g. iOS Safari, already installed), the component
 * renders nothing.
 */
export function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      /* no-op */
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

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  };

  if (dismissed || !deferredPrompt) return null;

  return (
    <Card className="p-4 border-teal/40 bg-teal/5 flex items-start gap-3">
      <Download className="h-5 w-5 text-teal mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 text-sm">
        <div className="font-medium text-navy">Add Adelante to your home screen</div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Get faster access to your care plan and appointments.
        </p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="min-h-11 bg-teal text-teal-foreground hover:bg-teal/90" onClick={install}>
            Install app
          </Button>
          <Button size="sm" variant="ghost" className="min-h-11" onClick={dismiss}>
            Not now
          </Button>
        </div>
      </div>
      <button
        type="button"
        aria-label="Dismiss install prompt"
        onClick={dismiss}
        className="shrink-0 min-h-11 min-w-11 flex items-center justify-center text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </Card>
  );
}
