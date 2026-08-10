import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, Search } from "lucide-react";

export const Route = createFileRoute("/start/reconnect")({
  head: () => ({
    meta: [
      { title: "Finding your record — Adelante" },
      {
        name: "description",
        content: "We'll help you get back into your existing Adelante care plan and care team.",
      },
      { property: "og:title", content: "Finding your record — Adelante" },
      {
        property: "og:description",
        content: "Reconnect with your existing Adelante care plan and case manager.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReconnectPlaceholder,
});

/**
 * PLACEHOLDER (Phase 1). Patient-reconnection matching is not built — this
 * screen deliberately contains no lookup logic. It exists so Q1 = "yes" has a
 * real, non-dead-end destination: a human contact path plus a way back into
 * the flow if the person would rather just start.
 */
function ReconnectPlaceholder() {
  return (
    <Card className="space-y-5 p-6">
      <div>
        <Badge variant="outline" className="border-gold/50 text-navy">
          Coming soon
        </Badge>
        <h1 className="font-display mt-2 flex items-center gap-2 text-2xl text-navy">
          <Search className="h-5 w-5 text-teal" /> We'll help you find your record
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You told us you already have a care plan or case manager with us. Automatic record lookup
          isn't switched on yet, so a person does this part.
        </p>
      </div>

      <div className="rounded-lg border bg-secondary/40 p-4 text-sm">
        <div className="flex items-start gap-3">
          <Phone className="mt-0.5 h-5 w-5 shrink-0 text-navy" />
          <div>
            <div className="font-medium text-navy">Call or text your care team</div>
            <p className="mt-1 text-muted-foreground">
              Give them your name and date of birth and they'll pull up your plan. If you don't have
              your case manager's number, call the main Adelante line and say you're trying to
              reconnect.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Would rather not wait? You can start fresh — we'll merge it with your existing record when
          we find it.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/start/helping">Keep going anyway</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/start">Back to the first question</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
