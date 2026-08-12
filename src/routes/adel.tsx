import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, BookOpen, Waves } from "lucide-react";

/**
 * §Patient portal correction — Adel is a real nav slot and a real route.
 * The assistant itself (LLM backend) is an explicitly deferred decision, so
 * this page is an honest placeholder rather than a broken link.
 */
function AdelPlaceholder() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-10 sm:px-6">
      <Card className="soft-shadow space-y-4 p-6">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
          <MessageSquare className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="font-display text-2xl">Adel is on the way</h1>
        <p className="text-muted-foreground">
          Adel will be a place to ask questions in your own words and get pointed to the right
          support — day or night. It isn&apos;t switched on yet. Until it is, everything Adel would
          hand you is already here.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/library">
              <BookOpen className="mr-2 h-4 w-4" /> Browse the library
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/library" search={{ exercise: "urge-surfing-timer" }}>
              <Waves className="mr-2 h-4 w-4" /> Craving right now
            </Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          If you need someone now, call or text <span className="font-semibold">988</span>. A real
          person answers, any hour.
        </p>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/adel")({
  head: () => ({
    meta: [
      { title: "Adel — Adelante" },
      {
        name: "description",
        content: "Adel, your Adelante guide — coming soon. Meanwhile, find lessons, tools and crisis support.",
      },
      { property: "og:title", content: "Adel — Adelante" },
      { property: "og:description", content: "Your Adelante guide, coming soon." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdelPlaceholder,
});
