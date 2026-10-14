import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { usePwaInstallPrompt } from "@/hooks/usePwaInstallPrompt";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.0dcf3d65ea88": {
    "en": "Add Adelante to home screen",
    "es": "Añadir Adelante a la pantalla de inicio"
  },
  "ui.e5f79aa13bd5": {
    "en": "Install app",
    "es": "Instalar aplicación"
  }
} as const;


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
  const { lang: screenLang } = useI18n();

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
      aria-label={SCREEN_COPY["ui.0dcf3d65ea88"][screenLang]}
    >
      <Download className="h-4 w-4 mr-1.5" />
      {SCREEN_COPY["ui.e5f79aa13bd5"][screenLang]} </Button>
  );
}
