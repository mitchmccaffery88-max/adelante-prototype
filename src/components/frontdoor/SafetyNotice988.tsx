// 26 Oct evening (Mitch) — shown after a sign-up or public referral answer
// matched the existing crisis patterns. Never blocks the flow. Spanish is a
// draft pending translation review (the shell owns the notice).
import { LifeBuoy } from "lucide-react";

export const SAFETY_988_COPY = {
  en: { title: "You don't have to wait", body: "If you or the person you're helping might be in danger, call or text 988 now. Our clinical team will also review this today.", call: "Call 988", text: "Text 988" },
  es: { title: "No tienes que esperar", body: "Si tú o la persona a quien ayudas podrían estar en peligro, llama o envía un mensaje al 988 ahora. Nuestro equipo clínico también revisará esto hoy.", call: "Llamar al 988", text: "Mensaje al 988" },
} as const;

export function SafetyNotice988({ lang }: { lang: "en" | "es" }) {
  const c = SAFETY_988_COPY[lang];
  return (
    <section role="status" aria-live="polite" data-testid="safety-988" className="rounded-md border-2 border-urgent bg-surface p-4 space-y-3 text-left">
      <h2 className="flex items-center gap-2 text-lg font-bold text-ink"><LifeBuoy className="h-5 w-5 text-urgent" aria-hidden />{c.title}</h2>
      <p className="text-ink">{c.body}</p>
      <div className="flex flex-wrap gap-3">
        <a href="tel:988" className="inline-flex min-h-12 items-center rounded-md bg-urgent px-4 font-bold text-primary-foreground">{c.call}</a>
        <a href="sms:988" className="inline-flex min-h-12 items-center rounded-md border border-line-strong px-4 font-bold text-ink">{c.text}</a>
      </div>
    </section>
  );
}
