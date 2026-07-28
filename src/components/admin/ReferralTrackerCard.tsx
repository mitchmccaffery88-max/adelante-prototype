import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClientDate } from "@/components/ClientDate";
import { AdelanteEHR } from "@/lib/ehr";
import type { ReferralStatus } from "@/lib/ehr";

const trackerStyles: Record<ReferralStatus, string> = {
  submitted: "bg-gold/30 text-navy",
  contacted: "bg-teal/20 text-teal",
  enrolled: "bg-success/20 text-success",
};
const trackerOrder: ReferralStatus[] = ["submitted", "contacted", "enrolled"];

export function ReferralTrackerCard({
  referrals,
  title = "Referral status",
  limit = 5,
}: {
  referrals: ReturnType<typeof AdelanteEHR.listReferrals>;
  title?: string;
  limit?: number;
}) {
  const sourceLabels: Record<string, string> = {
    probation: "Probation",
    parole: "Parole",
    drug_court: "Drug court",
    correctional: "Correctional",
    self: "Self-referred",
    other: "Other",
  };
  const shown = referrals.slice(0, limit);
  return (
    <Card className="p-5">
      <h3 className="font-display text-lg text-navy mb-3">{title}</h3>
      {shown.length === 0 ? (
        <p className="text-xs text-muted-foreground">No referrals in the pipeline.</p>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <div key={r.id} className="border-b last:border-0 pb-3 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm">
                  <div className="font-medium text-navy">
                    {r.firstName} {r.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {sourceLabels[r.referralSource] ?? r.referralSource}
                    {r.referringAgency ? ` · ${r.referringAgency}` : ""} ·{" "}
                    <ClientDate value={r.createdAt} />
                  </div>
                  {r.cin && (
                    <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                      CIN ••••{r.cin.slice(-4)}
                    </div>
                  )}
                </div>
                <Badge className={`${trackerStyles[r.status]} capitalize border-0`}>
                  {r.status}
                </Badge>
              </div>
              <div className="mt-2 flex gap-1">
                {trackerOrder.map((s, i) => {
                  const reached = trackerOrder.indexOf(r.status) >= i;
                  return (
                    <div
                      key={s}
                      className={`h-1 flex-1 rounded-full ${reached ? "bg-teal" : "bg-border"}`}
                    />
                  );
                })}
              </div>
              {r.smsSentAt ? (
                <div className="mt-1.5 text-[10px] text-success">✓ Welcome SMS sent</div>
              ) : r.outreachTask === "manual_call" ? (
                <div className="mt-1.5 text-[10px] text-gold-foreground">
                  ⚑ Manual outreach queued (no SMS)
                </div>
              ) : null}
              {r.enrolledPatientId &&
                (() => {
                  const enrolled = AdelanteEHR.getPatient(r.enrolledPatientId);
                  return enrolled ? (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      Enrolled as{" "}
                      <span className="font-mono text-navy">{enrolled.programId}</span>
                    </div>
                  ) : null;
                })()}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}