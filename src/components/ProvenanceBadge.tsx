// §Reporting Tier 2 — one honesty label for data we did not verify.
//
// Reuses the existing amber outline-badge pattern already used for
// "Pending verification" on unverified directory listings and for the DRAFT
// crisis-classification chips, rather than inventing a third visual language.
import { Badge } from "@/components/ui/badge";
import { CALOMS_SOURCE_LABEL, type CalomsDataSource } from "@/lib/caloms";

export function ProvenanceBadge({
  source,
  className,
}: {
  source: CalomsDataSource;
  className?: string;
}) {
  const selfReported = source === "self_report";
  return (
    <Badge
      variant="outline"
      data-provenance={source}
      data-testid={`provenance-${source}`}
      className={`text-[10px] ${
        selfReported
          ? "border-amber-warm text-amber-warm-foreground"
          : "text-muted-foreground"
      } ${className ?? ""}`}
    >
      {CALOMS_SOURCE_LABEL[source]}
    </Badge>
  );
}
