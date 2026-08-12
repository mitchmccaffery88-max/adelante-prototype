import { createFileRoute } from "@tanstack/react-router";
import { LibraryBrowser } from "@/components/library/LibraryBrowser";

/** `?exercise=<id>` deep-links straight into an exercise (used by the
 *  always-visible "Craving right now" action → urge-surfing timer).
 *  `?item=<id>` does the same for a lesson (patient home "forward step"). */
function validateSearch(search: Record<string, unknown>): { exercise?: string; item?: string } {
  const out: { exercise?: string; item?: string } = {};
  if (typeof search["exercise"] === "string") out.exercise = search["exercise"];
  if (typeof search["item"] === "string") out.item = search["item"];
  return out;
}

function LibraryRoute() {
  const { exercise, item } = Route.useSearch();
  return <LibraryBrowser initialExercise={exercise} initialItem={item} />;
}

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "My library — Adelante" },
      {
        name: "description",
        content:
          "Short self-help lessons and practical exercises — grounding, sleep, worry and daily rhythm — you can work through on your own.",
      },
      { property: "og:title", content: "My library — Adelante" },
      {
        property: "og:description",
        content: "Self-paced lessons and tools for steadying your day, your body and your mind.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch,
  component: LibraryRoute,
});
