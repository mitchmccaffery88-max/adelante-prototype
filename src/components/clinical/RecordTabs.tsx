// §Clinical record tab bodies — extracted from ClientRecordDrawer so the
// quick-peek drawer and the full-page chart render the SAME components.
// Do not fork a second copy of any tab body here or anywhere else.
import { useMemo, useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AdelanteEHR,
  useEhr,
  isNoteSudSensitive,
  noteStatus,
  type CoordinationChannel,
  type CoordinationDirection,
  type ExternalPartyRole,
  type ResourceReferral,
  type SdohStatus,
  type PeerNote,
  type CaseTask,
  type ProgressNote,
  type NoteStatus,
} from "@/lib/ehr";
import { cosignerCandidates, requiresCosign } from "@/lib/notes";
import { downloadProgressNotePdf, noteExportGate } from "@/lib/notePdf";
import { TemplateForm } from "@/components/clinical/TemplateForm";
import { findMissingRequired, type TemplateAnswers } from "@/lib/templateSchema";
import { NoteTemplatePicker } from "@/components/clinical/NoteTemplatePicker";
import {
  useActingRole,
  useActingStaff,
  getStaffMember,
  canAccess,
  type RecordClass,
} from "@/lib/roles";
import { SCREENERS, severityFor } from "@/lib/screeners";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { ClientDate } from "@/components/ClientDate";
import { toast } from "sonner";
import { Lock, ShieldAlert, Eye, EyeOff, Trash2, Plus, ClipboardList, Download } from "lucide-react";
import { TimePicker } from "@/components/TimePicker";
import { EmptyState } from "@/components/EmptyState";
import { CarePlanCard } from "@/components/CarePlanCard";
import { AssignClinicianButton } from "@/components/AssignClinicianButton";
import { ReferralStatusTimeline } from "@/components/ReferralStatusTimeline";
import { useDraftDirty } from "@/lib/drawer-drafts";
import { ProblemsTab, AllergiesTab, AlertsTab } from "@/components/clinical/ClinicalRecordTabs";
import { OrdersTab } from "@/components/clinical/OrdersTab";
import { AlertTriangle, HeartPulse } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function LockedNote({ reason }: { reason?: string }) {
  return (
    <Card className="p-4 flex items-start gap-2 border-destructive/30 bg-destructive/5">
      <Lock className="h-4 w-4 text-destructive mt-0.5" />
      <div className="text-sm">
        <div className="font-medium text-destructive">Access restricted</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {reason ?? "Your role does not have access to this section."}
        </div>
      </div>
    </Card>
  );
}

export function OverviewTab({ patientId }: { patientId: string }) {
  const p = useEhr(() => AdelanteEHR.getPatient(patientId));
  if (!p) return null;
  const lastCheckIn = p.checkIns?.[0];
  const openTasks = (p.tasks ?? []).filter((t) => !t.completedAt).length;
  const openReferrals = (p.resourceReferrals ?? []).filter((r) => r.status !== "completed").length;
  const openSdoh = (p.sdohPlan?.items ?? []).filter((i) => i.status !== "completed").length;
  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <StatBox label="Episode day" value={`${p.episodeDay}/90`} />
        <StatBox label="Coverage" value={p.coverage?.status ?? "unknown"} />
        <StatBox label="Open tasks" value={String(openTasks)} />
        <StatBox label="Open referrals" value={String(openReferrals)} />
        <StatBox label="Open SDOH items" value={String(openSdoh)} />
        <StatBox
          label="Last contact"
          value={lastCheckIn ? new Date(lastCheckIn.date).toLocaleDateString() : "—"}
        />
      </div>
      <CarePlanCard patientId={p.id} audience="case_manager" />
    </div>
  );
}

export function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm text-navy capitalize mt-0.5">{value}</div>
    </div>
  );
}

export function ContactTab({ patientId, readOnly }: { patientId: string; readOnly?: boolean }) {
  const p = useEhr(() => AdelanteEHR.getPatient(patientId));
  const [phone, setPhone] = useState(p?.phone ?? "");
  const [email, setEmail] = useState(p?.email ?? "");
  const [address, setAddress] = useState(p?.address ?? "");
  const [channel, setChannel] = useState(p?.contactPrefs?.channel ?? "text");
  const [bestTime, setBestTime] = useState(p?.contactPrefs?.bestTime ?? "afternoon");
  const [ecName, setEcName] = useState(p?.emergencyContact?.name ?? "");
  const [ecRel, setEcRel] = useState(p?.emergencyContact?.relationship ?? "");
  const [ecPhone, setEcPhone] = useState(p?.emergencyContact?.phone ?? "");
  const smsOn = useEhr(() => AdelanteEHR.isSmsOn(patientId));
  if (!p) return null;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Preferred channel">
          <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text (SMS)</SelectItem>
              <SelectItem value="call">Phone call</SelectItem>
              <SelectItem value="video">Video</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Best time">
          <Select value={bestTime} onValueChange={(v) => setBestTime(v as typeof bestTime)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="morning">Mornings</SelectItem>
              <SelectItem value="afternoon">Afternoons</SelectItem>
              <SelectItem value="evening">Evenings</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Address">
        <Input value={address} onChange={(e) => setAddress(e.target.value)} />
      </Field>
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        SMS reminders currently{" "}
        <Badge variant={smsOn ? "default" : "outline"} className="text-[10px]">
          {smsOn ? "on" : "off"}
        </Badge>
        <span>(patient controls this in Privacy & consent)</span>
      </div>
      <div className="rounded-md border p-3 space-y-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Emergency contact
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Input placeholder="Name" value={ecName} onChange={(e) => setEcName(e.target.value)} />
          <Input
            placeholder="Relationship"
            value={ecRel}
            onChange={(e) => setEcRel(e.target.value)}
          />
          <Input placeholder="Phone" value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} />
        </div>
      </div>
      <Button
        className="w-full"
        disabled={readOnly}
        onClick={() => {
          AdelanteEHR.updateProfile(patientId, {
            phone,
            email,
            address,
            contactPrefs: { channel, bestTime },
            emergencyContact: { name: ecName, relationship: ecRel, phone: ecPhone },
          });
          toast.success("Contact info updated");
        }}
      >
        Save contact info
      </Button>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function CheckInsTab({ patientId, readOnly }: { patientId: string; readOnly?: boolean }) {
  const p = useEhr(() => AdelanteEHR.getPatient(patientId));
  const [modality, setModality] = useState<"phone" | "video" | "in_person" | "sms">("phone");
  const [attended, setAttended] = useState(true);
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [time, setTime] = useState(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [dateError, setDateError] = useState<string | undefined>();
  const [timeError, setTimeError] = useState<string | undefined>();
  const items = p?.checkIns ?? [];
  return (
    <div className="space-y-3">
      {!readOnly && (
        <Card className="p-3 space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Log new check-in
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setDateError(undefined);
                }}
                aria-invalid={Boolean(dateError)}
                className={dateError ? "ring-2 ring-destructive border-destructive" : undefined}
              />
              {dateError && <p className="text-xs text-destructive">{dateError}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Time</Label>
              <TimePicker
                id="drawer-checkin-time"
                value={time}
                onChange={(v) => {
                  setTime(v);
                  setTimeError(undefined);
                }}
                error={timeError}
                ariaLabel="Check-in time"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
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
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={attended} onCheckedChange={(v) => setAttended(Boolean(v))} />
              Attended
            </label>
          </div>
          <Textarea
            rows={2}
            placeholder="Non-clinical note (e.g. confirmed housing intake Friday)."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button
            size="sm"
            onClick={() => {
              setDateError(undefined);
              setTimeError(undefined);
              if (!date) {
                setDateError("Pick a date");
                return;
              }
              if (!time) {
                setTimeError("Pick a time");
                return;
              }
              const dt = new Date(`${date}T${time}`);
              if (isNaN(dt.getTime())) {
                setTimeError("That time isn't valid");
                return;
              }
              AdelanteEHR.addCheckIn(patientId, {
                date: dt.toISOString(),
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
        </Card>
      )}
      <ul className="space-y-1">
        {items.length === 0 && <li className="text-xs text-muted-foreground">No check-ins yet.</li>}
        {items.map((c) => (
          <li key={c.id} className="rounded border p-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="capitalize">{c.modality.replace("_", " ")}</span>
              <span className="text-xs text-muted-foreground">
                <ClientDate value={c.date} />
              </span>
            </div>
            {c.notes && <div className="text-xs text-muted-foreground mt-1">{c.notes}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProviderHistoryTab({ patientId }: { patientId: string }) {
  const switches = useEhr(() => AdelanteEHR.listProviderSwitches({ patientId, status: "any" }));
  const clinicians = AdelanteEHR.listClinicians();
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const { role, staffName, clinicianId } = useActingStaff();
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const canWrite = patient
    ? canAccess(role, "care_coordination", patient).level === "write"
    : false;
  const nameFor = (id: string) => clinicians.find((c) => c.id === id)?.name ?? id;
  const reasonLabel: Record<string, string> = {
    reschedule: "Reschedule",
    new_appointment: "New booking",
    refill_review: "Refill review",
    primary_reassignment: "Primary reassignment",
  };
  if (switches.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No provider switches recorded for this client.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {switches.map((s) => {
        // Per-record authorization: only the outgoing provider this alert is
        // addressed to may resolve it — role-level write is necessary but
        // not sufficient.
        const isAddressee = Boolean(clinicianId && clinicianId === s.fromClinicianId);
        const actionable = s.status === "pending_review";
        return (
          <li key={s.id} className="rounded border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium text-navy">
                {nameFor(s.fromClinicianId)} → {nameFor(s.toClinicianId)}
              </div>
              <Badge
                variant="outline"
                className={
                  s.status === "pending_review"
                    ? "text-warning-foreground bg-warning/15 border-0"
                    : s.status === "acknowledged"
                      ? "text-success bg-success/15 border-0"
                      : "text-muted-foreground bg-muted border-0"
                }
              >
                {s.status.replace("_", " ")}
              </Badge>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {reasonLabel[s.reason] ?? s.reason}
              {s.serviceType ? ` · ${s.serviceType}` : ""}
              {" · "}
              {new Date(s.createdAt).toLocaleString()}
            </div>
            {s.context ? <div className="mt-1 text-xs">{s.context}</div> : null}
            {s.resolutionNote ? (
              <div className="mt-1 text-xs text-muted-foreground italic">
                Note: {s.resolutionNote}
              </div>
            ) : null}
            {s.resolvedBy ? (
              <div className="mt-1 text-[10px] text-muted-foreground">
                Resolved by {nameFor(s.resolvedBy)}
              </div>
            ) : null}
            {actionable &&
              (canWrite && isAddressee ? (
                <div className="mt-2 space-y-2">
                  {noteFor === s.id && (
                    <Textarea
                      rows={2}
                      className="text-xs"
                      placeholder="Hand-off / coordination note (optional)"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => {
                        AdelanteEHR.acknowledgeProviderSwitch(
                          s.id,
                          s.fromClinicianId,
                          note.trim() || undefined,
                        );
                        setNote("");
                        setNoteFor(null);
                        toast.success(`Switch acknowledged by ${staffName}`);
                      }}
                    >
                      Acknowledge
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px]"
                      onClick={() => {
                        AdelanteEHR.dismissProviderSwitch(
                          s.id,
                          s.fromClinicianId,
                          note.trim() || undefined,
                        );
                        setNote("");
                        setNoteFor(null);
                        toast("Alert dismissed");
                      }}
                    >
                      Dismiss
                    </Button>
                    {noteFor !== s.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11px]"
                        onClick={() => setNoteFor(s.id)}
                      >
                        Add note
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  {canWrite
                    ? `Only ${nameFor(s.fromClinicianId)} can resolve this hand-off.`
                    : "Your role cannot resolve provider switches."}
                </div>
              ))}
          </li>
        );
      })}
    </ul>
  );
}

export function SdohTab({ patientId, readOnly }: { patientId: string; readOnly: boolean }) {
  const p = useEhr(() => AdelanteEHR.getPatient(patientId));
  const items = p?.sdohPlan?.items ?? [];
  const [need, setNeed] = useState("");
  const [note, setNote] = useState("");
  const [visible, setVisible] = useState(true);
  const statusOpts: SdohStatus[] = [
    "identified",
    "sent",
    "accepted",
    "scheduled",
    "completed",
    "not_completed",
  ];
  return (
    <div className="space-y-3">
      {!readOnly && (
        <Card className="p-3 space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Add SDOH item
          </div>
          <Input
            placeholder="Need (e.g. transportation to appointment)"
            value={need}
            onChange={(e) => setNeed(e.target.value)}
          />
          <Textarea
            rows={2}
            placeholder="Action item / note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={visible} onCheckedChange={setVisible} />
            Show on patient portal
          </label>
          <Button
            size="sm"
            onClick={() => {
              AdelanteEHR.addSdohItem(patientId, { need, note, visibleToPatient: visible });
              setNeed("");
              setNote("");
              toast.success("SDOH item added");
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </Card>
      )}
      <ul className="space-y-2">
        {items.length === 0 && (
          <li className="text-xs text-muted-foreground">No SDOH items logged.</li>
        )}
        {items.map((i) => (
          <li key={i.id} className="rounded border p-3 space-y-2 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-navy">{i.need}</div>
              <Badge variant="outline" className="capitalize text-[10px]">
                {i.status.replace("_", " ")}
              </Badge>
            </div>
            {i.note && <div className="text-xs text-muted-foreground">{i.note}</div>}
            {!readOnly && (
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={i.status}
                  onValueChange={(v) => AdelanteEHR.setSdohStatus(patientId, i.id, v as SdohStatus)}
                >
                  <SelectTrigger className="h-8 text-xs w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOpts.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    AdelanteEHR.setSdohVisibility(patientId, i.id, !i.visibleToPatient)
                  }
                >
                  {i.visibleToPatient ? (
                    <>
                      <Eye className="h-3.5 w-3.5 mr-1" /> Visible
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3.5 w-3.5 mr-1" /> Hidden
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => AdelanteEHR.removeSdohItem(patientId, i.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReferralsTab({
  patientId,
  sudGated,
  readOnly,
}: {
  patientId: string;
  sudGated: boolean;
  readOnly?: boolean;
}) {
  const p = useEhr(() => AdelanteEHR.getPatient(patientId));
  const items = p?.resourceReferrals ?? [];
  const [category, setCategory] = useState<ResourceReferral["category"]>("housing");
  const [provider, setProvider] = useState("");
  const [note, setNote] = useState("");
  const statusOpts: ResourceReferral["status"][] = ["pending", "accepted", "completed"];
  return (
    <div className="space-y-3">
      {!readOnly && (
        <Card className="p-3 space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">New referral</div>
          <div className="grid grid-cols-2 gap-2">
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
              placeholder="Provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            />
          </div>
          <Textarea
            rows={2}
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            size="sm"
            onClick={() => {
              if (!provider.trim()) return toast.error("Add a provider");
              AdelanteEHR.addResourceReferral(patientId, {
                category,
                provider,
                note,
                visibleToPatient: true,
                sudDisclosureConsent: !sudGated,
              });
              setProvider("");
              setNote("");
              toast.success("Referral created");
            }}
          >
            Create referral
          </Button>
        </Card>
      )}
      <ul className="space-y-2">
        {items.length === 0 && <li className="text-xs text-muted-foreground">No referrals yet.</li>}
        {items.map((r) => (
          <li key={r.id} className="rounded border p-3 text-sm space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="capitalize text-navy">
                  {r.category} · {r.provider}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Created <ClientDate value={r.createdAt} />
                </div>
              </div>
              <Badge variant="outline" className="capitalize text-[10px]">
                {r.status}
              </Badge>
            </div>
            {r.note && <div className="text-xs text-muted-foreground">{r.note}</div>}
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={r.status}
                onValueChange={(v) =>
                  AdelanteEHR.setResourceReferralStatus(
                    patientId,
                    r.id,
                    v as ResourceReferral["status"],
                  )
                }
              >
                <SelectTrigger className="h-8 text-xs w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOpts.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  AdelanteEHR.setResourceReferralVisibility(patientId, r.id, !r.visibleToPatient)
                }
              >
                {r.visibleToPatient !== false ? (
                  <>
                    <Eye className="h-3.5 w-3.5 mr-1" /> Visible
                  </>
                ) : (
                  <>
                    <EyeOff className="h-3.5 w-3.5 mr-1" /> Hidden
                  </>
                )}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EligibilityTab({ patientId, readOnly }: { patientId: string; readOnly?: boolean }) {
  const p = useEhr(() => AdelanteEHR.getPatient(patientId));
  if (!p) return null;
  const cov = p.coverage;
  const notes = p.eligibilityNotes ?? {};
  const rows: {
    key: Parameters<typeof AdelanteEHR.setEligibilityNote>[1];
    label: string;
    on: boolean;
    toggle: (v: boolean) => void;
  }[] = [
    {
      key: "ecm",
      label: "ECM eligible",
      on: Boolean(cov?.ecmEligible),
      toggle: (v) => AdelanteEHR.setEcmEligible(patientId, v),
    },
    {
      key: "jiReentry",
      label: "JI Reentry (90-day)",
      on: Boolean(cov?.jiReentryFlag),
      toggle: (v) => AdelanteEHR.setJiReentry(patientId, v),
    },
    {
      key: "cs_housing",
      label: "CS: Housing",
      on: Boolean(cov?.communitySupports?.housing),
      toggle: (v) => AdelanteEHR.setCommunitySupport(patientId, "housing", v),
    },
    {
      key: "cs_food",
      label: "CS: Food",
      on: Boolean(cov?.communitySupports?.food),
      toggle: (v) => AdelanteEHR.setCommunitySupport(patientId, "food", v),
    },
    {
      key: "cs_transport",
      label: "CS: Transport",
      on: Boolean(cov?.communitySupports?.transport),
      toggle: (v) => AdelanteEHR.setCommunitySupport(patientId, "transport", v),
    },
  ];
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="rounded border p-3 text-sm space-y-2">
          <div className="flex items-center justify-between">
            <span>{r.label}</span>
            <Switch checked={r.on} onCheckedChange={r.toggle} disabled={readOnly} />
          </div>
          {!readOnly && (
            <NoteInline
              value={notes[r.key]?.note ?? ""}
              asOf={notes[r.key]?.asOf}
              onSave={(note, asOf) => AdelanteEHR.setEligibilityNote(patientId, r.key, note, asOf)}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

export function NoteInline({
  value,
  asOf,
  onSave,
}: {
  value: string;
  asOf?: string;
  onSave: (note: string, asOf?: string) => void;
}) {
  const [note, setNote] = useState(value);
  const [when, setWhen] = useState(asOf ?? "");
  return (
    <div className="grid grid-cols-3 gap-2 items-end">
      <div className="col-span-2">
        <Label className="text-[10px] text-muted-foreground">Note / source</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} className="h-8 text-xs" />
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">As of</Label>
        <Input
          type="date"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="h-8 text-xs"
        />
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="col-span-3 h-7 text-xs justify-end"
        onClick={() => {
          onSave(note, when || undefined);
          toast.success("Saved");
        }}
      >
        Save note
      </Button>
    </div>
  );
}

export function CoordinationTab({
  patientId,
  part2Consent,
}: {
  patientId: string;
  part2Consent: boolean;
}) {
  const p = useEhr(() => AdelanteEHR.getPatient(patientId));
  const contacts = p?.externalContacts ?? [];
  const log = p?.coordinationLog ?? [];
  const [agency, setAgency] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<ExternalPartyRole>("housing");
  const [entry, setEntry] = useState({
    party: "",
    partyType: "housing" as ExternalPartyRole,
    direction: "out" as CoordinationDirection,
    channel: "phone" as CoordinationChannel,
    summary: "",
    part2Disclosed: false,
  });
  const [filterType, setFilterType] = useState<string>("all");
  const [filterDir, setFilterDir] = useState<string>("all");
  const filteredLog = useMemo(
    () =>
      log.filter((e) => {
        if (filterType !== "all" && e.partyType !== filterType) return false;
        if (filterDir !== "all" && e.direction !== filterDir) return false;
        return true;
      }),
    [log, filterType, filterDir],
  );
  return (
    <div className="space-y-4">
      {!part2Consent && (
        <Card className="p-3 border-destructive/30 bg-destructive/5 flex items-start gap-2 text-xs">
          <ShieldAlert className="h-4 w-4 text-destructive mt-0.5" />
          <span>
            <strong>42 CFR Part 2:</strong> SUD-identifying detail cannot be shared with probation,
            parole, or external partners without the patient's specific Part 2 consent. Disclosure
            toggle is disabled.
          </span>
        </Card>
      )}

      <Card className="p-3 space-y-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          External contacts
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Agency" value={agency} onChange={(e) => setAgency(e.target.value)} />
          <Select value={role} onValueChange={(v) => setRole(v as ExternalPartyRole)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="probation">Probation</SelectItem>
              <SelectItem value="parole">Parole</SelectItem>
              <SelectItem value="housing">Housing partner</SelectItem>
              <SelectItem value="pcp">Primary care</SelectItem>
              <SelectItem value="county_bh">County behavioral health</SelectItem>
              <SelectItem value="family">Family / support</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Contact name"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
          <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Button
          size="sm"
          onClick={() => {
            if (!agency.trim()) return toast.error("Add an agency");
            AdelanteEHR.addExternalContact(patientId, {
              agency,
              contactName,
              phone,
              role,
            });
            setAgency("");
            setContactName("");
            setPhone("");
            toast.success("Contact saved");
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Add contact
        </Button>
        <ul className="space-y-1 pt-1">
          {contacts.map((c) => (
            <li key={c.id} className="text-xs flex items-center justify-between border-t pt-1">
              <span>
                {c.agency}
                {c.contactName ? ` · ${c.contactName}` : ""} ({c.role.replace("_", " ")})
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => AdelanteEHR.removeExternalContact(patientId, c.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-3 space-y-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Log coordination action
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Who (agency / person)"
            value={entry.party}
            onChange={(e) => setEntry({ ...entry, party: e.target.value })}
          />
          <Select
            value={entry.partyType}
            onValueChange={(v) => setEntry({ ...entry, partyType: v as ExternalPartyRole })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="probation">Probation</SelectItem>
              <SelectItem value="parole">Parole</SelectItem>
              <SelectItem value="housing">Housing</SelectItem>
              <SelectItem value="pcp">PCP</SelectItem>
              <SelectItem value="county_bh">County BH</SelectItem>
              <SelectItem value="family">Family</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={entry.direction}
            onValueChange={(v) => setEntry({ ...entry, direction: v as CoordinationDirection })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="out">Outbound</SelectItem>
              <SelectItem value="in">Inbound</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={entry.channel}
            onValueChange={(v) => setEntry({ ...entry, channel: v as CoordinationChannel })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="phone">Phone</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="in_person">In-person</SelectItem>
              <SelectItem value="letter">Letter</SelectItem>
              <SelectItem value="portal">Portal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea
          rows={2}
          placeholder="Summary of contact"
          value={entry.summary}
          onChange={(e) => setEntry({ ...entry, summary: e.target.value })}
        />
        <label className="flex items-center gap-2 text-xs">
          <Checkbox
            checked={entry.part2Disclosed}
            disabled={!part2Consent}
            onCheckedChange={(v) => setEntry({ ...entry, part2Disclosed: Boolean(v) })}
          />
          Disclosed SUD-identifying detail (Part 2)
        </label>
        <Button
          size="sm"
          onClick={() => {
            if (!entry.party.trim() || !entry.summary.trim())
              return toast.error("Add party & summary");
            AdelanteEHR.addCoordinationEntry(patientId, {
              date: new Date().toISOString(),
              party: entry.party,
              partyType: entry.partyType,
              direction: entry.direction,
              channel: entry.channel,
              summary: entry.summary,
              part2Disclosed: entry.part2Disclosed && part2Consent,
              createdBy: "staff",
            });
            setEntry({ ...entry, party: "", summary: "", part2Disclosed: false });
            toast.success("Coordination logged");
          }}
        >
          Log action
        </Button>
      </Card>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Recent coordination
          </div>
          <div className="flex items-center gap-1">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-7 w-[130px] text-[11px]">
                <SelectValue placeholder="Party" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All parties</SelectItem>
                <SelectItem value="probation">Probation</SelectItem>
                <SelectItem value="parole">Parole</SelectItem>
                <SelectItem value="housing">Housing</SelectItem>
                <SelectItem value="pcp">PCP</SelectItem>
                <SelectItem value="county_bh">County BH</SelectItem>
                <SelectItem value="family">Family</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterDir} onValueChange={setFilterDir}>
              <SelectTrigger className="h-7 w-[110px] text-[11px]">
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="out">Outbound</SelectItem>
                <SelectItem value="in">Inbound</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {filteredLog.length === 0 && (
          <EmptyState
            compact
            title={log.length === 0 ? "No coordination yet" : "No entries match this filter"}
            description={
              log.length === 0 ? "Log a call, email, or in-person contact above." : undefined
            }
          />
        )}
        {filteredLog.slice(0, 20).map((e) => (
          <div key={e.id} className="rounded border p-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-navy font-medium capitalize">
                {e.direction === "out" ? "→" : "←"} {e.party} ({e.partyType.replace("_", " ")})
              </span>
              <span className="text-muted-foreground">
                <ClientDate value={e.date} />
              </span>
            </div>
            <div className="text-muted-foreground mt-1">{e.summary}</div>
            {e.part2Disclosed && (
              <Badge className="bg-destructive/15 text-destructive border-0 text-[10px] mt-1">
                Part 2 disclosure
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PeerNotesTab({ patientId, canWrite }: { patientId: string; canWrite: boolean }) {
  const p = useEhr(() => AdelanteEHR.getPatient(patientId));
  const notes = p?.peerNotes ?? [];
  const [text, setText] = useState("");
  const [mode, setMode] = useState<NonNullable<PeerNote["mode"]>>("in_person");
  return (
    <div className="space-y-3">
      {canWrite && (
        <Card className="p-3 space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Peer specialist note
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Modality</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_person">In-person</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="warmline">Warmline</SelectItem>
                <SelectItem value="group">Group</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Peer-support note (non-clinical)."
          />
          <Button
            size="sm"
            onClick={() => {
              if (!text.trim()) return toast.error("Add a note");
              AdelanteEHR.addPeerNote(patientId, {
                date: new Date().toISOString(),
                author: "Peer specialist",
                text,
                mode,
              });
              setText("");
              toast.success("Peer note added");
            }}
          >
            Save note
          </Button>
        </Card>
      )}
      <ul className="space-y-2">
        {notes.length === 0 && (
          <EmptyState
            compact
            title="No peer notes yet"
            description="Log a peer-support touchpoint above to start the timeline."
          />
        )}
        {notes.map((n) => (
          <li key={n.id} className="rounded border p-3 text-sm">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {n.author}
                {n.mode && (
                  <Badge variant="outline" className="ml-2 text-[10px] capitalize">
                    {n.mode.replace("_", " ")}
                  </Badge>
                )}
              </span>
              <ClientDate value={n.date} />
            </div>
            <div className="mt-1">{n.text}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TasksTab({ patientId, readOnly }: { patientId: string; readOnly?: boolean }) {
  const tasks = useEhr(() => AdelanteEHR.caseTasksForPatient(patientId));
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const open = tasks.filter((t) => t.status === "open");
  const snoozed = tasks.filter((t) => t.status === "snoozed");
  const done = tasks.filter((t) => t.status === "done");
  const cmId = patient?.caseManagerId;
  return (
    <div className="space-y-3">
      {!readOnly && (
        <Card className="p-3 space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            New follow-up
          </div>
          <Input
            placeholder="Task (e.g. Confirm housing intake Friday)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <Textarea
              rows={2}
              placeholder="Detail (optional)"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Due</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <Button
            size="sm"
            disabled={!cmId}
            onClick={() => {
              if (!title.trim()) return toast.error("Add a task");
              if (!cmId) return toast.error("Assign a case manager first");
              AdelanteEHR.createCaseTask({
                patientId,
                assignedTo: cmId,
                title,
                detail,
                dueDate,
                origin: "manual",
              });
              setTitle("");
              setDetail("");
              toast.success("Task added");
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Add task
          </Button>
          {!cmId && (
            <p className="text-[11px] text-muted-foreground">
              Assign a case manager on the client's profile before creating tasks.
            </p>
          )}
        </Card>
      )}
      <TaskList label="Open" items={open} showActions={!readOnly} />
      {snoozed.length > 0 && <TaskList label="Snoozed" items={snoozed} showActions />}
      {done.length > 0 && <TaskList label="Completed" items={done.slice(0, 5)} />}
      {tasks.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          compact
          title="No follow-ups yet"
          description="Missed visits and crisis screeners auto-create tasks here. You can also add one manually."
        />
      )}
    </div>
  );
}

export function TaskList({
  label,
  items,
  showActions,
}: {
  label: string;
  items: CaseTask[];
  showActions?: boolean;
}) {
  if (items.length === 0) return null;
  const originLabels: Record<CaseTask["origin"], string> = {
    manual: "Manual",
    missed_appt: "No-show",
    screener_flag: "Screener",
    referral_stale: "Stale referral",
    notification_failed: "Delivery failed",
    provider_switch: "Provider switch",
  };
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <ul className="space-y-1.5">
        {items.map((t) => (
          <li key={t.id} className="rounded border p-2.5 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium text-navy">{t.title}</div>
                {t.detail && <div className="text-xs text-muted-foreground">{t.detail}</div>}
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Due {t.dueDate.slice(0, 10)} · {originLabels[t.origin]}
                </div>
              </div>
              {showActions && (
                <div className="flex gap-1">
                  {t.status === "open" && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11px]"
                        onClick={() => AdelanteEHR.snoozeCaseTask(t.id, 3)}
                        aria-label="Snooze 3 days"
                      >
                        Snooze
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        onClick={() => AdelanteEHR.completeCaseTask(t.id)}
                      >
                        Done
                      </Button>
                    </>
                  )}
                  {t.status === "snoozed" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px]"
                      onClick={() => AdelanteEHR.reopenCaseTask(t.id)}
                    >
                      Reopen
                    </Button>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Care Plan tab (consolidated from clinician.tsx) ----------
export function CarePlanTab({ patientId, readOnly }: { patientId: string; readOnly?: boolean }) {
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const { staffName } = useActingStaff();
  const [planDraft, setPlanDraft] = useState(patient?.carePlanOverride?.text ?? "");
  const [dirty, setDirty] = useState(false);
  const [newGoal, setNewGoal] = useState("");
  useEffect(() => {
    setPlanDraft(patient?.carePlanOverride?.text ?? "");
    setDirty(false);
  }, [patient?.carePlanOverride?.text]);
  useDraftDirty(`care-plan:${patientId}`, dirty || newGoal.trim().length > 0);
  if (!patient) return null;
  const existing = patient.carePlanOverride?.text ?? "";
  const trimmed = planDraft.trim();
  const isClearing = dirty && trimmed.length === 0 && existing.length > 0;
  const unchanged = !dirty && trimmed === existing.trim();
  return (
    <div className="space-y-4">
      <CarePlanCard patientId={patient.id} audience="clinician" />
      <Card className="p-4">
        <h4 className="font-display text-sm text-navy">Care plan note</h4>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Optional clinician note appended to the auto-summary shown to the patient.
        </p>
        <Textarea
          className="mt-2 min-h-[100px]"
          value={planDraft}
          disabled={readOnly}
          placeholder="Optional note…"
          onChange={(e) => {
            setPlanDraft(e.target.value);
            setDirty(true);
          }}
        />
        {!readOnly && (
          <Button
            className="mt-3 bg-navy text-navy-foreground hover:bg-navy/90"
            disabled={unchanged}
            onClick={() => {
              if (isClearing) {
                const ok = window.confirm("Clear the existing care-plan note for this patient?");
                if (!ok) return;
              }
              AdelanteEHR.updateCarePlanSummary(patient.id, planDraft, staffName);
              setDirty(false);
              toast.success(isClearing ? "Care plan note cleared" : "Care plan updated");
            }}
          >
            Save note
          </Button>
        )}
      </Card>
      <Card className="p-4">
        <h4 className="font-display text-sm text-navy">Goals</h4>
        <div className="mt-2 space-y-2">
          {(patient.goals ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">No goals yet.</p>
          )}
          {(patient.goals ?? []).map((g) => (
            <div key={g.id} className="flex items-start gap-2 rounded-md border p-2 text-sm">
              <Select
                value={g.status}
                disabled={readOnly}
                onValueChange={(v) =>
                  AdelanteEHR.setGoalStatus(patient.id, g.id, v as never, staffName)
                }
              >
                <SelectTrigger className="h-7 w-[120px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
              <span className="flex-1 pt-1">{g.text}</span>
              {g.createdBy && (
                <span className="pt-1 text-[10px] text-muted-foreground whitespace-nowrap">
                  {g.createdBy}
                </span>
              )}
              {!readOnly && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => AdelanteEHR.removeGoal(patient.id, g.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
        {!readOnly && (
          <div className="mt-3 flex gap-2">
            <Input
              placeholder="Add a goal…"
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
            />
            <Button
              size="sm"
              onClick={() => {
                if (!newGoal.trim()) return;
                AdelanteEHR.addGoal(patient.id, newGoal, staffName);
                setNewGoal("");
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------- Notes tab (progress SOAP notes + sign/cosign) ----------
// Attestation is checkbox-only, matching Orders / MAR / Refusal. Signer
// eligibility is role-based (see src/lib/notes.ts for the known simplification
// vs. credential-checked signing).
export function NotesTab({ patientId, readOnly }: { patientId: string; readOnly?: boolean }) {
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const { staffName, staffId, clinicianId, role } = useActingStaff();
  const [note, setNote] = useState({
    sessionType: "individual" as "individual" | "group" | "phone" | "check_in",
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
    category: "none" as "none" | "sud" | "mental_health" | "pregnancy" | "medical",
  });
  // Template layer: "none" keeps the existing free-text SOAP editor untouched.
  const templates = useEhr(() => AdelanteEHR.listNoteTemplates());
  const [templateId, setTemplateId] = useState<string>("none");
  const [answers, setAnswers] = useState<TemplateAnswers>({});
  const activeTemplate = templates.find((t) => t.id === templateId);
  useDraftDirty(
    `notes:${patientId}`,
    Boolean(
      note.subjective.trim() || note.objective.trim() || note.assessment.trim() || note.plan.trim(),
    ),
  );
  if (!patient) return null;
  // Acting staff always resolves to a named person; `clinicianId` is only
  // present for staff linked to a provider record. Notes are attributed to
  // the provider record when there is one, otherwise to the staff id.
  const authorId = clinicianId ?? staffId;
  const canWrite = !readOnly;
  const clinicians = AdelanteEHR.listClinicians();
  // Same 42 CFR Part 2 gate that hides SUD problem entries — one mechanism.
  const sudGate = canAccess(role, "screeners_sud", patient);
  return (
    <div className="space-y-4">
      {canWrite && (
        <Card className="p-4">
          <h4 className="font-display text-sm text-navy">New progress note</h4>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Authoring as <span className="text-navy font-medium">{staffName}</span>
          </p>
          {!authorId && (
            <p className="mt-1 text-[11px] text-destructive">
              No acting staff identity on this session — pick a staff member to author notes.
            </p>
          )}
          <div className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Session type</Label>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Template</Label>
              <NoteTemplatePicker
                templates={templates}
                value={templateId}
                onChange={(v) => {
                  setTemplateId(v);
                  setAnswers({});
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Select
                value={note.sessionType}
                onValueChange={(v) => setNote({ ...note, sessionType: v as never })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="check_in">Check-in</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sensitivity context</Label>
              <Select
                value={note.category}
                onValueChange={(v) => setNote({ ...note, category: v as never })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">General</SelectItem>
                  <SelectItem value="mental_health">Mental health</SelectItem>
                  <SelectItem value="sud">SUD — 42 CFR Part 2</SelectItem>
                  <SelectItem value="pregnancy">Pregnancy</SelectItem>
                  <SelectItem value="medical">Medical</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                A SUD note is masked by the same consent gate as SUD problem entries.
              </p>
            </div>
            {activeTemplate && (
              <div className="rounded-md border border-border p-3">
                <TemplateForm
                  schema={activeTemplate.schema}
                  answers={answers}
                  onChange={setAnswers}
                  language={patient.preferredLanguage === "es" ? "es" : "en"}
                />
              </div>
            )}
            {(["subjective", "objective", "assessment", "plan"] as const).map((k) => (
              <div key={k} className="space-y-1.5">
                <Label className="text-xs capitalize">{k}</Label>
                <Textarea
                  value={note[k]}
                  rows={2}
                  onChange={(e) => setNote({ ...note, [k]: e.target.value })}
                />
              </div>
            ))}
            <Button
              className="w-full bg-navy text-navy-foreground hover:bg-navy/90"
              disabled={!authorId}
              onClick={() => {
                if (!authorId) return;
                if (!note.subjective.trim()) {
                  toast.error("Add at least a subjective entry");
                  return;
                }
                AdelanteEHR.addProgressNote(patient.id, {
                  clinicianId: authorId,
                  date: new Date().toISOString(),
                  sessionType: note.sessionType,
                  subjective: note.subjective,
                  objective: note.objective,
                  assessment: note.assessment,
                  plan: note.plan,
                  category: note.category === "none" ? undefined : note.category,
                  authorSource: "human",
                  status: "draft",
                  templateId: activeTemplate?.id,
                  templateKey: activeTemplate?.key,
                  templateTitle: activeTemplate?.title,
                  templateVersion: activeTemplate?.version,
                  // Snapshot the schema so a later template edit never rewrites
                  // the questions a clinician actually answered.
                  templateSchema: activeTemplate?.schema,
                  templateAnswers: activeTemplate ? answers : undefined,
                });
                toast.success("Progress note saved as draft");
                setAnswers({});
                setNote({
                  sessionType: "individual",
                  subjective: "",
                  objective: "",
                  assessment: "",
                  plan: "",
                  category: "none",
                });
              }}
            >
              Save draft
            </Button>
          </div>
        </Card>
      )}
      <div className="space-y-2">
        <h4 className="font-display text-sm text-navy">Recent notes</h4>
        {(patient.progressNotes ?? []).length === 0 && (
          <Card className="p-3 text-xs text-muted-foreground">No progress notes yet.</Card>
        )}
        {(patient.progressNotes ?? []).map((n) => (
          <ProgressNoteCard
            key={n.id}
            patientId={patient.id}
            note={n}
            canWrite={canWrite}
            sudLocked={isNoteSudSensitive(n) && sudGate.locked}
            sudReason={sudGate.reason}
            authorLabel={
              clinicians.find((c) => c.id === n.clinicianId)?.name ??
              getStaffMember(n.clinicianId)?.name ??
              n.clinicianId
            }
          />
        ))}
      </div>
    </div>
  );
}

const NOTE_STATUS_LABEL: Record<NoteStatus, string> = {
  draft: "Draft",
  signed: "Signed",
  cosign_pending: "Awaiting cosign",
  cosigned: "Cosigned",
  declined: "Declined",
};

/**
 * Export action for finalized notes. Rendered ONLY when `noteExportGate`
 * allows it — the same gate the PDF builder re-runs — so draft, unsigned and
 * SUD-masked notes have no export affordance at all.
 */
function NoteExportButton({
  patientId,
  note,
  authorLabel,
}: {
  patientId: string;
  note: ProgressNote;
  authorLabel: string;
}) {
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const { role, staffName } = useActingStaff();
  if (!patient) return null;
  if (!noteExportGate(note, role, patient).allowed) return null;
  return (
    <Button
      size="sm"
      variant="outline"
      className="mt-2 h-7 text-[11px]"
      onClick={() => {
        try {
          const filename = downloadProgressNotePdf({
            note,
            patient,
            role,
            authorLabel,
            exportedBy: staffName,
          });
          toast.success(`Exported ${filename}`);
        } catch (e) {
          toast.error((e as Error).message);
        }
      }}
    >
      <Download className="mr-1 h-3.5 w-3.5" /> Export PDF
    </Button>
  );
}

export function NoteStatusBadge({ note }: { note: ProgressNote }) {
  const s = noteStatus(note);
  const tone =
    s === "cosigned" || s === "signed"
      ? "bg-teal/20 text-teal"
      : s === "cosign_pending"
        ? "bg-gold/30 text-navy"
        : "bg-muted text-muted-foreground";
  return <Badge className={`${tone} border-0 text-[10px]`}>{NOTE_STATUS_LABEL[s]}</Badge>;
}

const SIGN_ATTESTATION =
  "I attest that this note is accurate, complete, and reflects care I personally provided or supervised.";

function ProgressNoteCard({
  patientId,
  note,
  canWrite,
  sudLocked,
  sudReason,
  authorLabel,
}: {
  patientId: string;
  note: ProgressNote;
  canWrite: boolean;
  sudLocked: boolean;
  sudReason?: string;
  authorLabel: string;
}) {
  const { staffName, role } = useActingStaff();
  const status = noteStatus(note);
  const [attested, setAttested] = useState(false);
  const [cosignerId, setCosignerId] = useState<string>("");
  const mustCosign = requiresCosign(role);
  const candidates = cosignerCandidates(staffName);
  const cosigner = candidates.find((c) => c.id === cosignerId);
  // Structured templates gate signing: a required question left blank is the
  // same class of defect as an unattested signature.
  const missing = note.templateSchema
    ? findMissingRequired(note.templateSchema, note.templateAnswers ?? {})
    : [];

  const sign = () => {
    try {
      if (missing.length > 0) {
        toast.error(`Answer ${missing.length} required template field(s) before signing.`);
        return;
      }
      AdelanteEHR.signProgressNote(patientId, note.id, {
        signedBy: staffName,
        role,
        attested,
        cosignRequired: mustCosign,
        cosignRole: cosigner ? [cosigner.role] : undefined,
      });
      toast.success(mustCosign ? "Signed — routed for cosignature" : "Note signed");
      setAttested(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Card className="p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="capitalize">
            {note.sessionType.replace("_", " ")}
          </Badge>
          <NoteStatusBadge note={note} />
          {note.category === "sud" && (
            <Badge className="bg-destructive/15 text-destructive border-0 text-[10px]">
              42 CFR 2
            </Badge>
          )}
          {note.authorSource === "ai_draft" && (
            <Badge className="bg-muted text-muted-foreground border-0 text-[10px]">
              Machine draft
            </Badge>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">
          <ClientDate value={note.date} />
        </span>
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">By {authorLabel}</div>
      {sudLocked ? (
        <div className="mt-2 flex items-center gap-2 text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          <span>{sudReason ?? "SUD note — 42 CFR Part 2 consent required"}</span>
        </div>
      ) : (
        <>
          {note.templateSchema && (
            <div className="mt-2 rounded-md border border-border p-2">
              {note.templateTitle && (
                <p className="text-muted-foreground mb-1.5 text-[10px]">
                  Answered against {note.templateTitle}
                  {note.templateVersion ? ` v${note.templateVersion}` : ""}
                </p>
              )}
              <TemplateForm
                schema={note.templateSchema}
                answers={note.templateAnswers ?? {}}
                onChange={() => {}}
                readOnly
                missingKeys={missing.map((m) => m.key)}
              />
            </div>
          )}
          <dl className="mt-2 space-y-1.5">
            {(["subjective", "objective", "assessment", "plan"] as const).map((k) =>
              note[k] ? (
                <div key={k}>
                  <dt className="font-medium text-navy capitalize">{k}</dt>
                  <dd className="text-foreground/80">{note[k]}</dd>
                </div>
              ) : null,
            )}
          </dl>
        </>
      )}
      {note.signedAt && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Signed by {note.signedBy} · <ClientDate value={note.signedAt} />
        </p>
      )}
      {note.cosignedAt && (
        <p className="text-[10px] text-muted-foreground">
          Cosigned by {note.cosignedBy} · <ClientDate value={note.cosignedAt} />
          {note.cosignComment ? ` — “${note.cosignComment}”` : ""}
        </p>
      )}
      {note.declineReason && status === "draft" && (
        <p className="mt-2 rounded border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive">
          Cosign declined by {note.declinedBy}: {note.declineReason} — revise and re-sign.
        </p>
      )}
      <NoteExportButton patientId={patientId} note={note} authorLabel={authorLabel} />
      {canWrite && !sudLocked && (status === "draft" || status === "declined") && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          {mustCosign && (
            <div className="space-y-1.5">
              <Label className="text-[11px]">Cosigner (required for your role)</Label>
              <Select value={cosignerId} onValueChange={setCosignerId}>
                <SelectTrigger className="h-8 text-xs" aria-label="Cosigner">
                  <SelectValue placeholder="Choose a cosigner…" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.credential ? `, ${c.credential}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                {role.replace("_", " ")} cannot self-sign a clinical note.
              </p>
            </div>
          )}
          {missing.length > 0 && (
            <p className="rounded border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive">
              {missing.length} required template field(s) still unanswered — signing is blocked.
            </p>
          )}
          <label className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <Checkbox
              checked={attested}
              onCheckedChange={(v) => setAttested(Boolean(v))}
              aria-label="Note attestation"
            />
            <span>{SIGN_ATTESTATION}</span>
          </label>
          <Button
            size="sm"
            className="w-full bg-navy text-navy-foreground hover:bg-navy/90"
            disabled={!attested || (mustCosign && !cosignerId) || missing.length > 0}
            onClick={sign}
          >
            Sign note
          </Button>
        </div>
      )}
    </Card>
  );
}

// ---------- Tracking tab (screener trends, SUD per-item masked) ----------
export function TrackingTab({ patientId }: { patientId: string }) {
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const [role] = useActingRole();
  if (!patient) return null;
  const history = patient.screenerHistory ?? [];
  const screenerKeys = Array.from(new Set(history.map((h) => h.key)));
  const sudGate = canAccess(role, "screeners_sud", patient);
  if (screenerKeys.length === 0) {
    return <p className="text-sm text-muted-foreground">No screener history yet.</p>;
  }
  return (
    <div className="space-y-6">
      {screenerKeys.map((key) => {
        const def = SCREENERS.find((s) => s.key === key);
        if (def?.isSud && sudGate.locked) {
          return (
            <div key={key}>
              <h4 className="font-medium text-navy text-sm">{def?.name ?? key}</h4>
              <LockedNote reason={sudGate.reason} />
            </div>
          );
        }
        const data = history
          .filter((h) => h.key === key)
          .sort((a, b) => +new Date(a.completedAt) - +new Date(b.completedAt))
          .map((h) => ({
            date: new Date(h.completedAt).toLocaleDateString(),
            score: h.score,
            timepoint: h.timepoint,
          }));
        return (
          <div key={key}>
            <div className="flex items-baseline justify-between">
              <h4 className="font-medium text-navy text-sm">{def?.name ?? key}</h4>
              <span className="text-[11px] text-muted-foreground">
                Latest: {data[data.length - 1]?.score} ·{" "}
                {def ? severityFor(def, data[data.length - 1]?.score ?? 0) : ""}
              </span>
            </div>
            <div className="h-40 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} />
                  <RTooltip />
                  {data.map((d, i) =>
                    d.timepoint && d.timepoint !== "adhoc" ? (
                      <ReferenceLine
                        key={i}
                        x={d.date}
                        stroke="var(--teal)"
                        strokeDasharray="4 4"
                        label={{ value: d.timepoint, fontSize: 10, fill: "var(--teal)" }}
                      />
                    ) : null,
                  )}
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="var(--navy)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}
