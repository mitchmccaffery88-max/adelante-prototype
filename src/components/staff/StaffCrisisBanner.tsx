import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useActingStaff } from "@/lib/roles";
import { useEhr } from "@/lib/ehr";
import { canSeeAllEscalations, filterEscalations, listEscalations } from "@/lib/escalations";
import { Button } from "@/components/ui/button";

export function StaffCrisisBanner() {
  const actor = useActingStaff();
  const count = useEhr(() => filterEscalations(listEscalations(actor), actor, { view: canSeeAllEscalations(actor) ? "all" : "mine" }).filter(r => r.type === "crisis" && r.status !== "resolved").length);
  if (!count) return null;
  return <section aria-label="Open crisis escalations" data-testid="my-work-crisis-banner" className="flex flex-wrap items-center gap-3 border-y border-urgent bg-urgent-soft px-3 py-3 text-urgent"><ShieldAlert className="size-5 shrink-0" aria-hidden="true" /><p className="min-w-0 flex-1 font-semibold">{count} open crisis escalation{count === 1 ? "" : "s"}</p><Button asChild variant="outline" className="border-urgent text-urgent"><Link to="/escalations" search={{ view: undefined, type: "crisis", owner: undefined, overdue: undefined }}>Open crisis queue</Link></Button></section>;
}