import { StaffTable } from "@/components/staff/StaffTable";
import { StatusChip } from "@/components/ui/status-chip";
// §B6 — same-day staff add / change / deactivate. sys_admin only, reason
// required on every write, all via runAction → staffLifecycle.ts.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { STAFF_ROLES, STAFF_ROSTER, useActingStaff, type StaffRole } from "@/lib/roles";
import { PROTOTYPE_IDENTITY_LABEL, reassignNeededItems } from "@/lib/staffLifecycle";
import { runAction } from "@/lib/actions/runAction";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/admin-staff")({
  head: () => ({
    meta: [
      { title: "Staff members — Adelante Admin" },
      { name: "description", content: "Add, change roles/sites and deactivate staff. Prototype identity — reason required and audited." },
      { property: "og:title", content: "Staff members — Adelante Admin" },
      { property: "og:description", content: "Manage staff roles, sites and active status with audited reasons." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminStaffPage,
});

type Drawer = { kind: "add" } | { kind: "edit"; id: string } | { kind: "deactivate"; id: string } | { kind: "reactivate"; id: string } | null;

function AdminStaffPage() {
  const { role, staffId, staffName } = useActingStaff();
  const roster = useEhr(() => [...STAFF_ROSTER]);
  const needsReassign = useEhr(() => reassignNeededItems());
  const [drawer, setDrawer] = useState<Drawer>(null);

  if (role !== "sys_admin") {
    return <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-muted-foreground">Only a system administrator can manage staff.</div>;
  }

  const actor = { role, staffId, staffName };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-navy">Staff members</h1>
        <Button size="sm" onClick={() => setDrawer({ kind: "add" })}>Add staff member</Button>
      </div>
      <Badge variant="outline" className="text-sm" data-testid="prototype-identity-banner">{PROTOTYPE_IDENTITY_LABEL}</Badge>

      {needsReassign.length > 0 && (
        <Card className="p-4 space-y-2" data-testid="reassign-needed-card">
          <h2 className="font-display text-base text-navy">Deactivated people with open items</h2>
          <p className="text-xs text-muted-foreground">Nothing is reassigned automatically. Signed notes keep their original author.</p>
          <ul className="text-sm space-y-1">
            {needsReassign.map((r) => (
              <li key={r.staffId} data-testid={`reassign-row-${r.staffId}`}>
                {r.name}: {r.counts.notesToSign} notes to sign · {r.counts.tasks} tasks · {r.counts.escalations} escalations · {r.counts.caseload} caseload
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section>
        <StaffTable rows={roster} rowKey={(m) => m.id} label="Staff members" testId="staff-members-table"
          views={[{ id: "all", label: "Current view", matches: () => true }, { id: "active", label: "Active", matches: (m) => m.active !== false }, { id: "closed", label: "Deactivated", matches: (m) => m.active === false }]} defaultView="all"
          columns={[
            { id: "name", label: "Name", sortValue: (m) => m.fullName ?? m.name, cell: (m) => m.fullName ?? m.name },
            { id: "role", label: "Role", sortValue: (m) => STAFF_ROLES.find((r) => r.key === m.role)?.label ?? m.role, cell: (m) => STAFF_ROLES.find((r) => r.key === m.role)?.label ?? m.role },
            { id: "status", label: "Status", sortValue: (m) => m.active === false ? "Deactivated" : "Active", cell: (m) => <StatusChip lang="en" state={m.active === false ? "closed" : "done"} label={m.active === false ? "Deactivated" : "Active"} /> },
          ]}
          primaryAction={(m) => <Button size="sm" variant="outline" aria-label={`${m.active === false ? "Reactivate" : "Deactivate"} ${m.name}`} onClick={() => setDrawer({ kind: m.active === false ? "reactivate" : "deactivate", id: m.id })}>{m.active === false ? "Reactivate" : "Deactivate"}</Button>}
          moreActions={(m) => [{ label: "Change roles/sites", onSelect: () => setDrawer({ kind: "edit", id: m.id }) }]}
          emptyState="No staff members in this view."
        />
      </section>

      <AddDrawer open={drawer?.kind === "add"} onClose={() => setDrawer(null)} actor={actor} />
      <EditDrawer open={drawer?.kind === "edit"} id={drawer?.kind === "edit" ? drawer.id : undefined} onClose={() => setDrawer(null)} actor={actor} />
      <ReasonDrawer
        open={drawer?.kind === "deactivate" || drawer?.kind === "reactivate"}
        title={drawer?.kind === "deactivate" ? "Deactivate staff member" : "Reactivate staff member"}
        onClose={() => setDrawer(null)}
        onSubmit={(reason) => {
          if (!drawer || (drawer.kind !== "deactivate" && drawer.kind !== "reactivate")) return;
          const actionId = drawer.kind === "deactivate" ? "staff_deactivate" : "staff_reactivate";
          const r = runAction(actionId, actor, undefined, { args: [actor, { staffId: drawer.id, reason }] });
          if (r.ok) { toast.success(drawer.kind === "deactivate" ? "Staff member deactivated" : "Staff member reactivated"); setDrawer(null); }
          else toast.error(r.reason);
        }}
      />
    </div>
  );
}

function AddDrawer({ open, onClose, actor }: { open: boolean; onClose: () => void; actor: { role: StaffRole; staffId: string; staffName: string } }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("ecm_provider");
  const [reason, setReason] = useState("");
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent>
        <SheetHeader><SheetTitle>Add staff member</SheetTitle></SheetHeader>
        <div className="space-y-3 mt-4">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as StaffRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STAFF_ROLES.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Reason</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why add this person now" /></div>
          <Button
            onClick={() => {
              const id = `s-${Date.now()}`;
              const r = runAction("staff_add", actor, undefined, { args: [actor, { id, name, role }, reason] });
              if (r.ok) { toast.success("Staff member added"); onClose(); setName(""); setReason(""); }
              else toast.error(r.reason);
            }}
          >
            Add
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EditDrawer({ open, id, onClose, actor }: { open: boolean; id?: string; onClose: () => void; actor: { role: StaffRole; staffId: string; staffName: string } }) {
  const m = id ? STAFF_ROSTER.find((s) => s.id === id) : undefined;
  const [role, setRole] = useState<StaffRole | undefined>(m?.role);
  const [sites, setSites] = useState(m?.siteIds?.join(", ") ?? "");
  const [reason, setReason] = useState("");
  // §Group A #7 — the drawer stays mounted; selecting a different staff
  // member resets role, sites and reason to that member's own values.
  const [formFor, setFormFor] = useState(id);
  if (id && id !== formFor) {
    setFormFor(id);
    setRole(m?.role);
    setSites(m?.siteIds?.join(", ") ?? "");
    setReason("");
  }
  if (!m) return null;
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent>
        <SheetHeader><SheetTitle>Change roles/sites — {m.name}</SheetTitle></SheetHeader>
        <div className="space-y-3 mt-4">
          <div>
            <Label>Role</Label>
            <Select value={role ?? m.role} onValueChange={(v) => setRole(v as StaffRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STAFF_ROLES.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Site ids (comma separated)</Label><Input value={sites} onChange={(e) => setSites(e.target.value)} /></div>
          <div><Label>Reason</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <Button
            onClick={() => {
              const siteIds = sites.split(",").map((s) => s.trim()).filter(Boolean);
              const r = runAction("staff_update", actor, undefined, { args: [actor, { staffId: m.id, role, siteIds, reason }] });
              if (r.ok) { toast.success("Staff member updated"); onClose(); setReason(""); }
              else toast.error(r.reason);
            }}
          >
            Save
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ReasonDrawer({ open, title, onClose, onSubmit }: { open: boolean; title: string; onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent>
        <SheetHeader><SheetTitle>{title}</SheetTitle></SheetHeader>
        <div className="space-y-3 mt-4">
          <div><Label>Reason</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <Button onClick={() => { onSubmit(reason); setReason(""); }}>Confirm</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
