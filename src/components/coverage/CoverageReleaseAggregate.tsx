// §B2 — admin aggregate: released patients whose coverage isn't Active yet. Cohort guard 11.
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { useEhr } from "@/lib/ehr";
import { coverageReleaseVersion, releaseCoverageAggregate } from "@/lib/coverageRelease";

export function CoverageReleaseAggregate() {
  const agg = useEhr(() => { void coverageReleaseVersion(); return releaseCoverageAggregate(); });
  return (
    <Card className="mb-6 flex flex-wrap items-center justify-between gap-2 p-4" data-testid="coverage-release-aggregate">
      <div>
        <div className="text-sm font-semibold">Coverage at release</div>
        <div className="text-sm text-muted-foreground">
          {agg.belowMinimumCohort
            ? `Too few released patients to report (fewer than ${agg.minimumCohortSize})`
            : `${agg.notActive} of ${agg.released} released patients not yet Active`}
        </div>
      </div>
      <Link to="/coverage-release" className="text-sm underline">Open tracker</Link>
    </Card>
  );
}
