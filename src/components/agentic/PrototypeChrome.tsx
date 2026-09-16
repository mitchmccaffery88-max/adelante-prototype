// §Agentic Roadmap prototype — shared honesty chrome.
//
// These three screens are a WALKTHROUGH PROTOTYPE, not a feature. Nothing here
// calls a model, records audio, transcribes, or writes to the chart. The
// labelling below reuses the honesty-label language already used elsewhere in
// the app (amber "pending" banners, draft-classification chips) so a reviewer
// cannot mistake any of it for a working capability.
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, Mic, ShieldCheck, Sparkles, Info } from "lucide-react";

/**
 * The one non-missable label. Sticky under the app header so it stays on
 * screen at every scroll position and on both viewports.
 */
export function PrototypeBanner({ detail }: { detail: string }) {
  return (
    <div
      role="note"
      data-testid="agentic-prototype-banner"
      className="sticky top-[60px] z-30 -mx-4 mb-4 border-y border-amber-500/50 bg-amber-500/15 px-4 py-2.5 backdrop-blur sm:mx-0 sm:rounded-lg sm:border"
    >
      <div className="flex items-start gap-2">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
        <div className="min-w-0 text-[13px] leading-snug text-amber-900 dark:text-amber-100">
          <span className="font-semibold">
            Prototype — not connected to a live AI model.
          </span>{" "}
          <span className="opacity-90">{detail}</span>
        </div>
      </div>
    </div>
  );
}

/** Marks a panel whose content is illustrative rather than produced by the app. */
export function SampleBadge({ label = "Sample content" }: { label?: string }) {
  return (
    <Badge
      variant="outline"
      data-testid="agentic-sample-badge"
      className="border-amber-warm text-[10px] text-amber-warm-foreground"
    >
      <Sparkles className="mr-1 h-3 w-3" aria-hidden /> {label}
    </Badge>
  );
}

/** Marks a panel that is reading the patient's real record in this demo. */
export function RealDataBadge({ label = "From this chart" }: { label?: string }) {
  return (
    <Badge variant="outline" className="text-[10px] text-muted-foreground">
      <Info className="mr-1 h-3 w-3" aria-hidden /> {label}
    </Badge>
  );
}

/**
 * §Scribe Copilot ONLY. A live-encounter scribe cannot start without recording
 * consent on file; this banner exists so the architecture shows that
 * precondition even though the prototype captures nothing. Smart Dictation
 * deliberately does NOT render it — see its own post-encounter notice.
 */
export function RecordingConsentBanner({ patientName }: { patientName: string }) {
  return (
    <div
      role="note"
      data-testid="scribe-consent-banner"
      className="mb-4 rounded-lg border border-teal/40 bg-teal/10 p-3"
    >
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden />
        <div className="text-sm text-navy">
          <p className="font-semibold">
            Recording consent confirmed for this encounter — {patientName}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Precondition shown for the walkthrough. Live ambient capture may not start
            without verbal consent captured in the record and the patient's right to stop
            recording at any point. This prototype does not capture, store, or transmit
            audio, and no consent was recorded here.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * §Smart Dictation ONLY. The deliberate counterpart to the consent banner: this
 * screen is a clinician talking to their own chart AFTER the visit, so there is
 * no patient recording and no live-visit consent burden.
 */
export function PostEncounterNotice() {
  return (
    <div
      role="note"
      data-testid="dictation-post-encounter-notice"
      className="mb-4 rounded-lg border border-border bg-muted/50 p-3"
    >
      <div className="flex items-start gap-2">
        <Mic className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="text-sm text-foreground">
          <p className="font-semibold">Post-encounter dictation — the visit has ended</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            The clinician is dictating their own summary after the patient has left. No
            patient is present, nothing is recorded during a visit, and no recording
            consent is involved — this is the lower-burden sibling of the live scribe.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Consistent panel frame for the parallel-panel layouts. */
export function PrototypePanel({
  title,
  icon: Icon,
  badge,
  tone = "default",
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: ReactNode;
  tone?: "default" | "alert";
  children: ReactNode;
}) {
  return (
    <section
      className={
        "rounded-xl border p-4 " +
        (tone === "alert" ? "border-destructive/40 bg-destructive/5" : "border-border bg-card")
      }
      aria-label={title}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-sm text-navy">
          <Icon
            className={"h-4 w-4 " + (tone === "alert" ? "text-destructive" : "text-teal")}
          />
          {title}
        </h3>
        {badge}
      </div>
      {children}
    </section>
  );
}
