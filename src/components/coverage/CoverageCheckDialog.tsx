import { useState } from "react";
import {
  AdelanteEHR,
  COVERAGE_CHECK_CHANNEL_LABEL,
  type CoverageCheckChannel,
  type CoverageCheckResult,
  type CoverageStatus,
  type StaffRole,
} from "@/lib/ehr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const RESULTS: { value: CoverageCheckResult; label: string }[] = [
  { value: "verified", label: "Eligibility confirmed" },
  { value: "not_found", label: "No record found" },
  { value: "pending", label: "Still waiting on an answer" },
];

const STATUS_OPTIONS: { value: CoverageStatus | "unchanged"; label: string }[] = [
  { value: "unchanged", label: "Don't change coverage status" },
  { value: "active", label: "Active Medi-Cal" },
  { value: "suspended", label: "Suspended" },
  { value: "uninsured", label: "Uninsured" },
  { value: "private", label: "Private insurance" },
];

/**
 * §Phase 3a — records a HUMAN eligibility check. Nothing in this app queries
 * DHCS: there is no 270/271 and no clearinghouse. The wording here must never
 * imply an automated check happened.
 */
export function CoverageCheckDialog({
  patientId,
  open,
  onOpenChange,
  actor,
}: {
  patientId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  actor: { actorId: string; actorRole: StaffRole };
}) {
  const patient = AdelanteEHR.getPatient(patientId);
  const [channel, setChannel] = useState<CoverageCheckChannel>("phone_county");
  const [channelNote, setChannelNote] = useState("");
  const [result, setResult] = useState<CoverageCheckResult>("verified");
  const [cin, setCin] = useState(patient?.cin ?? "");
  const [statusConfirmed, setStatusConfirmed] = useState<CoverageStatus | "unchanged">("unchanged");

  const cinOnFile = Boolean(patient?.cin);

  function submit() {
    const res = AdelanteEHR.recordCoverageCheck(patientId, {
      channel,
      channelNote,
      result,
      ...(cinOnFile ? {} : { cin }),
      ...(statusConfirmed !== "unchanged" ? { statusConfirmed } : {}),
      actorId: actor.actorId,
      actorRole: actor.actorRole,
    });
    if (!res.ok) {
      toast.error(res.error ?? "Could not record this check.");
      return;
    }
    toast.success("Eligibility check recorded");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="coverage-check-dialog">
        <DialogHeader>
          <DialogTitle>Record an eligibility check</DialogTitle>
          <DialogDescription>
            Adelante does not check Medi-Cal eligibility automatically. This records that you
            checked it yourself, and how.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>CIN (Client Index Number)</Label>
            {cinOnFile ? (
              <p className="text-sm" data-testid="coverage-check-cin-onfile">
                <span className="font-mono">{patient?.cin}</span>{" "}
                <span className="text-muted-foreground">
                  — already on this client's record. Change it on their profile, not here.
                </span>
              </p>
            ) : (
              <>
                <Input
                  value={cin}
                  onChange={(e) => setCin(e.target.value)}
                  placeholder="9 characters"
                  maxLength={9}
                  data-testid="coverage-check-cin"
                />
                <p className="text-xs text-muted-foreground">
                  No CIN on file. If you read one during this check, enter it — it saves to the
                  client's record.
                </p>
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>How did you check?</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as CoverageCheckChannel)}>
              <SelectTrigger data-testid="coverage-check-channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(COVERAGE_CHECK_CHANNEL_LABEL) as CoverageCheckChannel[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {COVERAGE_CHECK_CHANNEL_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>What did it show?</Label>
            <Select value={result} onValueChange={(v) => setResult(v as CoverageCheckResult)}>
              <SelectTrigger data-testid="coverage-check-result">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESULTS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Coverage status (separate from the check)</Label>
            <Select
              value={statusConfirmed}
              onValueChange={(v) => setStatusConfirmed(v as CoverageStatus | "unchanged")}
            >
              <SelectTrigger data-testid="coverage-check-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Only change this if the check actually told you the person's coverage status.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Notes (who you spoke to, reference number)</Label>
            <Textarea
              value={channelNote}
              onChange={(e) => setChannelNote(e.target.value)}
              rows={2}
              data-testid="coverage-check-note"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Recorded as {actor.actorId} ({actor.actorRole.replace(/_/g, " ")}).
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} data-testid="coverage-check-save">
            Record check
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
