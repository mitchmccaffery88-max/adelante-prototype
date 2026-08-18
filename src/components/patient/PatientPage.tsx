import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * §Patient portal UI/UX alignment — the shared page shell.
 *
 * Every patient-facing surface (crisis, naloxone, craving, slip, library,
 * recovery journey, resources, Adel, weekly recap) previously hand-rolled its
 * own `mx-auto max-w-* space-y-* px-4 py-8 sm:px-6` wrapper, and the widths had
 * drifted across five different values — one surface (weekly recap) had no
 * wrapper at all and rendered flush against the sidebar.
 *
 * `width` is an intent, not a number:
 *   reading — one column of prose or a guided step flow (default)
 *   browse  — a catalogue / list the patient scans rather than reads
 * Both stay inside the same horizontal rhythm and vertical padding.
 */
export type PatientPageWidth = "reading" | "browse";

const WIDTH: Record<PatientPageWidth, string> = {
  reading: "max-w-2xl",
  browse: "max-w-4xl",
};

export function PatientPage({
  children,
  width = "reading",
  className,
  ...rest
}: {
  children: React.ReactNode;
  width?: PatientPageWidth;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "className">) {
  return (
    <div
      className={cn("mx-auto space-y-4 px-4 py-8 sm:px-6", WIDTH[width], className)}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * The shared page header: optional icon tile, one h1 at the single patient
 * display scale, and an optional lede. Before this existed, patient h1s came
 * in three sizes (`text-3xl`, `text-2xl`, and an unstyled one) and only half
 * the surfaces carried the icon tile.
 */
export function PatientPageHeader({
  icon: Icon,
  tone = "calm",
  eyebrow,
  title,
  lede,
  action,
  children,
}: {
  icon?: LucideIcon;
  /** `crisis` swaps the tile to the crisis token pair; content decides, not the page. */
  tone?: "calm" | "crisis";
  /** Optional small uppercase kicker above the h1. Omitted → nothing renders. */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  lede?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          {Icon && (
            <span
              className={cn(
                "grid h-12 w-12 place-items-center rounded-2xl",
                tone === "crisis" ? "bg-crisis-soft text-crisis" : "bg-secondary text-primary",
              )}
            >
              <Icon className="h-6 w-6" aria-hidden="true" />
            </span>
          )}
          {eyebrow && (
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-3xl text-foreground">{title}</h1>
        </div>
        {action}
      </div>
      {lede && <p className="text-lg text-muted-foreground">{lede}</p>}
      {children}
    </header>
  );
}
