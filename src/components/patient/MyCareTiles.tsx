// §Part B2 — My Care tiles after intake: first appointment, your needs (with
// matched-resource counts, B3a), recommended for you, and a pending advocate
// invitation. No "Requested" appointment state exists yet (B3b not built).
import { Link } from "@tanstack/react-router";
import { CalendarCheck, HeartPulse, Sparkles, UserPlus } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { matchResourcesForNeed } from "@/lib/sdohResourceMatch";
import { patientBrowsableResources } from "@/lib/communityResources";
import { recommendationsFor } from "@/lib/seeking";
import { MY_CARE_TILE_COPY } from "@/lib/myCareTileCopy";

function useL() {
  const { lang } = useI18n();
  return lang === "es" ? "es" : "en";
}

export function FirstAppointmentTile({ patientId }: { patientId: string }) {
  const L = useL();
  const c = MY_CARE_TILE_COPY[L];
  const nextIso = useEhr(() => {
    const now = Date.now();
    const next = AdelanteEHR.appointmentsForPatient(patientId)
      .filter((a) => a.status === "scheduled" && +new Date(a.start) >= now)
      .sort((a, b) => +new Date(a.start) - +new Date(b.start))[0];
    return next?.start ?? null;
  });
  return (
    <Card className="p-5" data-testid="first-appointment-tile">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
        <CalendarCheck className="h-4 w-4" /> {c.apptTitle}
      </div>
      {nextIso ? (
        <p className="mt-2 text-sm" data-testid="first-appointment-scheduled">
          <Badge className="mr-2 border-0 bg-teal/15 text-teal">{c.scheduled}</Badge>
          {new Date(nextIso).toLocaleString(L === "es" ? "es-US" : "en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      ) : (
        <p className="mt-2 text-sm" data-testid="first-appointment-none">
          <Badge variant="outline" className="mr-2">{c.notScheduled}</Badge>
          {c.notScheduledBody}
        </p>
      )}
      <Button asChild size="sm" variant="outline" className="mt-3">
        <Link to="/schedule">{c.apptLink}</Link>
      </Button>
    </Card>
  );
}

export function NeedsTile({ patientId }: { patientId: string }) {
  const L = useL();
  const c = MY_CARE_TILE_COPY[L];
  const rowsJson = useEhr(() => {
    const p = AdelanteEHR.getPatient(patientId);
    const open = (p?.sdohPlan?.items ?? []).filter(
      (i) => i.visibleToPatient !== false && i.status !== "completed" && i.status !== "not_completed",
    );
    return JSON.stringify(
      open.map((i) => {
        const m = matchResourcesForNeed(i);
        const count = m?.showOrgs
          ? new Set(m.categoryIds.flatMap((cat) => patientBrowsableResources(cat).map((r) => r.id))).size
          : null;
        return { id: i.id, need: i.need, count, categoryOnly: Boolean(m && !m.showOrgs) };
      }),
    );
  });
  const rows = JSON.parse(rowsJson) as { id: string; need: string; count: number | null; categoryOnly: boolean }[];
  if (rows.length === 0) return null;
  return (
    <Card className="p-5" data-testid="next-steps-card">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
        <HeartPulse className="h-4 w-4" /> {c.needsTitle}
      </div>
      <ul className="mt-3 space-y-2" data-testid="needs-summary">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm">
            <span>{r.need}</span>
            <span className="text-xs text-muted-foreground" data-testid="need-match-count">
              {r.count !== null ? c.matches(r.count) : r.categoryOnly ? c.categoryOnly : c.noMatch}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">{c.needsNote}</p>
      <Button asChild size="sm" className="mt-3">
        <Link to="/next-steps">{c.needsLink}</Link>
      </Button>
    </Card>
  );
}

export function RecommendedTile({ patientId }: { patientId: string }) {
  const L = useL();
  const c = MY_CARE_TILE_COPY[L];
  const recsJson = useEhr(() => JSON.stringify(recommendationsFor(AdelanteEHR.getPatient(patientId))));
  const recs = JSON.parse(recsJson) as ReturnType<typeof recommendationsFor>;
  if (recs.length === 0) return null;
  return (
    <Card className="p-5" data-testid="recommended-tile">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
        <Sparkles className="h-4 w-4" /> {c.recTitle}
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {recs.map((r) => (
          <li key={r.id}>
            <Link
              to={r.to}
              hash={r.hash}
              data-testid={`rec-${r.id}`}
              className="block rounded-md border p-3 hover:border-teal"
            >
              <div className="text-sm font-medium text-navy">{r.title[L]}</div>
              <div className="text-xs text-muted-foreground">{r.body[L]}</div>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function AdvocatePendingTile({ patientId }: { patientId: string }) {
  const L = useL();
  const c = MY_CARE_TILE_COPY[L];
  const namesJson = useEhr(() =>
    JSON.stringify(
      AdelanteEHR.listAdvocateLinks(patientId)
        .filter((l) => l.status === "invited")
        .map((l) => ({ id: l.id, name: l.advocateName })),
    ),
  );
  const links = JSON.parse(namesJson) as { id: string; name: string }[];
  if (links.length === 0) return null;
  return (
    <Card className="p-5 border-amber-warm/60" data-testid="advocate-pending-tile">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
        <UserPlus className="h-4 w-4" /> {c.advTitle}
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        {links.map((l) => (
          <li key={l.id}>
            <span className="font-medium">{l.name}</span> — {c.advPending}
          </li>
        ))}
      </ul>
      <Button asChild size="sm" variant="outline" className="mt-3">
        <Link to="/consent">{c.advLink}</Link>
      </Button>
    </Card>
  );
}
