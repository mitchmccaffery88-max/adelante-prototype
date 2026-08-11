import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdelanteEHR, useEhr, REFERRAL_SOURCE_LABELS } from "@/lib/ehr";
import { ClientDate } from "@/components/ClientDate";
import { ReferralStatusTimeline } from "@/components/ReferralStatusTimeline";

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
                <Badge className="bg-teal/20 text-teal border-0 capitalize">
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

            {patient ? (
              <ReferralStatusTimeline patient={patient} />
            ) : (
              <Card className="p-4 space-y-3">
                <h3 className="font-display text-sm text-navy">Client journey</h3>
                <ol className="space-y-2">
                  <TimelineRow label="Referral submitted" iso={referral.createdAt} reached />
                  <TimelineRow
                    label={
                      referral.outreachTask === "manual_call"
                        ? "Manual outreach queued"
                        : "Welcome outreach"
                    }
                    iso={
                      referral.smsSentAt ??
                      (referral.outreachTask === "manual_call" ? referral.createdAt : undefined)
                    }
                    reached={!!(referral.smsSentAt || referral.outreachTask)}
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