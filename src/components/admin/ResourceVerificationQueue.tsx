// §Adelante Journey Phase 6 — the STAFF side of the resource directory.
//
// This is the workflow that makes `verified` real: an entry stays out of the
// patient-facing Resource Center until someone with a verifier role fills in
// the address, phone and hours AND ticks all three "I confirmed this with the
// provider" boxes. The store refuses anything short of that, so this UI cannot
// publish a listing by decorating it.
import { useState, useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { useActingStaff } from "@/lib/roles";
import { ClientDate } from "@/components/ClientDate";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { runAction } from "@/lib/actions/runAction";
import {
  RESOURCE_CATEGORIES,
  RESOURCE_VERIFIER_ROLES,
  listResources,
  isResourceVerified,
  resourceVerificationQueue,
  subscribeResources,
  verifyResource,
} from "@/lib/communityResources";

export function ResourceVerificationQueue({ onEdit }: { onEdit?: (id: string) => void }) {
  const { role, staffId, staffName } = useActingStaff();
  const [filter, setFilter] = useState("not_verified");
  const snapshot = useSyncExternalStore(
    subscribeResources,
    () => JSON.stringify(listResources()),
    () => "[]",
  );
  const resources = JSON.parse(snapshot) as ReturnType<typeof listResources>;
  const confirmed = resources.filter(isResourceVerified).length;
  const shown = resources.filter((r) => filter === "all" || isResourceVerified(r) === (filter === "verified"));
  const canVerify = RESOURCE_VERIFIER_ROLES.includes(role);

  return (
    <section className="space-y-4" data-testid="resource-verification-queue">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
        <ShieldCheck className="h-4 w-4" /> Community resource verification
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44" aria-label="Resource verification filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="not_verified">Not verified</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground" data-testid="resource-confirmed-count">{confirmed} of {resources.length} confirmed</p>
      </div>
      {!canVerify && <p className="text-xs text-muted-foreground">Your role can review these but cannot publish them.</p>}
      <ul className="mt-4 space-y-3">
        {shown.map((r) => (
          <VerifyRow
            key={r.id}
            resource={r}
            canVerify={canVerify}
            actorName={staffName}
            actorStaffId={staffId ?? undefined}
            actorRole={role}
            onEdit={onEdit}
          />
        ))}
        {shown.length === 0 && (
          <li className="text-sm text-muted-foreground">No listings in this filter.</li>
        )}
      </ul>
    </section>
  );
}

function VerifyRow({
  resource,
  canVerify,
  actorName,
  actorStaffId,
  actorRole,
  onEdit,
}: {
  resource: ReturnType<typeof resourceVerificationQueue>[number];
  canVerify: boolean;
  actorName: string;
  actorStaffId?: string;
  actorRole: Parameters<typeof verifyResource>[0]["actorRole"];
  onEdit?: (id: string) => void;
}) {
  const [address, setAddress] = useState(resource.address);
  const [name, setName] = useState(resource.name);
  const [description, setDescription] = useState(resource.description);
  const [website, setWebsite] = useState(resource.website ?? "");
  const [phone, setPhone] = useState(resource.phone);
  const [hours, setHours] = useState(resource.hours);
  const [checks, setChecks] = useState({ address: false, phone: false, hours: false });
  const category = RESOURCE_CATEGORIES.find((c) => c.id === resource.categoryId);

  const publish = () => {
    const res = runAction<ReturnType<typeof verifyResource>>("resource_verify", { role: actorRole, staffId: actorStaffId, staffName: actorName }, undefined, { args: [{
      resourceId: resource.id,
      actorName,
      actorStaffId,
      actorRole,
      confirmedAddress: checks.address,
      confirmedPhone: checks.phone,
      confirmedHours: checks.hours,
      details: { name, description, website, address, phone, hours },
    }] });
    if (!res.ok) toast.error(res.reason);
    else if (res.value.ok) toast.success(`${res.value.resource.name} is now live for patients.`);
  };

  return (
    <li className="space-y-2 rounded-lg border border-border p-3" data-testid="resource-listing" data-resource-id={resource.id}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-foreground">{resource.name}</span>
        {category && (
          <Badge variant="outline" className="text-[10px]">
            {category.name}
          </Badge>
        )}
        <Badge className={isResourceVerified(resource) ? "border-0 bg-teal/15 text-[10px] text-teal" : "border-0 bg-gold/20 text-[10px] text-gold-foreground"}>
          {isResourceVerified(resource) ? "Verified" : "Not verified"}
        </Badge>
        {resource.placeholder && (
          <Badge variant="outline" className="text-[10px]">
            Placeholder — needs sourcing
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground" data-testid="resource-verifier">
        Verified by {resource.verification?.verifiedBy ?? "—"} · {resource.verification ? <ClientDate value={resource.verification.verifiedAt} /> : "—"}
      </p>
      <p className="text-xs text-muted-foreground">{resource.description}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input aria-label="Listing name" value={name} disabled={!canVerify} onChange={(e) => setName(e.target.value)} />
        <Input aria-label="Description" value={description} disabled={!canVerify} onChange={(e) => setDescription(e.target.value)} />
        <Input aria-label="Website" value={website} disabled={!canVerify} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input aria-label="Address" placeholder="Address" value={address} disabled={!canVerify} onChange={(e) => setAddress(e.target.value)} />
        <Input aria-label="Phone" placeholder="Phone" value={phone} disabled={!canVerify} onChange={(e) => setPhone(e.target.value)} />
        <Input aria-label="Hours" placeholder="Hours" value={hours} disabled={!canVerify} onChange={(e) => setHours(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-4 text-xs">
        {(["address", "phone", "hours"] as const).map((k) => (
          <label key={k} className="flex items-center gap-2">
            <Checkbox
              disabled={!canVerify}
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
      {onEdit && <Button type="button" size="sm" variant="outline" onClick={() => onEdit(resource.id)}>Edit listing</Button>}
    </li>
  );
}