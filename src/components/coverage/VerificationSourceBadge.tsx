import { Badge } from "@/components/ui/badge";
import type { CoverageVerificationRecord } from "@/lib/ehr";
import { verificationKind, verificationSourceLabel } from "@/lib/verificationSource";

const TONE = {
  reported: "bg-warning/20 text-navy border-0",
  staff: "bg-teal/15 text-navy border-0",
  electronic: "bg-navy/10 text-navy border-0",
} as const;

export function VerificationSourceBadge({ record }: { record: CoverageVerificationRecord }) {
  return (
    <Badge className={`text-[10px] font-normal ${TONE[verificationKind(record)]}`} data-testid="verification-source">
      {verificationSourceLabel(record)}
    </Badge>
  );
}
