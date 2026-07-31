// §Facility management — the admin surface for the facility registry.
//
// Facilities are the reporting key for bookings and housing moves, so this
// page is deliberately conservative: creation refuses normalized-name
// duplicates, deactivation and merges both require a reason, and merging
// repoints history rather than deleting anything.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AdelanteEHR,
  FACILITY_KINDS,
  facilityKindLabel,
  useEhr,
  type Facility,
  type FacilityKind,
} from "@/lib/ehr";
import { canAccess, useActingStaff } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Building2, GitMerge, Lock, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/admin-facilities")({
  head: () => ({
    meta: [
      { title: "Facility registry — Adelante Admin" },
      {
        name: "description",
        content:
          "Create, edit, deactivate and merge clinics, jails, prisons and partner sites so custody reporting keeps one id per facility.",
      },
      { property: "og:title", content: "Facility registry — Adelante Admin" },
      {
        property: "og:description",
        content:
          "Manage facility types and identifiers, and merge duplicate sites without losing booking history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminFacilitiesPage,
});

const BLANK = { name: "", kind: "clinic" as FacilityKind, city: "", timezone: "" };

function AdminFacilitiesPage() {
  const { role, staffName } = useActingStaff();
  const access = canAccess(role, "custody_tracking");
  const canWrite = access.level === "write";

  const facilities = useEhr(() => AdelanteEHR.listFacilities(true));
  const bookings = useEhr(() => AdelanteEHR.listBookings());
  const moves = useEhr(() => AdelanteEHR.listHousingMoves());

  const [kindFilter, setKindFilter] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(true);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(BLANK);
  const [editing, setEditing] = useState<Facility | null>(null);
  const [merging, setMerging] = useState<Facility | null>(null);

  const rows = useMemo(
    () =>
      facilities
        .filter((f) => (showInactive ? true : f.active))
        .filter((f) => kindFilter === "all" || f.kind === kindFilter)
        .map((f) => ({
          facility: f,
          bookings: bookings.filter((b) => b.facilityId === f.id).length,
          currentlyBooked: bookings.filter((b) => b.facilityId === f.id && !b.releasedAt).length,
          housingMoves: moves.filter((m) => m.facilityId === f.id).length,
        })),
    [facilities, bookings, moves, kindFilter, showInactive],
  );

  const create = () => {
    try {
      const f = AdelanteEHR.createFacility(draft, staffName);
      toast.success(`Created ${f.name}`);
      setDraft(BLANK);
      setCreating(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (access.level === "none") {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <EmptyState
          icon={Lock}
          title="Facility registry is restricted"
          description={access.reason ?? "Your role can't view the facility registry."}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <Link to="/admin" className="inline-flex items-center gap-1 text-xs text-teal">
        <ArrowLeft className="h-3 w-3" /> Back to admin
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy">Facility registry</h1>
          <p className="text-sm text-muted-foreground">
            One id per site. Bookings and housing moves group on the id, so merging duplicates
            repairs reporting without touching history.
          </p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-1 h-4 w-4" /> New facility
          </Button>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="h-8 w-[200px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All facility types</SelectItem>
            {FACILITY_KINDS.map((k) => (
              <SelectItem key={k.key} value={k.key}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant={showInactive ? "secondary" : "outline"}
          onClick={() => setShowInactive((v) => !v)}
        >
          {showInactive ? "Showing inactive" : "Active only"}
        </Button>
      </div>

      <Card className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Facility</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>City</TableHead>
              <TableHead className="text-right">Bookings</TableHead>
              <TableHead className="text-right">Currently in</TableHead>
              <TableHead className="text-right">Moves</TableHead>
              <TableHead className="w-[1%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ facility: f, bookings: b, currentlyBooked, housingMoves }) => (
              <TableRow key={f.id} className={f.active ? undefined : "opacity-60"}>
                <TableCell>
                  <div className="flex items-center gap-2 font-medium text-navy">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    {f.name}
                    {!f.active && (
                      <Badge variant="outline" className="text-[10px]">
                        inactive
                      </Badge>
                    )}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">{f.id}</div>
                </TableCell>
                <TableCell className="text-sm">{facilityKindLabel(f.kind)}</TableCell>
                <TableCell className="text-sm">{f.city ?? "—"}</TableCell>
                <TableCell className="text-right text-sm">{b}</TableCell>
                <TableCell className="text-right text-sm">{currentlyBooked}</TableCell>
                <TableCell className="text-right text-sm">{housingMoves}</TableCell>
                <TableCell>
                  {canWrite && (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(f)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setMerging(f)}>
                        <GitMerge className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  No facilities match this filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New facility</DialogTitle>
            <DialogDescription>
              Names are matched loosely (case, dashes and spacing are ignored), so a near-duplicate
              is rejected instead of creating a second reporting bucket.
            </DialogDescription>
          </DialogHeader>
          <FacilityFields value={draft} onChange={setDraft} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button onClick={create} disabled={!draft.name.trim()}>
              Create facility
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editing && (
        <EditDialog
          facility={editing}
          staffName={staffName}
          onClose={() => setEditing(null)}
        />
      )}
      {merging && (
        <MergeDialog
          source={merging}
          candidates={facilities.filter((f) => f.id !== merging.id)}
          staffName={staffName}
          onClose={() => setMerging(null)}
        />
      )}
    </div>
  );
}

type Draft = typeof BLANK;

function FacilityFields({
  value,
  onChange,
}: {
  value: Draft;
  onChange: (next: Draft) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="fac-name">Name</Label>
        <Input
          id="fac-name"
          value={value.name}
          placeholder="Fresno County Jail — Main"
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="fac-kind">Facility type</Label>
        <Select
          value={value.kind}
          onValueChange={(k) => onChange({ ...value, kind: k as FacilityKind })}
        >
          <SelectTrigger id="fac-kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FACILITY_KINDS.map((k) => (
              <SelectItem key={k.key} value={k.key}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="fac-city">City</Label>
          <Input
            id="fac-city"
            value={value.city}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="fac-tz">Timezone</Label>
          <Input
            id="fac-tz"
            value={value.timezone}
            placeholder="America/Los_Angeles"
            onChange={(e) => onChange({ ...value, timezone: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

function EditDialog({
  facility,
  staffName,
  onClose,
}: {
  facility: Facility;
  staffName: string;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>({
    name: facility.name,
    kind: facility.kind,
    city: facility.city ?? "",
    timezone: facility.timezone ?? "",
  });
  const [reason, setReason] = useState("");

  const save = () => {
    try {
      AdelanteEHR.updateFacility(facility.id, draft, staffName);
      toast.success("Facility updated");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const toggleActive = () => {
    try {
      AdelanteEHR.setFacilityActive(facility.id, !facility.active, reason, staffName);
      toast.success(facility.active ? "Facility deactivated" : "Facility reactivated");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {facility.name}</DialogTitle>
          <DialogDescription>
            Historical bookings keep the name they were recorded under; the id and future writes
            follow this record.
          </DialogDescription>
        </DialogHeader>
        <FacilityFields value={draft} onChange={setDraft} />
        <div className="rounded-md border border-border p-3">
          <Label htmlFor="fac-active-reason" className="text-xs">
            {facility.active ? "Reason for deactivating" : "Reason for reactivating"}
          </Label>
          <Input
            id="fac-active-reason"
            value={reason}
            placeholder="Site closed, contract ended…"
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            className="mt-2"
            size="sm"
            variant={facility.active ? "destructive" : "secondary"}
            disabled={!reason.trim()}
            onClick={toggleActive}
          >
            {facility.active ? "Deactivate facility" : "Reactivate facility"}
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!draft.name.trim()}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MergeDialog({
  source,
  candidates,
  staffName,
  onClose,
}: {
  source: Facility;
  candidates: Facility[];
  staffName: string;
  onClose: () => void;
}) {
  const [targetId, setTargetId] = useState<string>("");
  const [reason, setReason] = useState("");

  const merge = () => {
    try {
      const r = AdelanteEHR.mergeFacilities(source.id, targetId, reason, staffName);
      toast.success(`Merged into ${r.target.name}`, {
        description: `${r.bookings} booking(s) and ${r.housingMoves} housing move(s) repointed.`,
      });
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Merge “{source.name}”</DialogTitle>
          <DialogDescription>
            Every booking and housing move recorded under this facility is repointed to the
            surviving facility, and this one is deactivated. Nothing is deleted.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="merge-target">Surviving facility</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger id="merge-target">
                <SelectValue placeholder="Choose a facility…" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name} · {facilityKindLabel(f.kind)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="merge-reason">Reason</Label>
            <Input
              id="merge-reason"
              value={reason}
              placeholder="Duplicate created by typo during intake"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={merge} disabled={!targetId || !reason.trim()}>
            Merge facilities
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}