// §Facility & Custody — filtered view over the EXISTING worklist rows.
//
// Not a parallel task system: these are ordinary `CaseTask` protocol rounds
// (CIWA/COWS/safety-cell) that carry the additive `facilityContext` tag set at
// generation time. Generation and scheduling are untouched; this page only
// filters. Gated on `custody_tracking`.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AdelanteEHR,
  useEhr,
  taskPriority,
  worklistStatusFor,
  type CaseTask,
} from "@/lib/ehr";
import { canAccess, useActingStaff } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
import { ClientDate } from "@/components/ClientDate";
import { EmptyState } from "@/components/EmptyState";
import { ArrowLeft, ClipboardList, Lock } from "lucide-react";

export const Route = createFileRoute("/facility-protocols")({
  head: () => ({
    meta: [
      { title: "Facility protocols — Adelante" },
      {
        name: "description",
        content:
          "Withdrawal and safety protocol rounds (CIWA/COWS) for patients in an open booking episode, filtered by facility and status.",
      },
      { property: "og:title", content: "Facility protocols — Adelante" },
      {
        property: "og:description",
        content: "CIWA/COWS rounds scoped to patients currently in custody.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FacilityProtocolsPage,
});

const ANY = "__any";

/** The one rule this view adds: a protocol round tagged with facility context. */
export function isFacilityProtocolRound(t: CaseTask): boolean {
  return Boolean(t.protocolInstanceId && t.facilityContext);
}

function FacilityProtocolsPage() {
  const { role } = useActingStaff();
  const access = canAccess(role, "custody_tracking");
  const [facilityId, setFacilityId] = useState(ANY);
  const [status, setStatus] = useState(ANY);

  const denied = access.level === "none";
  const tasks = useEhr(() => (denied ? [] : AdelanteEHR.listCaseTasks()));
  const patients = useEhr(() => (denied ? [] : AdelanteEHR.listPatients()));
  const facilities = useEhr(() => (denied ? [] : AdelanteEHR.listFacilities(true)));

  const rows = useMemo(
    () =>
      tasks
        .filter(isFacilityProtocolRound)
        .filter((t) => facilityId === ANY || t.facilityId === facilityId)
        .filter((t) => status === ANY || worklistStatusFor(t) === status)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [tasks, facilityId, status],
  );

  if (denied) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <EmptyState
          icon={Lock}
          title="Facility protocols are restricted"
          description="Your role doesn't have facility custody access."
        />
      </div>
    );
  }

  const nameFor = (id: string) => {
    const p = patients.find((x) => x.id === id);
    return p ? `${p.firstName} ${p.lastName}` : id;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <Link to="/worklist" className="inline-flex items-center gap-1 text-xs text-teal">
        <ArrowLeft className="h-3 w-3" /> Back to worklist
      </Link>
      <header>
        <h1 className="font-display text-2xl text-navy">Facility protocols</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          CIWA/COWS and safety-cell rounds generated while the patient was in an open booking
          episode. These are the same worklist rows, filtered — claiming and documenting still
          happen on the Worklist and in the chart.
        </p>
      </header>

      <Card className="grid gap-3 p-4 sm:grid-cols-3">
        <div>
          <Label className="text-xs">Facility</Label>
          <Select value={facilityId} onValueChange={setFacilityId}>
            <SelectTrigger aria-label="Facility">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All facilities</SelectItem>
              {facilities.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="missed">Missed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Badge variant="outline">{rows.length} round(s)</Badge>
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No facility protocol rounds"
          description="Rounds appear here once a protocol is started for a patient with an open booking episode."
        />
      ) : (
        <Card className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Round</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Facility</TableHead>
                <TableHead>Housing unit</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Link
                      to="/record/$patientId"
                      params={{ patientId: t.patientId }}
                      className="text-teal underline-offset-2 hover:underline"
                    >
                      {nameFor(t.patientId)}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell>
                    <ClientDate
                      value={t.dueDate}
                      options={{ month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }}
                    />
                  </TableCell>
                  <TableCell>
                    {facilities.find((f) => f.id === t.facilityId)?.name ?? "—"}
                  </TableCell>
                  <TableCell>{t.housingUnit ?? "—"}</TableCell>
                  <TableCell>{taskPriority(t)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{worklistStatusFor(t)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/facility-protocols')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/facility-protocols"!</div>
}
