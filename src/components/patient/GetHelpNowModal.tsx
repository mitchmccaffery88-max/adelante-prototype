// §Patient portal Build 2 — the "Get help now" modal.
//
// Bottom sheet on mobile, centred dialog on desktop, matching the source
// shell. Six entries, ported one-for-one. Where this build has the real thing
// the entry is a working link; where it does NOT, the entry says so plainly
// instead of shipping a fake destination. Every honest gap is marked with a
// visible "Not built yet" chip AND `data-gap` so the verification pass can
// assert we did not quietly fabricate a surface.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  HandHeart,
  MessageSquare,
  Phone,
  ShieldPlus,
  Undo2,
  LifeBuoy,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { CRISIS_LIFELINE_NUMBER, CRISIS_LIFELINE_NAME } from "@/lib/safetyPlan";

type HelpDestination =
  | { kind: "tel"; number: string }
  | { kind: "route"; to: string; hash?: string; search?: Record<string, string> }
  | { kind: "none" };

interface HelpEntry {
  id: string;
  icon: LucideIcon;
  title: string;
  body: string;
  destination: HelpDestination;
  /** Set when this build cannot deliver what the source promised. */
  gap?: string;
  emphasis?: "crisis";
}

/**
 * `HELP_ENTRIES` is a function of nothing — it is static copy plus real
 * destinations, so it is exported for the tests to assert the gap labelling
 * without rendering.
 */
export const HELP_ENTRIES: HelpEntry[] = [
  {
    id: "peer-specialist",
    icon: HandHeart,
    title: "Talk to a peer specialist",
    body: "Someone who has been through this. Your care-team thread reaches them.",
    destination: { kind: "route", to: "/home", hash: "care-messages" },
    // Real messaging exists, but it is ONE patient↔staff thread. There is no
    // modelled peer-specialist participant and no per-patient peer assignment,
    // so we cannot honestly promise you are reaching a peer specifically.
    gap: "Goes to your care team — a peer-specific channel isn't built yet",
  },
  {
    id: "case-manager-adel",
    icon: MessageSquare,
    title: "Message your case manager through Adel",
    body: "Adel will pass a message to your case manager for you.",
    destination: { kind: "route", to: "/adel" },
    gap: "Adel isn't built yet — use your care-team thread meanwhile",
  },
  {
    id: "call-988",
    icon: Phone,
    title: `Call ${CRISIS_LIFELINE_NUMBER}`,
    body: `${CRISIS_LIFELINE_NAME}. Free, 24/7, Spanish-capable.`,
    destination: { kind: "tel", number: CRISIS_LIFELINE_NUMBER },
  },
  {
    id: "naloxone",
    icon: ShieldPlus,
    title: "Naloxone & overdose prevention",
    body: "How to get naloxone, how to use it, and what to do while you wait for help.",
    // §Tier 1 Build A — the real page now exists (transcribed SAMHSA / CDC /
    // DHCS content, still flagged pending clinical review on the page itself).
    destination: { kind: "route", to: "/naloxone" },
  },
  {
    id: "slip-support",
    icon: Undo2,
    title: "I used — help me come back",
    body: "No lecture. Just the next hour, one step at a time.",
    // Closest REAL thing we have: the "If I Slip" plan exercise from the
    // Phase 5 library. It is a plan you write, not a come-back-now flow.
    destination: { kind: "route", to: "/library", search: { exercise: "if-i-slip-plan" } },
    gap: 'Opens the "If I Slip" plan — the full come-back flow isn\'t built yet',
  },
  {
    id: "crisis-support",
    icon: LifeBuoy,
    title: "Crisis support",
    body: "Your safety plan, your people, and the lifeline — all in one place.",
    destination: { kind: "route", to: "/crisis" },
    emphasis: "crisis",
  },
];

function EntryShell({
  entry,
  children,
}: {
  entry: HelpEntry;
  children: ReactNode;
}) {
  const Icon = entry.icon;
  return (
    <>
      <span
        className={
          entry.emphasis === "crisis"
            ? "mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-crisis/15 text-crisis"
            : "mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-primary"
        }
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">{entry.title}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{entry.body}</span>
        {children}
      </span>
    </>
  );
}

function GapChip({ note }: { note: string }) {
  return (
    <span className="mt-1.5 inline-block rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      Not built yet · {note}
    </span>
  );
}

function HelpList({ onNavigate }: { onNavigate: () => void }) {
  const rowClass = (entry: HelpEntry) =>
    [
      "flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors",
      entry.emphasis === "crisis"
        ? "border-crisis/30 bg-crisis-soft hover:bg-crisis/10"
        : "border-border bg-card hover:bg-secondary",
    ].join(" ");

  return (
    <div className="grid gap-2" data-testid="get-help-entries">
      {HELP_ENTRIES.map((entry) => {
        const inner = (
          <EntryShell entry={entry}>
            {entry.gap ? <GapChip note={entry.gap} /> : null}
          </EntryShell>
        );

        if (entry.destination.kind === "tel") {
          return (
            <a
              key={entry.id}
              data-testid={`get-help-${entry.id}`}
              href={`tel:${entry.destination.number}`}
              onClick={onNavigate}
              className={rowClass(entry)}
            >
              {inner}
            </a>
          );
        }

        if (entry.destination.kind === "route") {
          const { to, hash, search } = entry.destination;
          return (
            <Link
              key={entry.id}
              data-testid={`get-help-${entry.id}`}
              data-gap={entry.gap ? "true" : undefined}
              to={to}
              hash={hash}
              search={search}
              onClick={onNavigate}
              className={rowClass(entry)}
            >
              {inner}
            </Link>
          );
        }

        // No destination at all — render it as inert, not as a broken link.
        return (
          <div
            key={entry.id}
            data-testid={`get-help-${entry.id}`}
            data-gap="true"
            className={`${rowClass(entry)} cursor-default opacity-90`}
          >
            {inner}
          </div>
        );
      })}
    </div>
  );
}

const TITLE = "Get help now";
const SUBTITLE = "Pick whatever fits. Nothing here is logged as a crisis unless you say so.";

export function GetHelpNowModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const close = () => onOpenChange(false);

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          data-testid="get-help-sheet"
          className="patient-theme rounded-t-3xl border-t bg-card px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-3 [&>button:first-of-type]:hidden"
        >
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border" aria-hidden="true" />
          <div className="flex items-center justify-between">
            <SheetTitle className="font-display text-lg">{TITLE}</SheetTitle>
            <button
              type="button"
              aria-label="Close"
              onClick={close}
              className="grid h-11 w-11 place-items-center rounded-full hover:bg-secondary"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{SUBTITLE}</p>
          <div className="mt-3 max-h-[60vh] overflow-y-auto pb-2">
            <HelpList onNavigate={close} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="get-help-dialog"
        className="patient-theme max-w-lg rounded-3xl"
      >
        <DialogTitle className="font-display text-xl">{TITLE}</DialogTitle>
        <DialogDescription>{SUBTITLE}</DialogDescription>
        <div className="mt-1 max-h-[70vh] overflow-y-auto pr-1">
          <HelpList onNavigate={close} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
