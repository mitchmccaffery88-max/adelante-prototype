import { Link } from "@tanstack/react-router";
import { LifeBuoy, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n";
import { PATIENT_MORE_NAV } from "@/lib/navSections";

/**
 * §Patient portal correction — the real "More" bottom sheet: rounded top,
 * drag handle, close button, every non-tab nav item plus crisis support.
 */
export function PatientMoreSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        data-testid="patient-more-sheet"
        className="patient-theme rounded-t-3xl border-t bg-card px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-3 [&>button:first-of-type]:hidden"
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border" aria-hidden="true" />
        <div className="flex items-center justify-between">
          <SheetTitle className="font-display text-lg">{t("navMore")}</SheetTitle>
          <button
            type="button"
            aria-label="Close"
            data-testid="patient-more-close"
            onClick={() => onOpenChange(false)}
            className="grid h-11 w-11 place-items-center rounded-full hover:bg-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-3 grid max-h-[60vh] gap-1 overflow-y-auto">
          {PATIENT_MORE_NAV.map((n) => {
            const Icon = n.icon;
            return (
              <Link
                key={n.id}
                to={n.to}
                hash={n.hash}
                onClick={() => onOpenChange(false)}
                className="flex min-h-12 items-center gap-3 rounded-2xl px-3 py-3 text-base font-medium text-foreground/85 hover:bg-secondary"
              >
                <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                {t(n.labelKey as Parameters<typeof t>[0])}
              </Link>
            );
          })}

          <a
            href="tel:988"
            onClick={() => onOpenChange(false)}
            className="mt-2 flex min-h-12 items-center gap-3 rounded-2xl border border-crisis/30 bg-crisis-soft px-3 py-3 text-base font-semibold text-crisis"
          >
            <LifeBuoy className="h-5 w-5 shrink-0" aria-hidden="true" />
            {t("navCrisisSupport")} · 988
          </a>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
