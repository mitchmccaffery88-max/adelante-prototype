// §Adelante Journey Phase 6 — the STAFF side of the resource directory.
//
// This is the workflow that makes `verified` real: an entry stays out of the
// patient-facing Resource Center until someone with a verifier role fills in
// the address, phone and hours AND ticks all three "I confirmed this with the
// provider" boxes. The store refuses anything short of that, so this UI cannot
// publish a listing by decorating it.
import { useState, useSyncExternalStore } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { useActingStaff } from "@/lib/roles";
import {
  RESOURCE_CATEGORIES,
  RESOURCE_VERIFIER_ROLES,
  listResources,
  resourceVerificationQueue,
  updateResourceDetails,
  verifyResource,
} from "@/lib/communityResources";

export function ResourceVerificationQueue() {
  const { role, staffId, name } = useActingStaff();
  const snapshot = useSyncExternalStore(
    (l) => {
      // subscribe through the module so edits re-render immediately
      const { subscribeResources } = require("@/lib/communityResources");
      return subscribeResources(l);
    },
    () => JSON.stringify({ queue: resourceVerificationQueue(), all: listResources().length }),
    () => JSON.stringify({ queue: [], all: 0 }),
  );
  const { queue, all } = JSON.parse(snapshot) as {
    queue: ReturnType<typeof resourceVerificationQueue>;
    all: number;
  };
  const canVerify = RESOURCE_VERIFIER_ROLES.includes(role);

  return (
    <Card className="p-5" data-testid="resource-verification-queue">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
        <ShieldCheck className="h-4 w-4" /> Community resource verification
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {all - queue.length} of {all} listings are live for patients. An entry is invisible to
        patients until someone calls the provider and confirms the address, phone and hours.
        {!canVerify && " Your role can review these but cannot publish them."}
      </p>
      <ul className="mt-4 space-y-3">
        {queue.map((r) => (
          <VerifyRow
            key={r.id}
            resource={r}
            canVerify={canVerify}
            actorName={name}
            actorStaffId={staffId ?? undefined}
            actorRole={role}
          />
        ))}
        {queue.length === 0 && (
          <li className="text-sm text-muted-foreground">Every listing is verified and live.</li>
        )}
      </ul>
    </Card>
  );
}

function VerifyRow({
  resource,
  canVerify,
  actorName,
  actorStaffId,
  actorRole,
}: {
  resource: ReturnType<typeof resourceVerificationQueue>[number];
  canVerify: boolean;
  actorName: string;
  actorStaffId?: string;
  actorRole: Parameters<typeof verifyResource>[0]["actorRole"];
}) {
  const [address, setAddress] = useState(resource.address);
  const [phone, setPhone] = useState(resource.phone);
  const [hours, setHours] = useState(resource.hours);
  const [checks, setChecks] = useState({ address: false, phone: false, hours: false });
  const category = RESOURCE_CATEGORIES.find((c) => c.id === resource.categoryId);

  const publish = () => {
    updateResourceDetails(resource.id, { address, phone, hours });
    const res = verifyResource({
      resourceId: resource.id,
      actorName,
      actorStaffId,
      actorRole,
      confirmedAddress: checks.address,
      confirmedPhone: checks.phone,
      confirmedHours: checks.hours,
    });
    if (!res.ok) toast.error(res.reason);
    else toast.success(`${res.resource.name} is now live for patients.`);
  };

  return (
    <li className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-foreground">{resource.name}</span>
        {category && (
          <Badge variant="outline" className="text-[10px]">
            {category.name}
          </Badge>
        )}
        <Badge className="border-0 bg-gold/20 text-[10px] text-gold-foreground">
          {resource.status === "needs_update" ? "Needs re-check" : "Not verified"}
        </Badge>
        {resource.placeholder && (
          <Badge variant="outline" className="text-[10px]">
            Placeholder — needs sourcing
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{resource.description}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
        <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input placeholder="Hours" value={hours} onChange={(e) => setHours(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-4 text-xs">
        {(["address", "phone", "hours"] as const).map((k) => (
          <label key={k} className="flex items-center gap-2">
            <Checkbox
              checked={checks[k]}
              onCheckedChange={(v) => setChecks((p) => ({ ...p, [k]: v === true }))}
            />
            Confirmed {k} with the provider
          </label>
        ))}
      </div>
      <Button type="button" size="sm" disabled={!canVerify} onClick={publish}>
        Verify and publish
      </Button>
    </li>
  );
}