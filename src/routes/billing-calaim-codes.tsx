import { createFileRoute } from "@tanstack/react-router";
import { canAccess, useActingStaff } from "@/lib/roles";
import { CalaimCodesSection } from "@/components/admin/CalaimCodesSection";
import { Card } from "@/components/ui/card";

// §Phase 7a — CalAIM qualifying codes, moved from KPI targets into Revenue &
// billing. Billing roles edit; population_health writers (clinical
// coordinator, sys admin) read only, since the codes drive their dashboards.
export const Route = createFileRoute("/billing-calaim-codes")({
  head: () => ({
    meta: [
      { title: "CalAIM qualifying codes — Adelante Billing" },
      {
        name: "description",
        content: "ICD-10 codes that make a patient CalAIM-eligible, maintained by billing.",
      },
      { property: "og:title", content: "CalAIM qualifying codes — Adelante Billing" },
      {
        property: "og:description",
        content: "ICD-10 codes that make a patient CalAIM-eligible, maintained by billing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BillingCalaimCodesPage,
});

function BillingCalaimCodesPage() {
  const { role, staffName } = useActingStaff();
  const billing = canAccess(role, "billing").level;
  const canWrite = billing === "write";
  const canRead = billing !== "none" || canAccess(role, "population_health").level === "write";

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Revenue &amp; billing</p>
        <h1 className="font-display text-2xl text-navy">CalAIM qualifying codes</h1>
      </div>
      {!canRead ? (
        <Card className="p-4 text-sm text-muted-foreground">
          CalAIM qualifying codes aren't available for your role.
        </Card>
      ) : (
        <>
          {!canWrite && (
            <Card className="p-3 text-sm text-muted-foreground" data-testid="calaim-read-only">
              View only — billing staff maintain these codes. They drive CalAIM eligibility on
              your dashboards and reports.
            </Card>
          )}
          <CalaimCodesSection canWrite={canWrite} staffName={staffName} />
        </>
      )}
    </div>
  );
}
