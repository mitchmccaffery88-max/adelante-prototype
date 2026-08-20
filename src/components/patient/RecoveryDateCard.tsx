// §Recovery start date — the patient-facing surfaces.
//
// The date is PATIENT-PRIVATE self-tracking (`@/lib/selfTracking`), not a
// clinical field: no EHR write, no audit entry, no staff/advocate read path.
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { CalendarHeart } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  recoveryStartDate as readRecoveryStartDate,
  setRecoveryStartDate,
  subscribeSelfTracking,
} from "@/lib/selfTracking";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  dayKeyLocal,
  daysSober,
  daysSoberLabel,
  passedMilestone,
} from "@/lib/recoveryStartDate";

/** Patient's own date, or undefined. Only the patient can ever read this. */
export function useMyRecoveryStartDate(patientId: string): string | undefined {
  return useSyncExternalStore(
    subscribeSelfTracking,
    () => (patientId ? readRecoveryStartDate(patientId) : undefined),
    () => undefined,
  );
}

/** Editable card for /profile — patient-controlled, no justification asked. */
export function RecoveryDateCard({ patientId }: { patientId: string }) {
  const date = useMyRecoveryStartDate(patientId);
  const [draft, setDraft] = useState<string>(date ?? "");
  const days = daysSober(date);

  return (
    <Card className="p-5" id="recovery-date" data-testid="recovery-date-card">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
        <CalendarHeart className="h-4 w-4" /> My recovery start date
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Only you can see this — it stays on your side of the app and isn&apos;t part of your
        medical record. Set it, change it, or clear it whenever you want — no explanation needed.
      </p>
      {date && (
        <p className="mt-3 text-base text-foreground" data-testid="recovery-date-current">
          {daysSoberLabel(days)}
          {passedMilestone(days) ? ` · past ${passedMilestone(days)} days` : ""}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="recovery-date-input" className="text-xs">
            Start date
          </Label>
          <Input
            id="recovery-date-input"
            data-testid="recovery-date-input"
            type="date"
            max={dayKeyLocal(new Date())}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="mt-1 w-44"
          />
        </div>
        <Button
          type="button"
          data-testid="recovery-date-save"
          disabled={!draft || draft === date}
          onClick={() => {
            setRecoveryStartDate(patientId, draft);
            toast.success("Saved. Yours to change any time.");
          }}
        >
          Save
        </Button>
        {date && (
          <Button
            type="button"
            variant="ghost"
            data-testid="recovery-date-clear"
            onClick={() => {
              setRecoveryStartDate(patientId, null);
              setDraft("");
              toast.success("Cleared.");
            }}
          >
            Clear
          </Button>
        )}
      </div>
    </Card>
  );
}

/** Compact read-only line for Home and the Recovery Journey header. */
export function DaysSoberLine({ patientId }: { patientId: string }) {
  const date = useMyRecoveryStartDate(patientId);
  const days = daysSober(date);
  if (!patientId) return null;
  return (
    <p className="text-base text-muted-foreground" data-testid="days-sober-line">
      {days === null ? (
        <>
          Recovery start date not set —{" "}
          <Link to="/profile" hash="recovery-date" className="underline">
            Set your date
          </Link>
        </>
      ) : (
        <>
          <span className="font-medium text-foreground">{daysSoberLabel(days)}</span> since your
          recovery start date
        </>
      )}
    </p>
  );
}