// §Pre-release build 5 — staged DHCS timeline for one episode.
// Presentation only: everything shown is derived from the episode's real
// `anticipatedReleaseDate` / `missedHandoff` flag by `preReleaseTimeline`.
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CircleDot, Circle, Clock } from "lucide-react";
import type { PreReleaseEpisode } from "@/lib/ehr";
import { preReleaseTimeline } from "@/lib/preReleaseTimeline";

export function PreReleaseTimelineCard({ episode }: { episode: PreReleaseEpisode }) {
  const t = preReleaseTimeline({
    anticipatedReleaseDate: episode.anticipatedReleaseDate,
    ...(episode.missedHandoff ? { missedHandoff: true } : {}),
  });

  return (
    <Card className="p-4" data-testid="pre-release-timeline">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-medium">Reentry timeline</div>
        <Badge
          data-testid="pre-release-phase"
          variant={t.inWarmHandoffWindow ? "destructive" : "outline"}
        >
          {t.label}
        </Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t.help}</p>

      {t.daysUntilRelease !== null && (
        <p className="mt-2 text-xs text-muted-foreground" data-testid="pre-release-days">
          {t.daysUntilRelease >= 0
            ? `${t.daysUntilRelease} day${t.daysUntilRelease === 1 ? "" : "s"} until anticipated release`
            : `Released ${Math.abs(t.daysUntilRelease)} day${
                Math.abs(t.daysUntilRelease) === 1 ? "" : "s"
              } ago`}
        </p>
      )}

      <ol className="mt-3 space-y-2">
        {t.milestones.map((m) => (
          <li key={m.key} className="flex items-start gap-2 text-sm">
            {m.state === "passed" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
            ) : m.state === "active" ? (
              <CircleDot className="mt-0.5 h-4 w-4 text-warning" />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" />
            )}
            <span>
              {m.label}
              <span className="block text-xs text-muted-foreground">{m.date}</span>
            </span>
          </li>
        ))}
      </ol>

      {t.inWarmHandoffWindow && (
        <div
          data-testid="warm-handoff-notice"
          className="mt-3 flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
        >
          <Clock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Final 72 hours. Confirm the receiving ECM Provider, MAT continuity and first
            community appointments now — after release an incomplete handoff is picked up by the
            front-door safety net as a day-one catch-up episode, not here.
          </span>
        </div>
      )}

      {t.phase === "catch_up" && (
        <div
          data-testid="catch-up-notice"
          className="mt-3 rounded-md border bg-muted/50 p-2 text-xs text-muted-foreground"
        >
          Opened by the front-door safety net after release. The same forms apply, compressed into
          day one — there is no pre-release countdown to run.
        </div>
      )}
    </Card>
  );
}