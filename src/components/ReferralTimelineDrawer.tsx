import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AdelanteEHR, useEhr, REFERRAL_SOURCE_LABELS, type Referral } from "@/lib/ehr";
import { ClientDate } from "@/components/ClientDate";
import { ReferralStatusTimeline } from "@/components/ReferralStatusTimeline";
import { REFERRAL_STATUS_STYLES } from "@/components/ReferralProgressStrip";
import { getActingRole } from "@/lib/roles";
import {
  REFERRAL_DECLINE_REASONS,
  canPerformReferralAction,
  referralActionDeniedReason,
  referralDeclineReasonLabel,
} from "@/lib/referralActions";

interface Props {
  referralId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Click-through drawer showing the full referral → intake → first-session
 * timeline with reached-step timestamps. Live-updates via useEhr as
 * assignments and intake steps advance.
 */
export function ReferralTimelineDrawer({ referralId, open, onOpenChange }: Props) {
  const referral = useEhr(() =>
    referralId ? AdelanteEHR.listReferrals().find((r) => r.id === referralId) : undefined,
  );
  const patient = useEhr(() =>
    referral?.enrolledPatientId ? AdelanteEHR.getPatient(referral.enrolledPatientId) : undefined,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-navy">
            {referral ? `${referral.firstName} ${referral.lastName}` : "Referral timeline"}
          </SheetTitle>
          <SheetDescription>
            Full referral journey with timestamps. Updates live as intake and assignments change.
          </SheetDescription>
        </SheetHeader>

        {!referral ? (
          <p className="mt-6 text-sm text-muted-foreground">Referral not found.</p>
        ) : (
          <div className="mt-6 space-y-4">
            <Card className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="text-muted-foreground">
                  Source:{" "}
                  <span className="text-navy">
                    {REFERRAL_SOURCE_LABELS[referral.referralSource] ?? referral.referralSource}
                  </span>
                  {referral.referringAgency ? ` · ${referral.referringAgency}` : ""}
                </div>
                <Badge
                  className={`${REFERRAL_STATUS_STYLES[referral.status]} border-0 capitalize`}
                >
                  {referral.status}
                </Badge>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">
                Submitted <ClientDate value={referral.createdAt} />
                {referral.cin && (
                  <span className="ml-2 font-mono">CIN ••••{referral.cin.slice(-4)}</span>
                )}
                {patient && (
                  <span className="ml-2">
                    · Enrolled as{" "}
                    <span className="font-mono text-navy">{patient.programId}</span>
                  </span>
                )}
              </div>
            </Card>

            <ReferralActionsCard referral={referral} />
            <ReferralDispositionHistory referral={referral} />

            {patient ? (
              <ReferralStatusTimeline patient={patient} />
            ) : (
              <Card className="p-4 space-y-3">
                <h3 className="font-display text-sm text-navy">Client journey</h3>
                <ol className="space-y-2">
                  <TimelineRow label="Referral submitted" iso={referral.createdAt} reached />
                  {/* §Phase 4a — only a genuine send counts as reached. */}
                  <TimelineRow
                    label={
                      referral.welcomeSms?.status === "sent"
                        ? "Welcome text sent"
                        : referral.welcomeSms
                          ? "Welcome text not sent"
                          : referral.outreachTask === "manual_call"
                            ? "Phone call needed (no text)"
                            : "Welcome outreach"
                    }
                    iso={referral.welcomeSms?.at}
                    reached={referral.welcomeSms?.status === "sent"}
                  />
                  <TimelineRow label="Enrolled" reached={false} />
                  <TimelineRow label="Case manager assigned" reached={false} />
                  <TimelineRow label="Clinician assigned" reached={false} />
                  <TimelineRow label="Intake completed" reached={false} />
                  <TimelineRow label="First session" reached={false} />
                </ol>
                <p className="text-[10px] text-muted-foreground">
                  Steps beyond enrollment appear once this referral becomes a patient record.
                </p>
              </Card>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * §Referrals Rework Phase 4a — the only place a referral can actually be
 * moved. Deliberately here, in the one drawer both tracker cards open, rather
 * than duplicated on each card: one implementation, one permission surface,
 * and Phase 4b's consolidation stays a display merge.
 */
function ReferralActionsCard({ referral }: { referral: Referral }) {
  const role = getActingRole();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const mayContact = canPerformReferralAction(role, "contact");
  const mayDispose = canPerformReferralAction(role, "enroll");
  const closed = referral.status === "declined" || referral.status === "enrolled";

  if (closed) {
    return (
      <Card className="p-4">
        <h3 className="font-display text-sm text-navy">Disposition</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {referral.status === "enrolled"
            ? "This referral is enrolled. Further care happens on the client's chart."
            : "This referral is closed. Reopening isn't available — submit a new referral instead."}
        </p>
      </Card>
    );
  }

  const run = (fn: () => void, ok: string) => {
    setBusy(true);
    try {
      fn();
      toast.success(ok);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That action couldn't be completed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-display text-sm text-navy">Move this referral</h3>
      <div className="flex flex-wrap gap-2">
        {referral.status === "submitted" && (
          <Button
            size="sm"
            variant="outline"
            disabled={!mayContact || busy}
            onClick={() =>
              run(() => AdelanteEHR.markReferralContacted(referral.id), "Marked as contacted")
            }
          >
            Mark contacted
          </Button>
        )}
        <Button
          size="sm"
          disabled={!mayDispose || busy}
          onClick={() =>
            run(() => {
              AdelanteEHR.enrollReferral(referral.id);
            }, "Enrolled — a client record has been created")
          }
        >
          Enroll
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!mayDispose || busy}
          onClick={() => setDeclining((d) => !d)}
        >
          Decline
        </Button>
      </div>
      {!mayContact && (
        <p className="text-[11px] text-muted-foreground">
          {referralActionDeniedReason("contact")}
        </p>
      )}
      {!mayDispose && (
        <p className="text-[11px] text-muted-foreground">{referralActionDeniedReason("enroll")}</p>
      )}
      {declining && mayDispose && (
        <div className="space-y-2 rounded-md border p-3">
          <Label className="text-xs">Reason for declining (required)</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Choose a reason" />
            </SelectTrigger>
            <SelectContent>
              {REFERRAL_DECLINE_REASONS.map((r) => (
                <SelectItem key={r.key} value={r.key}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={reason === "other" ? "Explain (required)" : "Optional detail"}
            className="text-sm"
            rows={2}
          />
          <p className="text-[10px] text-muted-foreground">
            Recorded with your name and the time. The person who made the referral only sees that
            the referral is closed — never the reason.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={!reason || (reason === "other" && !note.trim()) || busy}
              onClick={() =>
                run(() => {
                  AdelanteEHR.declineReferral(referral.id, {
                    reason,
                    ...(note.trim() ? { note: note.trim() } : {}),
                  });
                }, "Referral declined")
              }
            >
              Confirm decline
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDeclining(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/** Who moved this referral and when — nothing was attributed before Phase 4a. */
function ReferralDispositionHistory({ referral }: { referral: Referral }) {
  const rows = [
    referral.contactedAt
      ? { label: "Marked contacted", at: referral.contactedAt, by: referral.contactedBy }
      : null,
    referral.enrolledAt
      ? { label: "Enrolled", at: referral.enrolledAt, by: referral.enrolledBy }
      : null,
    referral.declinedAt
      ? {
          label: `Declined — ${referralDeclineReasonLabel(referral.declineReason ?? "")}`,
          at: referral.declinedAt,
          by: referral.declinedBy,
        }
      : null,
  ].filter(Boolean) as { label: string; at: string; by?: { name: string; role: string } }[];
  if (rows.length === 0) return null;
  return (
    <Card className="p-4">
      <h3 className="font-display text-sm text-navy">Staff actions</h3>
      <ul className="mt-2 space-y-1.5 text-xs">
        {rows.map((r) => (
          <li key={r.label} className="text-muted-foreground">
            <span className="text-navy">{r.label}</span> · <ClientDate value={r.at} />
            {r.by ? ` · ${r.by.name} (${r.by.role})` : " · attribution not recorded"}
          </li>
        ))}
        {referral.declineNote && (
          <li className="text-muted-foreground">Note: {referral.declineNote}</li>
        )}
      </ul>
    </Card>
  );
}



function TimelineRow({
  label,
  iso,
  reached,
}: {
  label: string;
  iso?: string;
  reached: boolean;
}) {
  return (
    <li className="flex items-start gap-2.5 text-xs">
      <div
        className={`mt-0.5 h-4 w-4 shrink-0 rounded-full ${reached ? "bg-teal" : "bg-border"}`}
      />
      <div className="min-w-0 flex-1">
        <div className="text-navy font-medium">{label}</div>
        <div className="text-[10px] text-muted-foreground">
          {iso ? <ClientDate value={iso} /> : "Pending"}
        </div>
      </div>
    </li>
  );
}