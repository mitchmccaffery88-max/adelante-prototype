import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { usePwaInstallPrompt } from "@/hooks/usePwaInstallPrompt";

interface InstallAppButtonProps {
  variant?: "default" | "ghost";
  size?: "default" | "sm" | "icon";
  className?: string;
  onInstalled?: () => void;
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
