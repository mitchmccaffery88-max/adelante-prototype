// §E10 — confirm step before a patient turns OFF a sharing consent.
// "Keep sharing" is the default; Part 2 disclosure needs a second tap/type.
// Spanish copy: pending bilingual review.
import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type WithdrawPurpose = "part2Sud" | "ecmShare" | "sms";

const COPY = {
  en: {
    title: "Turn off sharing?",
    keep: "Keep sharing",
    off: "Turn off",
    typeLabel: 'To confirm, type "STOP" or tap the box below.',
    tap: "Yes, I understand and want to stop sharing.",
    word: "STOP",
    what: {
      part2Sud:
        "Your Adelante care team will no longer see your substance use treatment information. Your counselors and doctors may have less to go on when they help you. This is a legal privacy choice.",
      ecmShare:
        "Housing, food and reentry partners will no longer get your information from us. They may not be able to help you as fast.",
      sms: "You will stop getting appointment and check-in reminders by text.",
    } as Record<WithdrawPurpose, string>,
  },
  es: {
    title: "¿Dejar de compartir?",
    keep: "Seguir compartiendo",
    off: "Desactivar",
    typeLabel: 'Para confirmar, escriba "ALTO" o toque la casilla.',
    tap: "Sí, entiendo y quiero dejar de compartir.",
    word: "ALTO",
    what: {
      part2Sud:
        "Su equipo de Adelante ya no verá su información de tratamiento por uso de sustancias. Sus consejeros y médicos tendrán menos información para ayudarle. Esta es una decisión legal de privacidad.",
      ecmShare:
        "Los socios de vivienda, comida y reintegración ya no recibirán su información de nosotros. Es posible que no puedan ayudarle tan rápido.",
      sms: "Ya no recibirá recordatorios de citas ni de chequeos por mensaje de texto.",
    } as Record<WithdrawPurpose, string>,
  },
};

export function ConsentWithdrawSheet({
  purpose,
  lang,
  onKeep,
  onConfirm,
}: {
  purpose: WithdrawPurpose | null;
  lang: "en" | "es";
  onKeep: () => void;
  onConfirm: (secondConfirm: boolean) => void;
}) {
  const c = COPY[lang] ?? COPY.en;
  const [typed, setTyped] = useState("");
  const [tapped, setTapped] = useState(false);
  const needsSecond = purpose === "part2Sud";
  const second = tapped || typed.trim().toUpperCase() === c.word;
  const close = () => {
    setTyped("");
    setTapped(false);
    onKeep();
  };
  return (
    <Sheet open={!!purpose} onOpenChange={(o) => !o && close()}>
      <SheetContent side="bottom" data-testid="consent-withdraw-sheet" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{c.title}</SheetTitle>
          <SheetDescription className="text-base text-foreground">{purpose ? c.what[purpose] : ""}</SheetDescription>
        </SheetHeader>
        {needsSecond && (
          <div className="mt-4 space-y-2 text-sm">
            <label className="block">
              {c.typeLabel}
              <Input aria-label={c.typeLabel} value={typed} onChange={(e) => setTyped(e.target.value)} className="mt-1" />
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={tapped} onChange={(e) => setTapped(e.target.checked)} />
              <span>{c.tap}</span>
            </label>
          </div>
        )}
        <SheetFooter className="mt-6 gap-2 sm:flex-row-reverse sm:justify-start">
          <Button autoFocus onClick={close} data-testid="consent-keep">
            {c.keep}
          </Button>
          <Button
            variant="outline"
            disabled={needsSecond && !second}
            data-testid="consent-turn-off"
            onClick={() => {
              onConfirm(needsSecond ? second : false);
              setTyped("");
              setTapped(false);
            }}
          >
            {c.off}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
