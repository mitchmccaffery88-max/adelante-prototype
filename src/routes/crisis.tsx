import { createFileRoute, Link } from "@tanstack/react-router";
import { LifeBuoy, MessageSquare, Phone, ShieldPlus, Wind } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PatientPage, PatientPageHeader } from "@/components/patient/PatientPage";
import { CRISIS_LIFELINE_NAME, CRISIS_LIFELINE_NUMBER } from "@/lib/safetyPlan";

/**
 * §Patient portal Tier 1 Build A — the real crisis landing page.
 *
 * This is now the single destination for every "Crisis support" entry point
 * in the patient shell (header pill, sidebar block, More sheet, Get help now).
 * 988 is the only crisis number this app shows; the two link cards go to the
 * real Phase 5 box-breathing exercise and the real Phase 7 safety plan.
 */
function CrisisPage() {
  return (
    <PatientPage data-testid="crisis-page">
      <PatientPageHeader
        icon={LifeBuoy}
        tone="crisis"
        title="You are not alone"
        lede="Let's get you some help right now."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Button asChild variant="crisis" size="patientLg" className="soft-shadow w-full">
          <a href={`tel:${CRISIS_LIFELINE_NUMBER}`} data-testid="crisis-call-988">
            <Phone className="h-5 w-5" aria-hidden="true" />
            Call {CRISIS_LIFELINE_NUMBER}
          </a>
        </Button>
        <Button asChild variant="crisisSoft" size="patientLg" className="w-full">
          <a href={`sms:${CRISIS_LIFELINE_NUMBER}`} data-testid="crisis-text-988">
            <MessageSquare className="h-5 w-5" aria-hidden="true" />
            Text {CRISIS_LIFELINE_NUMBER}
          </a>
        </Button>
      </div>

      <Card className="soft-shadow divide-y p-0">
        <Link
          to="/library"
          search={{ exercise: "box-breathing" }}
          data-testid="crisis-breathing-link"
          className="flex min-h-16 items-center gap-3 p-4 hover:bg-secondary"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
            <Wind className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-base font-semibold">Try a breathing exercise</span>
            <span className="block text-sm text-muted-foreground">
              Box breathing — four counts in, four hold, four out.
            </span>
          </span>
        </Link>
        <Link
          to="/safety-plan"
          data-testid="crisis-safety-plan-link"
          className="flex min-h-16 items-center gap-3 p-4 hover:bg-secondary"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
            <LifeBuoy className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-base font-semibold">Open my safety plan</span>
            <span className="block text-sm text-muted-foreground">
              Your warning signs, your people, your reasons — in your own words.
            </span>
          </span>
        </Link>
        <Link
          to="/naloxone"
          data-testid="crisis-naloxone-link"
          className="flex min-h-16 items-center gap-3 p-4 hover:bg-secondary"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
            <ShieldPlus className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-base font-semibold">Naloxone & overdose prevention</span>
            <span className="block text-sm text-muted-foreground">
              How to get it, how to use it, and what to do while you wait for help.
            </span>
          </span>
        </Link>
      </Card>

      <p className="px-1 text-sm leading-relaxed text-muted-foreground" data-testid="crisis-footnote">
        {CRISIS_LIFELINE_NUMBER} is the U.S. Suicide &amp; Crisis Lifeline. This is the only crisis
        number this app will show unless a local line has been verified.
      </p>
    </PatientPage>
  );
}

export const Route = createFileRoute("/crisis")({
  head: () => ({
    meta: [
      { title: "Crisis support — Adelante" },
      {
        name: "description",
        content: `Immediate help right now: call or text ${CRISIS_LIFELINE_NAME}, try a breathing exercise, or open your safety plan.`,
      },
      { property: "og:title", content: "Crisis support — Adelante" },
      {
        property: "og:description",
        content: "You are not alone. Call or text 988, breathe, or open your safety plan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CrisisPage,
});
