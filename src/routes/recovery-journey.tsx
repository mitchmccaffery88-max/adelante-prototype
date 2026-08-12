import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Target, BookOpen } from "lucide-react";

/**
 * §Patient portal correction — "Recovery Journey" is one of the five real
 * mobile tabs in the source shell. The milestone/progress surface behind it is
 * part of the next (dashboard) build, so the route is reserved and points at
 * the real care-plan and library surfaces that exist today.
 */
function RecoveryJourney() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-10 sm:px-6">
      <Card className="soft-shadow space-y-4 p-6">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sage-soft text-sage">
          <Sparkles className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="font-display text-2xl">Your recovery journey</h1>
        <p className="text-muted-foreground">
          Your milestones, streaks and progress will live here. That view is being built next. For
          now, your goals and steps are on your care plan, and everything you&apos;ve finished is
          saved in your library.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/home" hash="your-care-plan-heading">
              <Target className="mr-2 h-4 w-4" /> My care plan
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/library">
              <BookOpen className="mr-2 h-4 w-4" /> My library
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/recovery-journey")({
  head: () => ({
    meta: [
      { title: "Recovery journey — Adelante" },
      {
        name: "description",
        content: "Track your recovery milestones, goals and finished lessons in one place.",
      },
      { property: "og:title", content: "Recovery journey — Adelante" },
      { property: "og:description", content: "Your milestones, goals and progress at Adelante." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecoveryJourney,
});
