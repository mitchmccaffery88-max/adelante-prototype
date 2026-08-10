// §Quality pass Group A — supervision administration.
//
// The single write path for `StaffMember.supervisedBy`. All validation lives in
// `assignSupervisor()` in roles.ts, which reuses `LPHA_SUPERVISOR_ROLES` — the
// same rule `supervisionStatus()` applies — so this screen cannot write a link
// the status function would then reject. Gated on the `staff_supervision`
// record class (sys_admin + clinical_coordinator write, LPHA tier read).
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  assignSupervisor,
  canAccess,
  supervisedStaff,
  supervisionStatus,
  supervisorCandidates,
  useActingStaff,
  useSupervisionStatus,
  STAFF_ROLES,
  STAFF_ROSTER,
} from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/EmptyState";
import { ArrowLeft, Lock, UserCheck } from "lucide-react";

export const Route = createFileRoute("/admin-supervision")({
  head: () => ({
    meta: [
      { title: "Supervision — Adelante Admin" },
      {
        name: "description",
        content:
          "Assign, change or clear the LPHA supervisor for Clinical Trainees, Medical Assistants and Community Health Workers, and see who is currently billable.",
      },
      { property: "og:title", content: "Supervision — Adelante Admin" },
      {
        property: "og:description",
        content: "Workforce supervision links and live billability for supervised roles.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupervisionAdminPage,
});

const NONE = "__none";
const roleLabel = (key: string) => STAFF_ROLES.find((r) => r.key === key)?.label ?? key;

function SupervisionAdminPage() {
  const { role, staffId, staffName } = useActingStaff();
  const access = canAccess(role, "staff_supervision");
  // Any accepted assignment bumps the supervision revision, so this page
  // re-renders from the same live source the clinician banner reads.
  useSupervisionStatus(staffId);
  const [error, setError] = useState<string | null>(null);

  if (access.level === "none") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          icon={Lock}
          title="Supervision admin is restricted"
          description="Only system admins and clinical coordinators manage supervision links."
        />
      </div>
    );
  }

  const canWrite = access.level === "write";
  const rows = supervisedStaff();
  const candidates = supervisorCandidates();

  function change(id: string, value: string) {
    const res = assignSupervisor(id, value === NONE ? null : value, {
      role,
      staffId,
      staffName,
    });
    if (!res.ok) {
      setError(res.reason ?? "Assignment rejected.");
      toast.error(res.reason ?? "Assignment rejected.");
      return;
    }
    setError(null);
    toast.success(
      res.status?.satisfied
        ? `Supervisor updated — ${roleLabel("")}work is billable.`.replace("work", "work")
        : "Supervisor cleared — this staff member's work is not billable.",
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
      <Link to="/admin" className="inline-flex items-center gap-1 text-xs text-teal">
        <ArrowLeft className="h-3 w-3" /> Back to admin
      </Link>
      <div>
        <h1 className="font-display text-2xl text-navy">Supervision</h1>
        <p className="text-sm text-muted-foreground">
          Clinical Trainees, Medical Assistants and Community Health Workers must be linked to an
          LPHA-tier supervisor (Therapist or PMHNP). Without one, their documentation is recorded
          but not billable.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          data-testid="supervision-assign-error"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <Card className="p-0">
        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No supervised staff" description="Nothing to configure." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Supervisor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => {
                const status = supervisionStatus(s.id);
                return (
                  <TableRow key={s.id} data-testid={`supervision-row-${s.id}`}>
                    <TableCell className="text-navy">
                      {s.name}
                      {s.credential ? (
                        <span className="ml-1 font-mono text-xs text-muted-foreground">
                          {s.credential}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">{roleLabel(s.role)}</TableCell>
                    <TableCell>
                      {canWrite ? (
                        <Select
                          value={s.supervisedBy ?? NONE}
                          onValueChange={(v) => change(s.id, v)}
                        >
                          <SelectTrigger
                            className="w-60"
                            aria-label={`Supervisor for ${s.name}`}
                          >
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Unassigned</SelectItem>
                            {candidates.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name} · {roleLabel(c.role)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-sm">
                          {STAFF_ROSTER.find((x) => x.id === s.supervisedBy)?.name ?? "Unassigned"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {status.satisfied ? (
                        <Badge className="gap-1">
                          <UserCheck className="h-3 w-3" /> Billable
                        </Badge>
                      ) : (
                        <div className="space-y-1">
                          <Badge variant="destructive">Not billable</Badge>
                          <p className="max-w-xs text-xs text-muted-foreground">{status.reason}</p>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {!canWrite && (
        <p className="text-xs text-muted-foreground">
          Read-only: your role can review supervision links but not change them.
        </p>
      )}
      <div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin-credentialing">Credentialing</Link>
        </Button>
      </div>
    </div>
  );
}