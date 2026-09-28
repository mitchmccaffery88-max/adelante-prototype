import { createFileRoute, Link } from "@tanstack/react-router";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { HLOC_TARGET_LABEL, hiddenHlocCount, visibleHlocReferrals } from "@/lib/outpatientCare";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClientDate } from "@/components/ClientDate";

export const Route = createFileRoute("/clinical-referrals")({
  head: () => ({
    meta: [
      { title: "Higher-level referrals — Adelante" },
      { name: "description", content: "Clinician list of referrals to a higher level of care and their status." },
      { property: "og:title", content: "Higher-level referrals — Adelante" },
      { property: "og:description", content: "Track IOP, residential, withdrawal management and inpatient referrals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReferralList,
});

function ReferralList() {
  const { role } = useActingStaff();
  const rows = useEhr(() => visibleHlocReferrals(role));
  const hidden = hiddenHlocCount(role);
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <h1 className="font-display text-2xl text-navy">Referrals to a higher level of care</h1>
      {hidden > 0 && <p className="text-xs text-muted-foreground">{hidden} protected referral(s) not shown for your role.</p>}
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No referrals.</p>}
      {rows.map((r) => {
        const p = AdelanteEHR.getPatient(r.patientId);
        return (
          <Card key={r.id} className="p-3 text-sm space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link to="/record/$patientId" params={{ patientId: r.patientId }} search={{ section: "episodes" } as never} className="font-medium text-teal">
                {p ? `${p.firstName} ${p.lastName}` : "Patient"}
              </Link>
              <span>{HLOC_TARGET_LABEL[r.target]}</span>
              <Badge variant="outline" className="capitalize">{r.status}</Badge>
              <Badge variant="secondary" className="capitalize">{r.urgency}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              To {r.destination} · drafted <ClientDate value={r.createdAt} /> by {r.createdBy}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
