// §Advocate Access Redesign Phase 5 — the advocate Library reads the SAME live
// content overlay the patient Library uses (`contentCatalog.ts` →
// `contentPublishing.ts`), filtered to categories whose audience is
// "advocate". There is no parallel content system and no advocate-tier gate:
// the bucket is universal to anyone in an advocate role.
//
// Until the clinical content manager publishes lessons into it, this shows a
// real "content pending" state — no placeholder articles.
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdvocateViewHeader } from "@/components/advocate/AdvocateViewParts";
import {
  liveAdvocateLibraryCategories,
  liveAdvocateLibraryItems,
  usePublishedContentVersion,
} from "@/lib/contentCatalog";
import { resolveContentIcon } from "@/lib/contentIcons";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.b8100f5ba8bd": {
    "en": "Library",
    "es": "Biblioteca"
  },
  "ui.58ca94ddf834": {
    "en": "Content pending authoring",
    "es": "Contenido pendiente de preparación"
  },
  "ui.c72ded3737f8": {
    "en": "Nothing has been published here yet. The advocate library is being written by the clinical team, and this page will fill in as those pieces are approved — we'd rather show you nothing than placeholder text.",
    "es": "Todavía no se ha publicado contenido aquí. El equipo clínico está preparando la biblioteca para personas de apoyo. Mostraremos cada material cuando se apruebe, en lugar de mostrar texto provisional."
  }
} as const;


export const Route = createFileRoute("/advocate/library")({
  head: () => ({ meta: [
    { title: "Library \u2014 Adelante advocate" },
    { name: "description", content: "Your library in the Adelante advocate portal." },
    { property: "og:title", content: "Library \u2014 Adelante advocate" },
    { property: "og:description", content: "Your library in the Adelante advocate portal." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AdvocateLibraryView,
});

function AdvocateLibraryView() {
  const { lang: screenLang } = useI18n();

  // Re-render when something is actually published into the bucket.
  usePublishedContentVersion();
  const categories = liveAdvocateLibraryCategories();

  return (
    <div className="space-y-4">
      <AdvocateViewHeader
        icon={BookOpen}
        title={SCREEN_COPY["ui.b8100f5ba8bd"][screenLang]}
        lede="Reading and guidance written for people supporting someone in care."
      />

      {categories.length === 0 ? (
        <PendingCard />
      ) : (
        categories.map((cat) => {
          const items = liveAdvocateLibraryItems(cat.id);
          const Icon = resolveContentIcon(cat.icon);
          return (
            <Card key={cat.id} className="space-y-3 p-5" data-testid={`advocate-library-${cat.id}`}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-teal">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="flex-1">
                  <h2 className="font-display text-lg text-navy">{cat.name}</h2>
                  <p className="text-sm text-muted-foreground">{cat.desc}</p>
                </div>
              </div>
              {items.length === 0 ? (
                <PendingCard compact />
              ) : (
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-2xl border border-border bg-card p-4 text-sm font-medium text-navy"
                    >
                      {item.title}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}

function PendingCard({ compact }: { compact?: boolean }) {
  const { lang: screenLang } = useI18n();

  return (
    <Card
      data-testid="advocate-library-pending"
      className={`space-y-2 border-attention bg-attention-soft ${compact ? "p-4" : "p-5"}`}
    >
      <Badge variant="outline" className="border-attention text-on-attention-soft">
        {SCREEN_COPY["ui.58ca94ddf834"][screenLang]} </Badge>
      <p className="text-sm text-on-attention-soft">
        {SCREEN_COPY["ui.c72ded3737f8"][screenLang]} </p>
    </Card>
  );
}
