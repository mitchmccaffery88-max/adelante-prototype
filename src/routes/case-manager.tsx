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
  ClipboardList,
  Plus,
  Clock,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ClientDate } from "@/components/ClientDate";
import { useI18n } from "@/lib/i18n";
import { PatientProfileDialog } from "@/components/PatientProfileDialog";
import { ClientRecordDrawer } from "@/components/ClientRecordDrawer";
import { TimePicker } from "@/components/TimePicker";

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
        <div className="lg:col-span-3">
          {cmId && <TaskQueueCard cmId={cmId} onOpenPatient={setActiveId} />}
        </div>
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
                    {(() => {
                      const pending = AdelanteEHR.listProviderSwitches({
                        patientId: p.id,
                        status: "pending_review",
                      }).length;
                      return pending > 0 ? (
                        <Badge className="bg-warning/20 text-warning-foreground border-0" title="Pending provider switch review">
                          Switch·{pending}
                        </Badge>
                      ) : null;
                    })()}
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
              {cmId && <PatientTasksCard patientId={active.id} cmId={cmId} />}
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
  const [dateError, setDateError] = useState<string | undefined>();
  const [timeError, setTimeError] = useState<string | undefined>();
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
            <Input
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); setDateError(undefined); }}
              aria-invalid={Boolean(dateError)}
              className={dateError ? "ring-2 ring-destructive border-destructive" : undefined}
            />
            {dateError && <p className="text-xs text-destructive">{dateError}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Time</Label>
            <TimePicker
              id="checkin-time"
              value={time}
              onChange={(v) => { setTime(v); setTimeError(undefined); }}
              error={timeError}
              ariaLabel="Check-in time"
            />
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
            setDateError(undefined);
            setTimeError(undefined);
            if (!date) { setDateError("Pick a date"); return; }
            if (!time) { setTimeError("Pick a time"); return; }
            const iso = combineDateTime(date, time);
            if (!iso) { setTimeError("That time isn't valid"); return; }
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

function TaskQueueCard({
  cmId,
  onOpenPatient,
}: {
  cmId: string;
  onOpenPatient: (id: string) => void;
}) {
  const tasks = useEhr(() => AdelanteEHR.caseTasksForCM(cmId));
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const open = tasks.filter((t) => t.status === "open");
  const snoozed = tasks.filter((t) => t.status === "snoozed");
  const now = Date.now();
  const overdue = open.filter((t) => +new Date(t.dueDate) < now - 86400000);
  const dueToday = open.filter(
    (t) => t.dueDate.slice(0, 10) === new Date().toISOString().slice(0, 10),
  );

  const [showDone, setShowDone] = useState(false);
  const list = showDone ? tasks : open;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="font-display text-lg text-navy flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-teal" /> My tasks
        </h2>
        <div className="flex items-center gap-2 text-xs">
          <Badge className="bg-destructive/15 text-destructive border-0">{overdue.length} overdue</Badge>
          <Badge className="bg-gold/25 text-navy border-0">{dueToday.length} due today</Badge>
          <Badge variant="outline">{snoozed.length} snoozed</Badge>
          <Button size="sm" variant="ghost" onClick={() => setShowDone((v) => !v)}>
            {showDone ? "Hide done" : "Show all"}
          </Button>
        </div>
      </div>
      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nothing on the queue. New tasks appear here after no-shows, crisis flags, or failed messages.
        </div>
      ) : (
        <ul className="space-y-2">
          {list.slice(0, 12).map((t) => {
            const p = patients.find((x) => x.id === t.patientId);
            const overdueTask = t.status === "open" && +new Date(t.dueDate) < now - 86400000;
            return (
              <li
                key={t.id}
                className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-sm ${
                  overdueTask ? "border-destructive/40 bg-destructive/5" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-navy">{t.title}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {t.origin.replace("_", " ")}
                    </Badge>
                    {t.status !== "open" && (
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {t.status}
                      </Badge>
                    )}
                  </div>
                  {t.detail && <div className="text-xs text-muted-foreground mt-0.5">{t.detail}</div>}
                  <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2">
                    {p && (
                      <button className="underline" onClick={() => onOpenPatient(p.id)}>
                        {p.firstName} {p.lastName}
                      </button>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Due {t.dueDate.slice(0, 10)}
                    </span>
                  </div>
                </div>
                {t.status === "open" && (
                  <div className="shrink-0 flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => AdelanteEHR.snoozeCaseTask(t.id, 3)}>
                      Snooze 3d
                    </Button>
                    <Button size="sm" onClick={() => AdelanteEHR.completeCaseTask(t.id)}>
                      Done
                    </Button>
                  </div>
                )}
                {t.status !== "open" && (
                  <Button size="sm" variant="ghost" onClick={() => AdelanteEHR.reopenCaseTask(t.id)}>
                    Reopen
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function PatientTasksCard({ patientId, cmId }: { patientId: string; cmId: string }) {
  const tasks = useEhr(() =>
    AdelanteEHR.caseTasksForPatient(patientId).filter((t) => t.status === "open"),
  );
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [due, setDue] = useState(() => todayLocal());

  function add() {
    if (!title.trim()) {
      toast.error("Give the task a short title.");
      return;
    }
    AdelanteEHR.createCaseTask({
      patientId,
      assignedTo: cmId,
      title: title.trim(),
      detail: detail.trim() || undefined,
      dueDate: due,
      origin: "manual",
    });
    setTitle("");
    setDetail("");
    toast.success("Task added.");
  }

  return (
    <Card className="p-5">
      <h3 className="font-display text-navy flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-teal" /> Follow-ups for this client
      </h3>
      {tasks.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No open tasks for this client.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-2 border-b last:border-0 pb-2 last:pb-0">
              <div>
                <div className="text-navy">{t.title}</div>
                {t.detail && <div className="text-xs text-muted-foreground">{t.detail}</div>}
                <div className="text-[10px] text-muted-foreground mt-0.5">Due {t.dueDate.slice(0, 10)} · {t.origin.replace("_", " ")}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => AdelanteEHR.completeCaseTask(t.id)}>
                Done
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 space-y-2">
        <Label className="text-xs text-muted-foreground">Add follow-up</Label>
        <Input placeholder="Short title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea rows={2} placeholder="Details (optional)" value={detail} onChange={(e) => setDetail(e.target.value)} />
        <div className="flex items-center gap-2">
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-[160px]" />
          <Button size="sm" onClick={add} className="ml-auto">
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </div>
    </Card>
  );
}