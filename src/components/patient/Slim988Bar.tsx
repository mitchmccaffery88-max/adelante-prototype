import { MessageSquare, Phone } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * One-tap 988 call / text, for intake and re-screen headers. Replaces the
 * staff-only "Flag crisis now" button there; the PHQ-9 item 9 flag and Adel's
 * crisis interception are separate and unchanged.
 */
export function Slim988Bar({ className = "" }: { className?: string }) {
  const { lang } = useI18n();
  const es = lang === "es";
  return (
    <div
      data-testid="slim-988-bar"
      className={`flex flex-wrap items-center gap-2 rounded-full border border-crisis/30 bg-crisis-soft px-3 py-1.5 text-sm text-crisis ${className}`}
    >
      <span className="font-medium">{es ? "¿Necesita ayuda ahora?" : "Need help now?"}</span>
      <a href="tel:988" data-testid="slim-988-call" className="inline-flex min-h-9 items-center gap-1 rounded-full px-2 font-semibold underline">
        <Phone className="h-4 w-4" aria-hidden="true" /> {es ? "Llamar al 988" : "Call 988"}
      </a>
      <a href="sms:988" data-testid="slim-988-text" className="inline-flex min-h-9 items-center gap-1 rounded-full px-2 font-semibold underline">
        <MessageSquare className="h-4 w-4" aria-hidden="true" /> {es ? "Texto al 988" : "Text 988"}
      </a>
    </div>
  );
}
