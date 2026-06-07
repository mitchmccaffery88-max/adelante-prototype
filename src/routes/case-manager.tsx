import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HealthieService, useHealthie } from "@/lib/healthie";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { toast } from "sonner";
import {
  Users,
  CalendarCheck,
  HandHeart,
  Lock,
  AlertTriangle,
  Phone,
} from "lucide-react";
import { ClientDate } from "@/components/ClientDate";

export const Route = createFileRoute("/case-manager")({
  head: () => ({
    meta: [
      { title: "Case Manager — Adelante" },
      {
        name: "description",
        content:
          "Non-clinical caseload, weekly check-ins, resource referrals, and external coordination.",
      },
    ],
  }),
  component: CaseManagerPage,
});

function CaseManagerPage() {
  const cms = useHealthie(() => HealthieService.listCaseManagers());
  const [cmId, setCmId] = useState(cms[0]?.id ?? "");
  const cm = cms.find((c) => c.id === cmId);
  const caseload = useHealthie(() =>
    cmId ? HealthieService.patientsForCaseManager(cmId) : [],
  );
  const [activeId, setActiveId] = useState<string | null>(caseload[0]?.id ?? null);
  const active = useHealthie(() =>
    activeId ? HealthieService.getPatient(activeId) : undefined,
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-teal">
            Case Manager / Peer Support
          </div>
          <h1 className="font-display text-3xl text-navy mt-1">My caseload</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Non-clinical view — no diagnoses, no clinical notes.
          </p>
        </div>
        <Select value={cmId} onValueChange={setCmId}>
          <SelectTrigger className="w-[280px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {cms.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} · {c.role.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg text-navy flex items-center gap-2">
              <Users className="h-4 w-4 text-teal" /> Caseload
            </h2>
            <Badge variant="outline">{caseload.length} clients</Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Episode day</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {caseload.map((p) => (
                <TableRow
                  key={p.id}
                  data-state={activeId === p.id ? "selected" : undefined}
                >
                  <TableCell className="font-medium text-navy">
                    {p.firstName} {p.lastName}
                  </TableCell>
                  <TableCell className="text-xs">
                    {p.episodeDay}/90
                  </TableCell>
                  <TableCell>
                    <CoverageBadge status={p.coverage?.status} />
                  </TableCell>
                  <TableCell className="space-x-1">
                    {p.crisisFlag && (
                      <Badge className="bg-destructive/15 text-destructive border-0 inline-flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Crisis
                      </Badge>
                    )}
                    {p.coverage?.ecmEligible && (
                      <Badge className="bg-teal/15 text-teal border-0">
                        ECM
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant={activeId === p.id ? "default" : "outline"}
                      onClick={() => setActiveId(p.id)}
                    >
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <div className="space-y-4">
          {active ? (
            <>
              <CheckInCard patientId={active.id} cm={cm?.name ?? ""} />
              <ResourceReferralCard patientId={active.id} consentSud={active.consents.part2Sud} />
              <CoordinationCard patientName={`${active.firstName} ${active.lastName}`} consentSud={active.consents.part2Sud} />
            </>
          ) : (
            <Card className="p-6 text-sm text-muted-foreground">
              Pick a client to log a check-in.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function CoverageBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  const styles: Record<string, string> = {
    active: "bg-success/20 text-success",
    suspended: "bg-gold/30 text-navy",
    none_unsure: "bg-destructive/15 text-destructive",
    other: "bg-muted text-muted-foreground",
  };
  const labels: Record<string, string> = {
    active: "Active",
    suspended: "Suspended",
    none_unsure: "Assistance",
    other: "Other",
  };
  return (
    <Badge className={`${styles[status] ?? ""} border-0 text-xs`}>
      {labels[status] ?? status}
    </Badge>
  );
}

function CheckInCard({ patientId, cm }: { patientId: string; cm: string }) {
  const [modality, setModality] = useState<"video" | "phone" | "in_person" | "sms">("phone");
  const [attended, setAttended] = useState(true);
  const [notes, setNotes] = useState("");
  return (
    <Card className="p-5">
      <h3 className="font-display text-lg text-navy flex items-center gap-2">
        <CalendarCheck className="h-4 w-4 text-teal" /> Weekly check-in
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Goal: weekly contact during active treatment. CM: {cm || "—"}.
      </p>
      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-sm">Modality</Label>
          <Select value={modality} onValueChange={(v) => setModality(v as typeof modality)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="phone">Phone</SelectItem>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="in_person">In-person</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={attended} onCheckedChange={(v) => setAttended(Boolean(v))} />
          Attended
        </label>
        <div className="space-y-1.5">
          <Label className="text-sm">Brief non-clinical notes</Label>
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. confirmed housing intake Friday; needs bus pass."
          />
        </div>
        <Button
          className="w-full bg-navy text-navy-foreground hover:bg-navy/90"
          onClick={() => {
            HealthieService.addCheckIn(patientId, {
              date: new Date().toISOString(),
              modality,
              attended,
              notes,
              needsFlagged: {},
            });
            setNotes("");
            toast.success("Check-in logged");
          }}
        >
          Log check-in
        </Button>
      </div>
    </Card>
  );
}

function ResourceReferralCard({
  patientId,
  consentSud,
}: {
  patientId: string;
  consentSud: boolean;
}) {
  const [category, setCategory] = useState<"housing" | "food" | "employment" | "legal" | "benefits" | "transport">("housing");
  const [provider, setProvider] = useState("");
  return (
    <Card className="p-5">
      <h3 className="font-display text-lg text-navy flex items-center gap-2">
        <HandHeart className="h-4 w-4 text-teal" /> Resource referral
      </h3>
      <div className="mt-4 space-y-3">
        <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="housing">Housing</SelectItem>
            <SelectItem value="food">Food</SelectItem>
            <SelectItem value="employment">Employment</SelectItem>
            <SelectItem value="legal">Legal</SelectItem>
            <SelectItem value="benefits">Benefits / Medi-Cal</SelectItem>
            <SelectItem value="transport">Transportation</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Provider name"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        />
        <Button
          className="w-full"
          variant="outline"
          onClick={() => {
            if (!provider) return toast.error("Add a provider name");
            HealthieService.addResourceReferral(patientId, {
              category,
              provider,
              sudDisclosureConsent: consentSud,
            });
            setProvider("");
            toast.success("Referral created");
          }}
        >
          Create referral
        </Button>
        <div className="text-xs text-muted-foreground flex items-start gap-1.5 pt-1">
          <Lock className="h-3 w-3 mt-0.5 text-teal" />
          A searchable resource library lands in Build 2. For now, log manually.
        </div>
      </div>
    </Card>
  );
}

function CoordinationCard({
  patientName,
  consentSud,
}: {
  patientName: string;
  consentSud: boolean;
}) {
  return (
    <Card className="p-5">
      <h3 className="font-display text-lg text-navy flex items-center gap-2">
        <Phone className="h-4 w-4 text-teal" /> External coordination
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Contact log with probation, parole, housing partners for {patientName}.
      </p>
      {!consentSud && (
        <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs flex items-start gap-2">
          <Lock className="h-3.5 w-3.5 text-destructive mt-0.5" />
          <span>
            <strong>42 CFR Part 2 guardrail:</strong> SUD-identifying detail
            cannot be shared with probation/parole without specific patient consent.
          </span>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Logged: <ClientDate value={new Date().toISOString()} /> (demo)
      </p>
    </Card>
  );
}