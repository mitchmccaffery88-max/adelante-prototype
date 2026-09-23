// §Dashboard Standardization Phase 5c — read-only rollup of this client's open
// items, drawn from sources that already exist. Nothing is tracked here; every
// row links to the record section where the work is actually done.
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { useEhr } from "@/lib/ehr";
import { listPatientOpenItems } from "@/lib/patientOpenItems";
import { Inbox } from "lucide-react";

export function PatientOpenItemsCard({ patientId }: { patientId: string }) {
  const items = useEhr(() => listPatientOpenItems(patientId));
  if (items.length === 0) return null;
  return (
    <Card className="p-3" data-testid="patient-open-items">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Inbox className="h-3.5 w-3.5 text-teal" /> Open items for this client
      </div>
      <ul className="mt-2 space-y-1.5">
        {items.map((it) => (
          <li key={`${it.kind}-${it.id}`} className="rounded border p-2 text-sm">
            <Link
              to="/record/$patientId"
              params={{ patientId }}
              search={{ section: it.section }}
              className="font-medium text-navy underline-offset-2 hover:underline"
            >
              {it.label}
            </Link>
            {it.detail && <div className="text-[11px] text-muted-foreground">{it.detail}</div>}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Read-only. These come from existing records — signing, social needs and refills are worked
        in their own sections.
      </p>
    </Card>
  );
}
