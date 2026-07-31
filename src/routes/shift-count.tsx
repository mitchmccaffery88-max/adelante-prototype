// §Shift count — controlled-substance reconciliation across the population.
//
// This page does NOT re-chart anything: it aggregates the MAR data that
// already exists (DoseAdministration joined to MedOrder.deaSchedule). Gated on
// `meds_erx` write — a controlled count is a medication-pass artifact, so the
// people who chart the pass are the people who count it (pmhnp today; the same
// class MAR itself uses). Clinical coordinators read it through the audit log.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { witnessCandidates } from "@/lib/mar";
import { canAccess, useActingStaff } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { ArrowLeft, Download, Lock } from "lucide-react";

export const Route = createFileRoute("/shift-count")({
  head: () => ({
    meta: [
      { title: "Controlled shift count — Adelante" },
      {
        name: "description",
        content:
          "Aggregate controlled-substance administrations for a shift window and lock the count with a two-person sign-off.",
      },
      { property: "og:title", content: "Controlled shift count — Adelante" },
      {
        property: "og:description",
        content: "Two-person controlled-substance reconciliation built on the MAR record.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShiftCountPage,
});

const SCHEDULES = ["all", "CII", "CIII", "CIV", "CV"];

/** Default window: today 07:00 local → tomorrow 07:00 local (the shift). */
function defaultWindow() {
  const start = new Date();
  start.setHours(7, 0, 0, 0);
  const end = new Date(start.getTime() + 86400_000);
  const local = (d: Date) =>
    new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  return { start: local(start), end: local(end) };
}

function csvEscape(v: string | number | undefined) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ShiftCountPage() {
  const { role, staffName } = useActingStaff();
  const canCount = canAccess(role, "meds_erx").level === "write";
  const initial = useMemo(defaultWindow, []);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [unit, setUnit] = useState("all");
  const [schedule, setSchedule] = useState("all");
  const [witness, setWitness] = useState("");
  const [notes, setNotes] = useState("");

  const windowStart = new Date(start).toISOString();
  const windowEnd = new Date(end).toISOString();

  const lines = useEhr(() =>
    AdelanteEHR.aggregateShiftCount({
      windowStart,
      windowEnd,
      housingUnit: unit === "all" ? undefined : unit,
      schedule,
    }),
  );
  const history = useEhr(() => AdelanteEHR.listShiftCounts(20));
  const units = useEhr(() =>
    [
      ...new Set(
        AdelanteEHR.listPatients()
          .map((p) => AdelanteEHR.currentHousingUnit(p.id))
          .filter(Boolean) as string[],
      ),
    ].sort(),
  );
  const witnesses = useMemo(() => witnessCandidates(staffName), [staffName]);

  const exportCsv = () => {
    const header = [
      "Drug",
      "Dose",
      "Schedule",
      "Given",
      "Refused/Held",
      "Patients",
      "First",
      "Last",
    ];
    const rows = lines.map((l) => [
      l.drugName,
      l.doseLabel,
      l.deaSchedule,
      l.given,
      l.refusedOrHeld,
      l.patients,
      l.firstAt ?? "",
      l.lastAt ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `shift-count-${start.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lock = () => {
    try {
      AdelanteEHR.lockShiftCount({
        windowStart,
        windowEnd,
        housingUnit: unit === "all" ? undefined : unit,
        schedule,
        counterName: staffName,
        witnessName: witness,
        notes,
      });
      toast.success("Shift count locked.");
      setWitness("");
      setNotes("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (!canCount) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card className="p-6 text-sm text-muted-foreground">
          Controlled shift counts are limited to clinical staff who chart the medication pass.
        </Card>
      </div>
    );
  }

  const totalGiven = lines.reduce((n, l) => n + l.given, 0);
  const totalRefused = lines.reduce((n, l) => n + l.refusedOrHeld, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-5">
      <Link to="/clinician" className="text-xs text-teal inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Back to clinician
      </Link>
      <header>
        <h1 className="font-display text-2xl text-navy">Controlled shift count</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aggregated from charted MAR administrations on orders carrying a DEA schedule. Nothing
          here re-charts a dose.
        </p>
      </header>

      <Card className="grid gap-3 p-4 sm:grid-cols-4">
        <div>
          <Label className="text-xs">Window start</Label>
          <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Window end</Label>
          <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Housing unit</Label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger aria-label="Housing unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All units</SelectItem>
              {units.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">DEA schedule</Label>
          <Select value={schedule} onValueChange={setSchedule}>
            <SelectTrigger aria-label="DEA schedule">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCHEDULES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "all" ? "All schedules" : s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg text-navy">Count</h2>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{totalGiven} given</Badge>
            <Badge variant="outline">{totalRefused} refused/held</Badge>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!lines.length}>
              <Download className="mr-1.5 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No controlled administrations charted in this window.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Drug</TableHead>
                <TableHead>Dose</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Given</TableHead>
                <TableHead>Refused / held</TableHead>
                <TableHead>Patients</TableHead>
                <TableHead>First</TableHead>
                <TableHead>Last</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => (
                <TableRow key={l.key}>
                  <TableCell className="font-medium">{l.drugName}</TableCell>
                  <TableCell>{l.doseLabel}</TableCell>
                  <TableCell>{l.deaSchedule}</TableCell>
                  <TableCell>{l.given}</TableCell>
                  <TableCell>{l.refusedOrHeld}</TableCell>
                  <TableCell>{l.patients}</TableCell>
                  <TableCell>
                    {l.firstAt ? <ClientDate value={l.firstAt} options={{ timeStyle: "short" }} /> : "—"}
                  </TableCell>
                  <TableCell>
                    {l.lastAt ? <ClientDate value={l.lastAt} options={{ timeStyle: "short" }} /> : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="font-display text-lg text-navy">Sign &amp; lock</h2>
        <p className="text-xs text-muted-foreground">
          Two-person sign-off. The counter is your acting identity; the witness must be someone
          else. A locked count is immutable — later charting never changes it.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Counter</Label>
            <Input value={staffName} readOnly />
          </div>
          <div>
            <Label className="text-xs">Witness</Label>
            <Select value={witness} onValueChange={setWitness}>
              <SelectTrigger aria-label="Witness">
                <SelectValue placeholder="Select witness" />
              </SelectTrigger>
              <SelectContent>
                {witnesses.map((w) => (
                  <SelectItem key={w.id} value={w.name}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-xs">Notes (optional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        <Button size="sm" onClick={lock} disabled={!witness}>
          <Lock className="mr-1.5 h-4 w-4" /> Sign &amp; lock count
        </Button>
      </Card>

      <Card className="p-4">
        <h2 className="font-display text-lg text-navy mb-3">Locked counts (last 20)</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No locked counts yet.</p>
        ) : (
          <div className="space-y-2 text-xs">
            {history.map((c) => (
              <div key={c.id} className="rounded-md border border-border p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{c.scheduleFilter}</Badge>
                  {c.housingUnit && <Badge variant="outline">{c.housingUnit}</Badge>}
                  <span className="font-medium">
                    <ClientDate value={c.windowStart} /> → <ClientDate value={c.windowEnd} />
                  </span>
                  <span className="text-muted-foreground">
                    {c.totalGiven} given · {c.totalRefusedOrHeld} refused/held · {c.lines.length}{" "}
                    line(s)
                  </span>
                </div>
                <div className="mt-1 text-muted-foreground">
                  Counted by {c.counterName}, witnessed by {c.witnessName} —{" "}
                  <ClientDate value={c.signedAt} />
                  {c.notes ? ` · ${c.notes}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
