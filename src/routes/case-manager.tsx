import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
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
  ShieldCheck,
  CheckCircle2,
  RotateCw,
  HelpingHand,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ClientDate } from "@/components/ClientDate";
import { useI18n } from "@/lib/i18n";
import { PatientProfileDialog } from "@/components/PatientProfileDialog";
import { ClientRecordDrawer } from "@/components/ClientRecordDrawer";

function lastContactAt(p: ReturnType<typeof AdelanteEHR.getPatient>) {
  const c = p?.checkIns?.[0];
  return c?.date;
}

function daysAgo(iso?: string) {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "1d ago";
  return `${d}d ago`;
}

function todayLocal() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nowLocalTime() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function combineDateTime(date: string, time: string): string | null {
  if (!date || !time) return null;
  const dt = new Date(`${date}T${time}`);
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

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
  const { t } = useI18n();
  const cms = useEhr(() => AdelanteEHR.listCaseManagers());
  const [cmId, setCmId] = useState(cms[0]?.id ?? "");
  const cm = cms.find((c) => c.id === cmId);
  const rawCaseload = useEhr(() =>
    cmId ? AdelanteEHR.patientsForCaseManager(cmId) : [],
  );
  const [query, setQuery] = useState("");
  const [dobFrom, setDobFrom] = useState("");
  const [dobTo, setDobTo] = useState("");
  const q = query.trim().toLowerCase();
  const caseload = rawCaseload.filter((p) => {
    if (q) {
      const name = `${p.firstName} ${p.lastName}`.toLowerCase();
      const cin = (p.cin ?? "").toLowerCase();
      const pid = p.programId.toLowerCase();
      const dob = (p.dob ?? "").toLowerCase();
      if (
        !name.includes(q) &&
        !cin.includes(q) &&
        !pid.includes(q) &&
        !dob.includes(q)
      )
        return false;
    }
    if (dobFrom || dobTo) {
      if (!p.dob) return false;
      if (dobFrom && p.dob < dobFrom) return false;
      if (dobTo && p.dob > dobTo) return false;
    }
    return true;
  });
  const [activeId, setActiveId] = useState<string | null>(rawCaseload[0]?.id ?? null);
  const active = useEhr(() =>
    activeId ? AdelanteEHR.getPatient(activeId) : undefined,
  );
  const [profileId, setProfileId] = useState<string | null>(null);
  const [recordId, setRecordId] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-teal">
            {t("navCaseManager")}
          </div>
          <h1 className="font-display text-3xl text-navy mt-1">{t("cmTitle")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("cmSubtitle")}</p>
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
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <Input
                placeholder="Name, CIN, program ID, or DOB (YYYY-MM-DD)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">DOB from</Label>
              <Input
                type="date"
                value={dobFrom}
                onChange={(e) => setDobFrom(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">DOB to</Label>
              <Input
                type="date"
                value={dobTo}
                onChange={(e) => setDobTo(e.target.value)}
                className="w-[160px]"
              />
            </div>
            {(dobFrom || dobTo || query) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setDobFrom("");
                  setDobTo("");
                }}
              >
                Clear
              </Button>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>CIN</TableHead>
                <TableHead>DOB</TableHead>
                <TableHead>Episode day</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Last contact</TableHead>
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
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {p.cin ? `••••${p.cin.slice(-4)}` : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {p.dob ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {p.episodeDay}/90
                  </TableCell>
                  <TableCell>
                    <CoverageBadge status={p.coverage?.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {(() => {
                      const iso = lastContactAt(p);
                      if (!iso) return <span className="text-destructive">No contact</span>;
                      const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
                      const stale = d > 7;
                      return (
                        <span className={stale ? "text-destructive" : ""}>
                          {daysAgo(iso)}
                        </span>
                      );
                    })()}
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
                    <div className="inline-flex gap-1">
                      <Button
                        size="sm"
                        variant={activeId === p.id ? "default" : "outline"}
                        onClick={() => setActiveId(p.id)}
                      >
                        Open
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setProfileId(p.id)}>
                        Profile
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setRecordId(p.id)}>
                        Record
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <div className="space-y-4">
          {active ? (
            <>
              <Card className="p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-display text-navy text-lg">
                    {active.firstName} {active.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Full record: SDOH, referrals, external coordination, peer notes.
                  </div>
                </div>
                <Button size="sm" onClick={() => setRecordId(active.id)}>
                  Open record
                </Button>
              </Card>
              <CheckInCard patientId={active.id} cm={cm?.name ?? ""} />
              <RecentCheckInsCard patientId={active.id} />
              <CoverageActionsCard patientId={active.id} />
              <EligibilityFlagsCard patientId={active.id} />
              <ResourceReferralCard patientId={active.id} consentSud={active.consents.part2Sud} />
              <RecentReferralsCard patientId={active.id} />
              <CoordinationCard patientName={`${active.firstName} ${active.lastName}`} consentSud={active.consents.part2Sud} />
            </>
          ) : (
            <Card className="p-6 text-sm text-muted-foreground">
              Pick a client to log a check-in.
            </Card>
          )}
        </div>
      </div>
      <PatientProfileDialog
        patientId={profileId}
        open={profileId !== null}
        onOpenChange={(o) => !o && setProfileId(null)}
      />
      <ClientRecordDrawer
        patientId={recordId}
        open={recordId !== null}
        onOpenChange={(o) => !o && setRecordId(null)}
      />
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
  const [date, setDate] = useState(() => todayLocal());
  const [time, setTime] = useState(() => nowLocalTime());
  return (
    <Card className="p-5">
      <h3 className="font-display text-lg text-navy flex items-center gap-2">
        <CalendarCheck className="h-4 w-4 text-teal" /> Weekly check-in
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Goal: weekly contact during active treatment. CM: {cm || "—"}.
      </p>
      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Time</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
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
            const iso = combineDateTime(date, time);
            if (!iso) {
              toast.error("Add date and time");
              return;
            }
            AdelanteEHR.addCheckIn(patientId, {
              date: iso,
              modality,
              attended,
              notes,
              needsFlagged: {},
            });
            setNotes("");
            setDate(todayLocal());
            setTime(nowLocalTime());
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
            AdelanteEHR.addResourceReferral(patientId, {
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

function CoverageActionsCard({ patientId }: { patientId: string }) {
  const p = useEhr(() => AdelanteEHR.getPatient(patientId));
  if (!p) return null;
  const status = p.coverage?.verified ?? "not_found";
  return (
    <Card className="p-5">
      <h3 className="font-display text-lg text-navy flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-teal" /> Medi-Cal actions
      </h3>
      <div className="mt-2 text-xs text-muted-foreground">
        Coverage: <span className="capitalize text-foreground">{p.coverage?.status ?? "unknown"}</span>{" "}
        · verification:{" "}
        <Badge variant="outline" className="capitalize text-[10px]">{status}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            AdelanteEHR.markCoverageVerified(patientId);
            toast.success("Marked verified");
          }}
          disabled={status === "verified"}
        >
          <CheckCircle2 className="h-4 w-4 mr-1.5" /> Mark verified
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            AdelanteEHR.requestReactivation(patientId);
            toast.success("Reactivation requested");
          }}
        >
          <RotateCw className="h-4 w-4 mr-1.5" /> Request reactivation
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            AdelanteEHR.addEnrollmentAssistTask(patientId);
            toast.success("Enrollment-assistance task created");
          }}
        >
          <HelpingHand className="h-4 w-4 mr-1.5" /> Send enrollment-assistance task
        </Button>
      </div>
    </Card>
  );
}

function EligibilityFlagsCard({ patientId }: { patientId: string }) {
  const p = useEhr(() => AdelanteEHR.getPatient(patientId));
  if (!p) return null;
  const ecm = Boolean(p.coverage?.ecmEligible);
  const ji = Boolean(p.coverage?.jiReentryFlag);
  const cs = p.coverage?.communitySupports ?? {};
  const csRows: { k: "housing" | "food" | "transport"; label: string }[] = [
    { k: "housing", label: "Housing support" },
    { k: "food", label: "Food / CalFresh" },
    { k: "transport", label: "Transportation" },
  ];
  return (
    <Card className="p-5">
      <h3 className="font-display text-lg text-navy">Eligibility flags</h3>
      <p className="text-xs text-muted-foreground mt-1">
        Toggle ECM, JI Reentry, and Community Supports for this client.
      </p>
      <div className="mt-3 space-y-2">
        <FlagRow
          label="ECM eligible"
          checked={ecm}
          onChange={(v) => AdelanteEHR.setEcmEligible(patientId, v)}
        />
        <FlagRow
          label="JI Reentry (90-day)"
          checked={ji}
          onChange={(v) => AdelanteEHR.setJiReentry(patientId, v)}
        />
        <div className="pt-2 border-t mt-2 text-xs uppercase tracking-wider text-muted-foreground">
          Community Supports
        </div>
        {csRows.map((r) => (
          <FlagRow
            key={r.k}
            label={r.label}
            checked={Boolean(cs[r.k])}
            onChange={(v) => AdelanteEHR.setCommunitySupport(patientId, r.k, v)}
          />
        ))}
      </div>
    </Card>
  );
}

function FlagRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border p-2.5 text-sm cursor-pointer">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function RecentCheckInsCard({ patientId }: { patientId: string }) {
  const p = useEhr(() => AdelanteEHR.getPatient(patientId));
  const items = (p?.checkIns ?? []).slice(0, 5);
  return (
    <Card className="p-5">
      <h3 className="font-display text-lg text-navy flex items-center gap-2">
        <CalendarCheck className="h-4 w-4 text-teal" /> Recent check-ins
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No check-ins yet for this client.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {items.map((c) => (
            <li key={c.id} className="border-b last:border-0 pb-2 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <span className="capitalize text-navy">{c.modality.replace("_", " ")}</span>
                <span className="text-xs text-muted-foreground">
                  <ClientDate value={c.date} />
                </span>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                {c.attended ? (
                  <Badge className="bg-success/20 text-success border-0 text-[10px]">Attended</Badge>
                ) : (
                  <Badge className="bg-destructive/15 text-destructive border-0 text-[10px]">Missed</Badge>
                )}
                {c.notes && <span className="truncate">{c.notes}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RecentReferralsCard({ patientId }: { patientId: string }) {
  const p = useEhr(() => AdelanteEHR.getPatient(patientId));
  const items = (p?.resourceReferrals ?? []).slice(0, 5);
  if (items.length === 0) return null;
  return (
    <Card className="p-5">
      <h3 className="font-display text-lg text-navy flex items-center gap-2">
        <HandHeart className="h-4 w-4 text-teal" /> Recent referrals
      </h3>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((r) => (
          <li key={r.id} className="flex items-center justify-between border-b last:border-0 pb-2 last:pb-0">
            <div>
              <div className="text-navy capitalize">{r.category}</div>
              <div className="text-xs text-muted-foreground">{r.provider}</div>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="capitalize text-[10px]">{r.status}</Badge>
              <div className="text-[10px] text-muted-foreground mt-1">
                <ClientDate value={r.createdAt} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}