import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BadgeCheck, LifeBuoy, Phone, ShieldPlus, TriangleAlert } from "lucide-react";
import {
  NALOXONE_ACCESS_POINTS,
  NALOXONE_ACCESS_REVIEW,
  NALOXONE_STEPS,
  NALOXONE_STEPS_SOURCE,
  NEVER_USE_ALONE,
  SAFETY_CONTENT_REVIEW,
  TOLERANCE_WARNING,
} from "@/lib/safetyContent";

function ReviewPendingBanner() {
  if (!SAFETY_CONTENT_REVIEW.pending) return null;
  return (
    <div
      data-testid="naloxone-review-pending"
      className="flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200"
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        {SAFETY_CONTENT_REVIEW.notice} <span className="opacity-80">{SAFETY_CONTENT_REVIEW.scope}</span>
      </span>
    </div>
  );
}

function PendingChip() {
  return (
    <Badge className="border-0 bg-amber-500/15 text-[10px] text-amber-700">
      Pending clinical review
    </Badge>
  );
}

function VerifiedChip() {
  return (
    <Badge className="border-0 bg-emerald-500/15 text-[10px] text-emerald-700">
      Confirmed by {NALOXONE_ACCESS_REVIEW.verifiedBy}
    </Badge>
  );
}

function AccessVerifiedBanner() {
  if (NALOXONE_ACCESS_REVIEW.pending) return null;
  return (
    <div
      data-testid="naloxone-access-verified"
      className="flex items-start gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-900 dark:text-emerald-200"
    >
      <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{NALOXONE_ACCESS_REVIEW.notice}</span>
    </div>
  );
}

function NaloxonePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-8 sm:px-6" data-testid="naloxone-page">
      <div className="space-y-2">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary">
          <ShieldPlus className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="font-display text-3xl">Naloxone &amp; overdose prevention</h1>
        <p className="text-lg text-muted-foreground">
          How to get naloxone, how to use it, and what to do while you wait for help.
        </p>
      </div>

      <AccessVerifiedBanner />
      <ReviewPendingBanner />

      <Card className="soft-shadow space-y-3 border-crisis/30 bg-crisis-soft p-5">
        <h2 className="flex items-center gap-2 font-display text-xl text-crisis">
          <TriangleAlert className="h-5 w-5" aria-hidden="true" /> Your tolerance
        </h2>
        <p className="text-base leading-relaxed">{TOLERANCE_WARNING}</p>
        <PendingChip />
      </Card>

      <Card className="soft-shadow space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl">Where to get naloxone</h2>
          <VerifiedChip />
        </div>
        <ul className="space-y-3" data-testid="naloxone-access-points">
          {NALOXONE_ACCESS_POINTS.map((p) => (
            <li key={p.id} className="rounded-2xl border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold">{p.name}</span>
                {p.verified ? (
                  <Badge variant="outline" className="text-[10px]">
                    Verified{p.verifiedBy ? ` — ${p.verifiedBy}` : ""}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    Unverified
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.what}</p>
              <dl className="mt-2 space-y-0.5 text-sm">
                {p.city && <div>{p.city}</div>}
                {p.phone && (
                  <div>
                    <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} className="font-semibold underline">
                      {p.phone}
                    </a>
                  </div>
                )}
                {p.website && <div className="text-muted-foreground">{p.website}</div>}
                {p.source && <div className="text-xs text-muted-foreground">Source: {p.source}</div>}
              </dl>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="soft-shadow space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl">If someone is overdosing</h2>
          <PendingChip />
        </div>
        <ol className="space-y-3" data-testid="naloxone-steps">
          {NALOXONE_STEPS.map((s) => (
            <li key={s.step} className="flex gap-3 rounded-2xl border p-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {s.step}
              </span>
              <span>
                <span className="block text-base font-semibold">{s.title}</span>
                <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">
                  {s.body}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">Source: {NALOXONE_STEPS_SOURCE}</p>
      </Card>

      <Card className="soft-shadow space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl">{NEVER_USE_ALONE.name}</h2>
          <VerifiedChip />
        </div>
        <a
          href={`tel:${NEVER_USE_ALONE.phone.replace(/[^\d+]/g, "")}`}
          data-testid="never-use-alone-call"
          className="inline-flex min-h-12 items-center gap-2 rounded-2xl border px-4 py-3 text-base font-semibold hover:bg-secondary"
        >
          <Phone className="h-5 w-5" aria-hidden="true" />
          {NEVER_USE_ALONE.phone} · {NEVER_USE_ALONE.hours}
        </a>
        <p className="text-sm leading-relaxed text-muted-foreground">{NEVER_USE_ALONE.what}</p>
        {!NEVER_USE_ALONE.localLineConfirmed && (
          <p className="text-xs text-muted-foreground">
            No local Tulare County line has been confirmed, so only the national line is shown.
          </p>
        )}
      </Card>

      <Link
        to="/crisis"
        className="flex min-h-12 items-center gap-2 rounded-2xl border border-crisis/30 bg-crisis-soft px-4 py-3 text-base font-semibold text-crisis hover:bg-crisis/10"
      >
        <LifeBuoy className="h-5 w-5" aria-hidden="true" /> Crisis support
      </Link>
    </div>
  );
}

export const Route = createFileRoute("/naloxone")({
  head: () => ({
    meta: [
      { title: "Naloxone & overdose prevention — Adelante" },
      {
        name: "description",
        content:
          "Where to get free naloxone in Tulare County, how to respond to an opioid overdose step by step, and the Never Use Alone line.",
      },
      { property: "og:title", content: "Naloxone & overdose prevention — Adelante" },
      {
        property: "og:description",
        content: "Get naloxone, know the six steps, and never use alone.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NaloxonePage,
});
