// §Reporting Redesign Tier 1 — reporting period selector.
//
// A real control, not decoration: the selected key is a URL search param so a
// period is shareable and survives a reload. Sections that cannot honestly
// re-window say so themselves; this component only reports the choice.
import { CalendarRange } from "lucide-react";
import {
  REPORTING_PERIODS,
  periodLabel,
  type ReportingPeriodKey,
} from "@/lib/reportingPeriods";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PeriodSelector({
  value,
  onChange,
  asOf,
}: {
  value: ReportingPeriodKey;
  onChange: (v: ReportingPeriodKey) => void;
  /** Rendered as the explicit "as of" stamp so a number is never undated. */
  asOf?: Date;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="period-selector">
      <CalendarRange className="h-4 w-4 text-teal" aria-hidden />
      <label htmlFor="reporting-period" className="text-xs text-muted-foreground">
        Reporting period
      </label>
      <Select value={value} onValueChange={(v) => onChange(v as ReportingPeriodKey)}>
        <SelectTrigger id="reporting-period" className="h-8 w-[168px] text-sm">
          <SelectValue placeholder={periodLabel(value)} />
        </SelectTrigger>
        <SelectContent>
          {REPORTING_PERIODS.map((p) => (
            <SelectItem key={p.key} value={p.key}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {asOf && (
        <span className="text-[11px] text-muted-foreground" suppressHydrationWarning>
          as of {asOf.toISOString().slice(0, 16).replace("T", " ")} UTC
        </span>
      )}
    </div>
  );
}
