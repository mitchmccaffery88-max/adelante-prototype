// §v3.0 Phase 2 — CF Care Manager pre-release surface.
//
// PLACEHOLDER CONTENT WARNING: every form label and field below comes from
// PRE_RELEASE_FORMS in ehr.ts, which is an explicit placeholder set. DHCS's
// real SSApp / Pre-Release Screening / HRA / Level-of-Care layouts are not
// reproduced and not invented — see the warning on that constant.
//
// The checklist rows are ordinary CaseTask worklist rows (taskType
// "pre_release_form"); this page is a focused view of them, not a second task
// system. Release & consent forms deliberately have no fields here: they route
// to the ASCMI consent ledger.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  AdelanteEHR,
  useEhr,
  PRE_RELEASE_FORMS,
  PRE_RELEASE_FORM_CATEGORIES,
  type PreReleaseEpisode,
  type PreReleaseFormDef,
  type PreReleaseFormStatus,
  type ReentryAppointment,
  type ReentryAppointmentKind,
} from "@/lib/ehr";
import {
  canWritePreReleaseForm,
  canReadPreRelease,
  getStaffMember,
  staffForRole,
  useActingStaff,
} from "@/lib/roles";
import { resolveEpisodeEntry } from "@/lib/reentry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdvocateDesignationPanel } from "@/components/advocate/AdvocateDesignationPanel";
import { CapacityAuthorityStep } from "@/components/prerelease/CapacityAuthorityStep";
import { EmptyState } from "@/components/EmptyState";
import { ArrowLeft, CheckCircle2, KeyRound, Lock, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/pre-release")({
  head: () => ({
    meta: [
      { title: "Pre-release list — Adelante" },
      {
        name: "description",
        content:
          "CF Care Manager pre-release task list: Medi-Cal enrollment, clinical screening, consent capture and the Person-Centered Reentry Care Plan.",
      },
      { property: "og:title", content: "Pre-release list — Adelante" },
      {
        property: "og:description",
        content: "Track the four pre-release form categories through to a member-signed reentry plan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PreReleasePage,
});

const STATUS_TONE: Record<PreReleaseFormStatus, string> = {
  not_started: "bg-muted text-muted-foreground border-0",
  in_progress: "bg-warning/20 text-navy border-0",
  complete: "bg-success/15 text-success border-0",
};
const STATUS_LABEL: Record<PreReleaseFormStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete",
};

const APPT_KINDS: { key: ReentryAppointmentKind; label: string }[] = [
  { key: "mental_health", label: "Mental health" },
  { key: "med_management", label: "Medication management" },
  { key: "sud", label: "SUD" },
];

const fullName = (p?: { firstName: string; lastName: string }) =>
  p ? `${p.firstName} ${p.lastName}` : undefined;

function PreReleasePage() {
  const { role, staffId, staffName } = useActingStaff();
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const episodes = useEhr(() => AdelanteEHR.listPreReleaseEpisodes());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!canReadPreRelease(role)) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Lock}
          title="No access to the pre-release list"
          description="Reentry coordination is limited to care-coordination roles."
        />
      </div>
    );
  }

  const episode = episodes.find((e) => e.id === selectedId) ?? episodes[0];

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Pre-release list</h1>
          <p className="text-sm text-muted-foreground">
            D90 → D0 countdown. Placeholder DHCS form content — pending Christi&apos;s real field sets.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="p-3">
          <div className="mb-2 text-sm font-medium">Episodes</div>
          <div className="space-y-1">
            {episodes.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelectedId(e.id)}
                className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                  episode?.id === e.id ? "bg-muted font-medium" : "hover:bg-muted/60"
                }`}
              >
                {fullName(patients.find((p) => p.id === e.patientId)) ?? e.patientId}
                <span className="block text-xs text-muted-foreground">
                  Release {e.anticipatedReleaseDate}
                </span>
              </button>
            ))}
            {episodes.length === 0 && (
              <p className="px-2 py-3 text-sm text-muted-foreground">No open episodes yet.</p>
            )}
          </div>
          <OpenEpisodeForm />
        </Card>

        {episode ? (
          <EpisodePanel key={episode.id} episode={episode} />
        ) : (
          <Card className="p-6">
            <EmptyState
              icon={ShieldAlert}
              title="No pre-release episode selected"
              description="Open an episode to generate the four-category task list."
            />
          </Card>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Signed in as {staffName} ({role}); staff id {staffId}.
      </p>
    </div>
  );
}

function OpenEpisodeForm() {
  const { role, staffName } = useActingStaff();
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const cfStaff = staffForRole("cf_care_manager");
  // In-custody profile creation is the DEFAULT: for this population the CF
  // Care Manager usually meets someone who has no record here yet.
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [patientId, setPatientId] = useState<string>("");
  const [cfId, setCfId] = useState<string>(cfStaff[0]?.id ?? "");
  const [date, setDate] = useState("");

  const submit = () => {
    const cf = getStaffMember(cfId);
    if (!cf || !date || (mode === "existing" ? !patientId : !firstName.trim() || !lastName.trim())) {
      toast.error("Patient, CF Care Manager and anticipated release date are required.");
      return;
    }
    try {
      if (mode === "new") {
        AdelanteEHR.openPreReleaseEpisodeForNewPatient({
          firstName,
          lastName,
          ...(dob ? { dob } : {}),
          anticipatedReleaseDate: date,
          cfCareManagerStaffId: cf.id,
          cfCareManagerName: cf.name,
          openedBy: staffName,
          actorRole: role,
        });
        setFirstName("");
        setLastName("");
        setDob("");
        toast.success("Record created and pre-release episode opened.");
        return;
      }
      AdelanteEHR.openPreReleaseEpisode({
        patientId,
        anticipatedReleaseDate: date,
        cfCareManagerStaffId: cf.id,
        cfCareManagerName: cf.name,
        openedBy: staffName,
        actorRole: role,
      });
      toast.success("Pre-release episode opened — task list generated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open the episode.");
    }
  };

  return (
    <div className="mt-4 space-y-2 border-t pt-3">
      <div className="text-sm font-medium">Open an episode</div>
      <div className="flex gap-1">
        <Button
          size="sm"
          className="flex-1"
          variant={mode === "new" ? "default" : "outline"}
          data-testid="episode-mode-new"
          onClick={() => setMode("new")}
        >
          New person in custody
        </Button>
        <Button
          size="sm"
          className="flex-1"
          variant={mode === "existing" ? "default" : "outline"}
          data-testid="episode-mode-existing"
          onClick={() => setMode("existing")}
        >
          Existing record
        </Button>
      </div>
      {mode === "new" ? (
        <div className="space-y-2">
          <Input
            data-testid="new-first-name"
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <Input
            data-testid="new-last-name"
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          <Input
            type="date"
            aria-label="Date of birth"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
          />
        </div>
      ) : (
        <Select value={patientId} onValueChange={setPatientId}>
          <SelectTrigger>
            <SelectValue placeholder="Patient" />
          </SelectTrigger>
          <SelectContent>
            {patients.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.firstName} {p.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Select value={cfId} onValueChange={setCfId}>
        <SelectTrigger>
          <SelectValue placeholder="CF Care Manager" />
        </SelectTrigger>
        <SelectContent>
          {cfStaff.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name} ({s.accessMode})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <Button className="w-full" size="sm" onClick={submit}>
        {mode === "new" ? "Create record & open episode" : "Open episode"}
      </Button>
    </div>
  );
}

/**
 * Phase 1's dual access model, decided from the EPISODE's CF Care Manager.
 * Previously this only asked the proxy question when the owner was proxy-mode,
 * so an ECM Provider on a direct-mode owner's episode silently self-attributed.
 */
function useAttribution(episode: PreReleaseEpisode) {
  const { role, staffId, staffName } = useActingStaff();
  const subject = getStaffMember(episode.cfCareManagerStaffId);
  const result = resolveEpisodeEntry({
    actorStaffId: staffId,
    actorName: staffName,
    actorRole: role,
    episodeCfStaffId: episode.cfCareManagerStaffId,
  });
  return { ...result, needsProxy: result.mode === "proxy", subject };
}

function EpisodePanel({ episode }: { episode: PreReleaseEpisode }) {
  const rows = useEhr(() => AdelanteEHR.preReleaseChecklist(episode.id));
  const plan = useEhr(() => AdelanteEHR.getReentryCarePlan(episode.id));
  const patient = useEhr(() => AdelanteEHR.listPatients()).find((p) => p.id === episode.patientId);
  const { needsProxy, subject, ok, reason, attribution } = useAttribution(episode);
  const [openForm, setOpenForm] = useState<PreReleaseFormDef | null>(null);
  const [planOpen, setPlanOpen] = useState(false);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">{fullName(patient) ?? episode.patientId}</h2>
            <p className="text-sm text-muted-foreground">
              Anticipated release {episode.anticipatedReleaseDate} · CF Care Manager{" "}
              {episode.cfCareManagerName}
            </p>
          </div>
          {needsProxy && (
            <Badge variant="outline" data-testid="proxy-mode-badge">
              Proxy entry for {subject?.name}
            </Badge>
          )}
          {!ok && (
            <Badge variant="destructive" data-testid="proxy-blocked-badge">
              Entry blocked — {reason}
            </Badge>
          )}
        </div>
        {!ok && (
          <p
            data-testid="proxy-blocked-reason"
            className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
          >
            {reason} You can read this episode, but only {episode.cfCareManagerName} can record
            their own task-list and Reentry Care Plan activity.
          </p>
        )}
      </Card>

      {PRE_RELEASE_FORM_CATEGORIES.map((cat) => (
        cat.key === "capacity_authority" ? (
          <CapacityAuthorityStep
            key={cat.key}
            episode={episode}
            {...(attribution ? { attribution } : {})}
            {...(reason ? { entryBlockedReason: reason } : {})}
          />
        ) : (
        <Card key={cat.key} className="p-4">
          <div className="mb-1 font-medium">{cat.label}</div>
          <p className="mb-3 text-xs text-muted-foreground">{cat.helper}</p>
          <div className="space-y-2">
            {rows
              .filter((r) => r.def.category === cat.key)
              .map((r) => (
                <div
                  key={r.def.key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2"
                >
                  <div className="text-sm">
                    {r.def.label}
                    {r.record?.attribution.attributedTo && (
                      <span className="block text-xs text-muted-foreground">
                        Entered by {r.record.attribution.enteredBy.staffName} on behalf of{" "}
                        {r.record.attribution.attributedTo.staffName}
                      </span>
                    )}
                    {r.blocked && (
                      <span
                        data-testid={`blocked-${r.def.key}`}
                        className="mt-1 block text-xs text-destructive"
                      >
                        {r.blocked}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {r.blocked && <Badge variant="destructive">Blocked</Badge>}
                    <Badge className={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                    {r.def.consentCategory ? (
                      r.blocked ? (
                        <Button size="sm" variant="outline" disabled>
                          Capture in consent ledger
                        </Button>
                      ) : (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/consent">Capture in consent ledger</Link>
                      </Button>
                      )
                    ) : r.def.satisfiedByCarePlan ? (
                      <Button
                        size="sm"
                        disabled={!ok}
                        data-testid="open-care-plan"
                        onClick={() => setPlanOpen(true)}
                      >
                        {plan?.status === "completed" ? "View plan" : "Open care plan"}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!ok || Boolean(r.blocked)}
                        data-testid={`capture-${r.def.key}`}
                        onClick={() => setOpenForm(r.def)}
                      >
                        Capture
                      </Button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </Card>
        )
      ))}

      {plan?.enrollmentCode && (
        <Card className="p-4">
          <div className="flex items-center gap-2 font-medium">
            <KeyRound className="h-4 w-4" /> Enrollment code
          </div>
          <p className="mt-1 font-mono text-lg">{plan.enrollmentCode}</p>
          <p className="text-xs text-muted-foreground">
            Single-use, expires 90 days after issue. The member presents this to the receiving ECM
            Provider at D0 intake.
          </p>
        </Card>
      )}

      {/* §v3.0 Phase 4 — the CF Care Manager may designate an advocate on the
          member's behalf during pre-release intake. Same one-way designation
          rule as the patient surface: the invitation goes to the advocate's
          own contact, never through the member. */}
      {ok && (
        <AdvocateDesignationPanel
          patientId={episode.patientId}
          designatedBy={{ actor: "cf_care_manager", name: episode.cfCareManagerName }}
        />
      )}

      {openForm && attribution && (
        <FormDialog
          episode={episode}
          def={openForm}
          attribution={attribution}
          onClose={() => setOpenForm(null)}
        />
      )}
      {planOpen && attribution && (
        <CarePlanDialog
          episode={episode}
          attribution={attribution}
          onClose={() => setPlanOpen(false)}
        />
      )}
    </div>
  );
}

type Attribution = NonNullable<ReturnType<typeof resolveEpisodeEntry>["attribution"]>;

function FormDialog({
  episode,
  def,
  attribution,
  onClose,
}: {
  episode: PreReleaseEpisode;
  def: PreReleaseFormDef;
  attribution: Attribution;
  onClose: () => void;
}) {
  const { role } = useActingStaff();
  const existing = AdelanteEHR.getPreReleaseForm(episode.id, def.key);
  const [values, setValues] = useState<Record<string, string | boolean>>(existing?.values ?? {});
  const write = canWritePreReleaseForm(role, def.category);

  const save = (complete: boolean) => {
    try {
      AdelanteEHR.savePreReleaseForm({
        episodeId: episode.id,
        formKey: def.key,
        values,
        complete,
        attribution,
      });
      toast.success(complete ? "Form completed." : "Draft saved.");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{def.label}</DialogTitle>
          <DialogDescription>
            Placeholder field set — not DHCS&apos;s real form layout. Structured capture only; this
            is not clinical narrative documentation.
          </DialogDescription>
        </DialogHeader>
        {!write.allowed ? (
          <p className="text-sm text-muted-foreground">{write.reason}</p>
        ) : (
          <div className="space-y-3">
            {def.fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label htmlFor={`f-${f.key}`}>
                  {f.label}
                  {f.required ? " *" : ""}
                </Label>
                {f.type === "bool" ? (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`f-${f.key}`}
                      checked={Boolean(values[f.key])}
                      onCheckedChange={(v) => setValues((s) => ({ ...s, [f.key]: Boolean(v) }))}
                    />
                    <span className="text-sm text-muted-foreground">Yes</span>
                  </div>
                ) : f.type === "select" ? (
                  <Select
                    value={String(values[f.key] ?? "")}
                    onValueChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
                  >
                    <SelectTrigger id={`f-${f.key}`}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {(f.options ?? []).map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={`f-${f.key}`}
                    type={f.type === "date" ? "date" : "text"}
                    value={String(values[f.key] ?? "")}
                    onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => save(false)} disabled={!write.allowed}>
            Save draft
          </Button>
          <Button onClick={() => save(true)} disabled={!write.allowed}>
            Mark complete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CarePlanDialog({
  episode,
  attribution,
  onClose,
}: {
  episode: PreReleaseEpisode;
  attribution: Attribution;
  onClose: () => void;
}) {
  const plan = AdelanteEHR.getReentryCarePlan(episode.id);
  const locked = plan?.status === "completed";
  const [arrangement, setArrangement] = useState(plan?.housing.arrangement ?? "");
  const [address, setAddress] = useState(plan?.housing.address ?? "");
  const [contactName, setContactName] = useState(plan?.housing.contactName ?? "");
  const [contactPhone, setContactPhone] = useState(plan?.housing.contactPhone ?? "");
  const [pharmacyName, setPharmacyName] = useState(plan?.pharmacy?.name ?? "");
  const [dme, setDme] = useState((plan?.dmeNeeds ?? []).join(", "));
  const [notes, setNotes] = useState(plan?.notesToEcm ?? "");
  const [appts, setAppts] = useState<Omit<ReentryAppointment, "id">[]>(
    plan?.appointments.map(({ id: _id, ...rest }) => rest) ?? [],
  );
  const [signName, setSignName] = useState(plan?.memberSignature?.name ?? "");
  const [attested, setAttested] = useState(false);

  const addAppt = (kind: ReentryAppointmentKind) =>
    setAppts((s) => [
      ...s,
      { kind, start: "", providerName: "", location: "", modality: "in_person" },
    ]);

  const persist = () =>
    AdelanteEHR.saveReentryCarePlan({
      episodeId: episode.id,
      housing: { arrangement, address, contactName, contactPhone },
      appointments: appts,
      pharmacy: pharmacyName ? { name: pharmacyName } : undefined,
      dmeNeeds: dme
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      notesToEcm: notes,
      attribution,
    });

  const save = () => {
    try {
      persist();
      toast.success("Care plan saved.");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    }
  };

  const complete = () => {
    try {
      persist();
      const { enrollmentCode } = AdelanteEHR.completeReentryCarePlan({
        episodeId: episode.id,
        memberSignatureName: signName,
        attested,
        attribution,
      });
      toast.success(`Plan signed. Enrollment code ${enrollmentCode.code}`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete the plan.");
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Person-Centered Reentry Care Plan</DialogTitle>
          <DialogDescription>
            The hand-off artifact the receiving ECM Provider reads at D0. Appointments must be real
            scheduled visits, not referrals.
          </DialogDescription>
        </DialogHeader>

        {locked && (
          <div className="flex items-center gap-2 rounded-md border p-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success" />
            Member-signed {plan?.completedAt?.slice(0, 10)} · code{" "}
            <span className="font-mono">{plan?.enrollmentCode}</span>
          </div>
        )}

        <fieldset disabled={locked} className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Post-release housing</div>
            <Input
              placeholder="Arrangement (e.g. transitional housing bed)"
              value={arrangement}
              onChange={(e) => setArrangement(e.target.value)}
            />
            <Input
              placeholder="Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                placeholder="Contact name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
              <Input
                placeholder="Contact phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Scheduled first appointments</span>
              {APPT_KINDS.map((k) => (
                <Button key={k.key} size="sm" variant="outline" onClick={() => addAppt(k.key)}>
                  + {k.label}
                </Button>
              ))}
            </div>
            {appts.map((a, i) => (
              <div key={i} className="grid gap-2 rounded-md border p-2 sm:grid-cols-2">
                <div className="text-xs font-medium sm:col-span-2">
                  {APPT_KINDS.find((k) => k.key === a.kind)?.label}
                </div>
                <Input
                  type="datetime-local"
                  value={a.start}
                  onChange={(e) =>
                    setAppts((s) => s.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))
                  }
                />
                <Input
                  placeholder="Provider name"
                  value={a.providerName}
                  onChange={(e) =>
                    setAppts((s) =>
                      s.map((x, j) => (j === i ? { ...x, providerName: e.target.value } : x)),
                    )
                  }
                />
                <Input
                  placeholder="Location"
                  value={a.location}
                  onChange={(e) =>
                    setAppts((s) =>
                      s.map((x, j) => (j === i ? { ...x, location: e.target.value } : x)),
                    )
                  }
                />
                <Input
                  placeholder="Phone"
                  value={a.phone ?? ""}
                  onChange={(e) =>
                    setAppts((s) => s.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))
                  }
                />
              </div>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              placeholder="Pharmacy"
              value={pharmacyName}
              onChange={(e) => setPharmacyName(e.target.value)}
            />
            <Input
              placeholder="DME needs (comma separated)"
              value={dme}
              onChange={(e) => setDme(e.target.value)}
            />
          </div>
          <Textarea
            placeholder="Notes for the receiving ECM Provider"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="space-y-2 rounded-md border p-3">
            <div className="text-sm font-medium">Member signature</div>
            <Input
              placeholder="Typed member name"
              value={signName}
              onChange={(e) => setSignName(e.target.value)}
            />
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={attested} onCheckedChange={(v) => setAttested(Boolean(v))} />
              <span>
                The member reviewed this plan and attests to it. (Placeholder attestation wording —
                real language pending.)
              </span>
            </label>
          </div>
        </fieldset>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="outline" onClick={save} disabled={locked}>
            Save draft
          </Button>
          <Button onClick={complete} disabled={locked}>
            Complete &amp; issue enrollment code
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
