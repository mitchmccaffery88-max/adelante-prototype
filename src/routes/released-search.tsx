// §Custody tracking — Released Patient Search (cross-patient roster page).
//
// Modeled on case-manager.tsx's caseload table, NOT on the clinical record
// drawer: this is a population query, so it lives as a staff-facing page with
// its own route. Active / Released is a segmented toggle rather than two
// routes — the fields overlap almost entirely and staff flip between them
// while working one name, so a tab keeps the entered criteria in place.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { canAccess, useActingStaff } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClientDate } from "@/components/ClientDate";
import { ArrowLeft, Search } from "lucide-react";

export const Route = createFileRoute("/released-search")({
  head: () => ({
    meta: [
      { title: "Released patient search — Adelante" },
      {
        name: "description",
        content:
          "Search the client population by booking status, release date range, name, DOB, and program ID.",
      },
      { property: "og:title", content: "Released patient search — Adelante" },
      {
        property: "og:description",
        content: "Custody roster search across active and released clients.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReleasedSearchPage,
});

const dateOnly = { year: "numeric", month: "short", day: "numeric" } as const;
const EMPTY = {
  programId: "",
  lastName: "",
  firstName: "",
  dob: "",
  releasedFrom: "",
  releasedTo: "",
};

function ReleasedSearchPage() {
  const { role } = useActingStaff();
  const canWrite = canAccess(role, "custody_tracking").level === "write";
  const [mode, setMode] = useState<"released" | "active">("released");
  const [form, setForm] = useState(EMPTY);
  const [criteria, setCriteria] = useState(EMPTY);

  const released = useEhr(() => AdelanteEHR.searchReleasedPatients(criteria));
  const active = useEhr(() => AdelanteEHR.searchBookedPatients(criteria));

  if (!canWrite) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card className="p-6 text-sm text-muted-foreground">
          Released patient search is limited to case management and clinical coordination.
        </Card>
      </div>
    );
  }

  const set = (k: keyof typeof EMPTY) => (v: string) => setForm({ ...form, [k]: v });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-5">
      <Link to="/case-manager" className="text-xs text-teal inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Back to case manager
      </Link>
      <header>
        <h1 className="font-display text-2xl text-navy">Patient search</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search the whole population by custody status. Release dates are matched on calendar
          date, so a release recorded later in the day still matches its own date.
        </p>
      </header>

      <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
        <TabsList>
          <TabsTrigger value="released">Released</TabsTrigger>
          <TabsTrigger value="active">Active (currently booked)</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="grid gap-3 p-4 sm:grid-cols-3">
        <div>
          <Label className="text-xs">Account / program ID</Label>
          <Input value={form.programId} onChange={(e) => set("programId")(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Last name</Label>
          <Input value={form.lastName} onChange={(e) => set("lastName")(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">First name</Label>
          <Input value={form.firstName} onChange={(e) => set("firstName")(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">DOB</Label>
          <Input type="date" value={form.dob} onChange={(e) => set("dob")(e.target.value)} />
        </div>
        {mode === "released" && (
          <>
            <div>
              <Label className="text-xs">Released from</Label>
              <Input
                type="date"
                value={form.releasedFrom}
                onChange={(e) => set("releasedFrom")(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Released to (inclusive)</Label>
              <Input
                type="date"
                value={form.releasedTo}
                onChange={(e) => set("releasedTo")(e.target.value)}
              />
            </div>
          </>
        )}
        <div className="sm:col-span-3 flex gap-2">
          <Button size="sm" onClick={() => setCriteria(form)}>
            <Search className="mr-1.5 h-4 w-4" /> Search
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setForm(EMPTY);
              setCriteria(EMPTY);
            }}
          >
            Reset
          </Button>
        </div>
      </Card>

      {mode === "released" ? (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg text-navy">Released clients</h2>
            <Badge variant="outline">{released.length} match(es)</Badge>
          </div>
          {released.length === 0 ? (
            <p className="text-sm text-muted-foreground">No released clients match.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Program ID</TableHead>
                  <TableHead>DOB</TableHead>
                  <TableHead>Last release</TableHead>
                  <TableHead>Facility</TableHead>
                  <TableHead>Bookings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {released.map((r) => (
                  <TableRow key={r.patient.id}>
                    <TableCell>
                      <Link
                        to="/record/$patientId"
                        params={{ patientId: r.patient.id }}
                        className="text-teal underline-offset-2 hover:underline"
                      >
                        {r.patient.firstName} {r.patient.lastName}
                      </Link>
                    </TableCell>
                    <TableCell>{r.patient.programId}</TableCell>
                    <TableCell>{r.patient.dob}</TableCell>
                    <TableCell>
                      <ClientDate value={r.lastReleasedAt} options={dateOnly} />
                    </TableCell>
                    <TableCell>{r.facilityName}</TableCell>
                    <TableCell>{r.bookingCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      ) : (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg text-navy">Currently booked clients</h2>
            <Badge variant="outline">{active.length} match(es)</Badge>
          </div>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">No currently booked clients match.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Program ID</TableHead>
                  <TableHead>DOB</TableHead>
                  <TableHead>Booked</TableHead>
                  <TableHead>Facility</TableHead>
                  <TableHead>Housing unit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.map((r) => (
                  <TableRow key={r.patient.id}>
                    <TableCell>
                      <Link
                        to="/record/$patientId"
                        params={{ patientId: r.patient.id }}
                        className="text-teal underline-offset-2 hover:underline"
                      >
                        {r.patient.firstName} {r.patient.lastName}
                      </Link>
                    </TableCell>
                    <TableCell>{r.patient.programId}</TableCell>
                    <TableCell>{r.patient.dob}</TableCell>
                    <TableCell>
                      <ClientDate value={r.booking.bookedAt} options={dateOnly} />
                    </TableCell>
                    <TableCell>{r.booking.facilityName}</TableCell>
                    <TableCell>{r.housingUnit ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}
