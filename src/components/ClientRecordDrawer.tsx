import { useMemo, useState } from "react";
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
  type CoordinationChannel,
  type CoordinationDirection,
  type ExternalPartyRole,
  type ResourceReferral,
  type SdohStatus,
} from "@/lib/ehr";
import { useActingRole, canAccess, type RecordClass } from "@/lib/roles";
import { ClientDate } from "@/components/ClientDate";
import { toast } from "sonner";
import { Lock, ShieldAlert, Eye, EyeOff, Trash2, Plus } from "lucide-react";

interface Props {
  patientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientRecordDrawer({ patientId, open, onOpenChange }: Props) {
  const patient = useEhr(() =>
    patientId ? AdelanteEHR.getPatient(patientId) : undefined,
  );
  const [role] = useActingRole();

  if (!patient) return null;

  const gate = (cls: RecordClass) => canAccess(role, cls, patient);
  const canPeer = gate("peer_notes");
  const canSdoh = gate("sdoh");
  const canCoord = gate("case_notes"); // coordination log lives with case notes
  const canSud = gate("sud_treatment");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl text-navy">
            {patient.firstName} {patient.lastName}
          </SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">
              {patient.programId}
              {patient.cin ? ` · CIN ••••${patient.cin.slice(-4)}` : ""}
              {patient.dob ? ` · DOB ${patient.dob}` : ""}
            </span>
            <span className="text-xs text-muted-foreground">
              Acting as: <span className="capitalize">{role.replace("_", " ")}</span>
            </span>
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="overview" className="mt-4">
          <TabsList className="w-full flex-wrap h-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="checkins">Check-ins</TabsTrigger>
            <TabsTrigger value="sdoh">SDOH</TabsTrigger>
            <TabsTrigger value="referrals">Referrals</TabsTrigger>
            <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
            <TabsTrigger value="coord">External</TabsTrigger>
            {canPeer.level !== "none" && <TabsTrigger value="peer">Peer notes</TabsTrigger>}
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <OverviewTab patientId={patient.id} />
          </TabsContent>
          <TabsContent value="contact" className="mt-4">
            <ContactTab patientId={patient.id} />
          </TabsContent>
          <TabsContent value="checkins" className="mt-4">
            <CheckInsTab patientId={patient.id} />
          </TabsContent>
          <TabsContent value="sdoh" className="mt-4">
            {canSdoh.locked ? (
              <LockedNote reason={canSdoh.reason} />
            ) : (
              <SdohTab patientId={patient.id} readOnly={canSdoh.level === "read"} />
            )}
          </TabsContent>
          <TabsContent value="referrals" className="mt-4">
            <ReferralsTab patientId={patient.id} sudGated={canSud.locked} />
          </TabsContent>
          <TabsContent value="eligibility" className="mt-4">
            <EligibilityTab patientId={patient.id} />
          </TabsContent>
          <TabsContent value="coord" className="mt-4">
            {canCoord.locked ? (
              <LockedNote reason={canCoord.reason} />
            ) : (
              <CoordinationTab patientId={patient.id} part2Consent={patient.consents.part2Sud} />
            )}
          </TabsContent>
          {canPeer.level !== "none" && (
            <TabsContent value="peer" className="mt-4">
              <PeerNotesTab patientId={patient.id} canWrite={canPeer.level === "write"} />
            </TabsContent>
          )}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function LockedNote({ reason }: { reason?: string }) {
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

function OverviewTab({ patientId }: { patientId: string }) {
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
      <Card className="p-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Care plan</div>
        <p className="text-sm mt-1">{p.carePlanSummary ?? "No summary yet."}</p>
      </Card>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm text-navy capitalize mt-0.5">{value}</div>
    </div>
  );
}

function ContactTab({ patientId }: { patientId: string }) {
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
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text (SMS)</SelectItem>
              <SelectItem value="call">Phone call</SelectItem>
              <SelectItem value="video">Video</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Best time">
          <Select value={bestTime} onValueChange={(v) => setBestTime(v as typeof bestTime)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
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
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Emergency contact</div>
        <div className="grid grid-cols-3 gap-2">
          <Input placeholder="Name" value={ecName} onChange={(e) => setEcName(e.target.value)} />
          <Input placeholder="Relationship" value={ecRel} onChange={(e) => setEcRel(e.target.value)} />
          <Input placeholder="Phone" value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} />
        </div>
      </div>
      <Button
        className="w-full"
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function CheckInsTab({ patientId }: { patientId: string }) {
  const p = useEhr(() => AdelanteEHR.getPatient(patientId));
  const [modality, setModality] = useState<"phone" | "video" | "in_person" | "sms">("phone");
  const [attended, setAttended] = useState(true);
  const [notes, setNotes] = useState("");
  const items = p?.checkIns ?? [];
  return (
    <div className="space-y-3">
      <Card className="p-3 space-y-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Log new check-in</div>
        <div className="grid grid-cols-2 gap-2">
          <Select value={modality} onValueChange={(v) => setModality(v as typeof modality)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
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
            AdelanteEHR.addCheckIn(patientId, {
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
      </Card>
      <ul className="space-y-1">
        {items.length === 0 && (
          <li className="text-xs text-muted-foreground">No check-ins yet.</li>
        )}
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

function SdohTab({ patientId, readOnly }: { patientId: string; readOnly: boolean }) {
  const p = useEhr(() => AdelanteEHR.getPatient(patientId));
  const items = p?.sdohPlan?.items ?? [];
  const [need, setNeed] = useState("");
  const [note, setNote] = useState("");
  const [visible, setVisible] = useState(true);
  const statusOpts: SdohStatus[] = [
    "identified", "sent", "accepted", "scheduled", "completed", "not_completed",
  ];
  return (
    <div className="space-y-3">
      {!readOnly && (
        <Card className="p-3 space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Add SDOH item</div>
          <Input placeholder="Need (e.g. transportation to appointment)" value={need} onChange={(e) => setNeed(e.target.value)} />
          <Textarea rows={2} placeholder="Action item / note" value={note} onChange={(e) => setNote(e.target.value)} />
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={visible} onCheckedChange={setVisible} />
            Show on patient portal
          </label>
          <Button
            size="sm"
            onClick={() => {
              AdelanteEHR.addSdohItem(patientId, { need, note, visibleToPatient: visible });
              setNeed(""); setNote("");
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
              <Badge variant="outline" className="capitalize text-[10px]">{i.status.replace("_", " ")}</Badge>
            </div>
            {i.note && <div className="text-xs text-muted-foreground">{i.note}</div>}
            {!readOnly && (
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={i.status}
                  onValueChange={(v) => AdelanteEHR.setSdohStatus(patientId, i.id, v as SdohStatus)}
                >
                  <SelectTrigger className="h-8 text-xs w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusOpts.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
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
                    <><Eye className="h-3.5 w-3.5 mr-1" /> Visible</>
                  ) : (
                    <><EyeOff className="h-3.5 w-3.5 mr-1" /> Hidden</>
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

function ReferralsTab({ patientId, sudGated }: { patientId: string; sudGated: boolean }) {
  const p = useEhr(() => AdelanteEHR.getPatient(patientId));
  const items = p?.resourceReferrals ?? [];
  const [category, setCategory] = useState<ResourceReferral["category"]>("housing");
  const [provider, setProvider] = useState("");
  const [note, setNote] = useState("");
  const statusOpts: ResourceReferral["status"][] = ["pending", "accepted", "completed"];
  return (
    <div className="space-y-3">
      <Card className="p-3 space-y-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">New referral</div>
        <div className="grid grid-cols-2 gap-2">
          <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="housing">Housing</SelectItem>
              <SelectItem value="food">Food</SelectItem>
              <SelectItem value="employment">Employment</SelectItem>
              <SelectItem value="legal">Legal</SelectItem>
              <SelectItem value="benefits">Benefits / Medi-Cal</SelectItem>
              <SelectItem value="transport">Transportation</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Provider" value={provider} onChange={(e) => setProvider(e.target.value)} />
        </div>
        <Textarea rows={2} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
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
            setProvider(""); setNote("");
            toast.success("Referral created");
          }}
        >
          Create referral
        </Button>
      </Card>
      <ul className="space-y-2">
        {items.length === 0 && (
          <li className="text-xs text-muted-foreground">No referrals yet.</li>
        )}
        {items.map((r) => (
          <li key={r.id} className="rounded border p-3 text-sm space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="capitalize text-navy">{r.category} · {r.provider}</div>
                <div className="text-[11px] text-muted-foreground">
                  Created <ClientDate value={r.createdAt} />
                </div>
              </div>
              <Badge variant="outline" className="capitalize text-[10px]">{r.status}</Badge>
            </div>
            {r.note && <div className="text-xs text-muted-foreground">{r.note}</div>}
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={r.status}
                onValueChange={(v) =>
                  AdelanteEHR.setResourceReferralStatus(patientId, r.id, v as ResourceReferral["status"])
                }
              >
                <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOpts.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
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
                  <><Eye className="h-3.5 w-3.5 mr-1" /> Visible</>
                ) : (
                  <><EyeOff className="h-3.5 w-3.5 mr-1" /> Hidden</>
                )}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EligibilityTab({ patientId }: { patientId: string }) {
  const p = useEhr(() => AdelanteEHR.getPatient(patientId));
  if (!p) return null;
  const cov = p.coverage;
  const notes = p.eligibilityNotes ?? {};
  const rows: { key: Parameters<typeof AdelanteEHR.setEligibilityNote>[1]; label: string; on: boolean; toggle: (v: boolean) => void }[] = [
    { key: "ecm", label: "ECM eligible", on: Boolean(cov?.ecmEligible), toggle: (v) => AdelanteEHR.setEcmEligible(patientId, v) },
    { key: "jiReentry", label: "JI Reentry (90-day)", on: Boolean(cov?.jiReentryFlag), toggle: (v) => AdelanteEHR.setJiReentry(patientId, v) },
    { key: "cs_housing", label: "CS: Housing", on: Boolean(cov?.communitySupports?.housing), toggle: (v) => AdelanteEHR.setCommunitySupport(patientId, "housing", v) },
    { key: "cs_food", label: "CS: Food", on: Boolean(cov?.communitySupports?.food), toggle: (v) => AdelanteEHR.setCommunitySupport(patientId, "food", v) },
    { key: "cs_transport", label: "CS: Transport", on: Boolean(cov?.communitySupports?.transport), toggle: (v) => AdelanteEHR.setCommunitySupport(patientId, "transport", v) },
  ];
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="rounded border p-3 text-sm space-y-2">
          <div className="flex items-center justify-between">
            <span>{r.label}</span>
            <Switch checked={r.on} onCheckedChange={r.toggle} />
          </div>
          <NoteInline
            value={notes[r.key]?.note ?? ""}
            asOf={notes[r.key]?.asOf}
            onSave={(note, asOf) => AdelanteEHR.setEligibilityNote(patientId, r.key, note, asOf)}
          />
        </li>
      ))}
    </ul>
  );
}

function NoteInline({
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
      <Button size="sm" variant="ghost" className="col-span-3 h-7 text-xs justify-end"
        onClick={() => { onSave(note, when || undefined); toast.success("Saved"); }}>
        Save note
      </Button>
    </div>
  );
}

function CoordinationTab({ patientId, part2Consent }: { patientId: string; part2Consent: boolean }) {
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
  return (
    <div className="space-y-4">
      {!part2Consent && (
        <Card className="p-3 border-destructive/30 bg-destructive/5 flex items-start gap-2 text-xs">
          <ShieldAlert className="h-4 w-4 text-destructive mt-0.5" />
          <span>
            <strong>42 CFR Part 2:</strong> SUD-identifying detail cannot be shared with probation, parole, or external partners without the patient's specific Part 2 consent. Disclosure toggle is disabled.
          </span>
        </Card>
      )}

      <Card className="p-3 space-y-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">External contacts</div>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Agency" value={agency} onChange={(e) => setAgency(e.target.value)} />
          <Select value={role} onValueChange={(v) => setRole(v as ExternalPartyRole)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
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
          <Input placeholder="Contact name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Button
          size="sm"
          onClick={() => {
            if (!agency.trim()) return toast.error("Add an agency");
            AdelanteEHR.addExternalContact(patientId, {
              agency, contactName, phone, role,
            });
            setAgency(""); setContactName(""); setPhone("");
            toast.success("Contact saved");
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Add contact
        </Button>
        <ul className="space-y-1 pt-1">
          {contacts.map((c) => (
            <li key={c.id} className="text-xs flex items-center justify-between border-t pt-1">
              <span>{c.agency}{c.contactName ? ` · ${c.contactName}` : ""} ({c.role.replace("_", " ")})</span>
              <Button size="sm" variant="ghost" onClick={() => AdelanteEHR.removeExternalContact(patientId, c.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-3 space-y-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Log coordination action</div>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Who (agency / person)" value={entry.party} onChange={(e) => setEntry({ ...entry, party: e.target.value })} />
          <Select value={entry.partyType} onValueChange={(v) => setEntry({ ...entry, partyType: v as ExternalPartyRole })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
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
          <Select value={entry.direction} onValueChange={(v) => setEntry({ ...entry, direction: v as CoordinationDirection })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="out">Outbound</SelectItem>
              <SelectItem value="in">Inbound</SelectItem>
            </SelectContent>
          </Select>
          <Select value={entry.channel} onValueChange={(v) => setEntry({ ...entry, channel: v as CoordinationChannel })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="phone">Phone</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="in_person">In-person</SelectItem>
              <SelectItem value="letter">Letter</SelectItem>
              <SelectItem value="portal">Portal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea rows={2} placeholder="Summary of contact" value={entry.summary} onChange={(e) => setEntry({ ...entry, summary: e.target.value })} />
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
            if (!entry.party.trim() || !entry.summary.trim()) return toast.error("Add party & summary");
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
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Recent coordination</div>
        {log.length === 0 && <div className="text-xs text-muted-foreground">No entries yet.</div>}
        {log.slice(0, 10).map((e) => (
          <div key={e.id} className="rounded border p-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-navy font-medium capitalize">
                {e.direction === "out" ? "→" : "←"} {e.party} ({e.partyType.replace("_", " ")})
              </span>
              <span className="text-muted-foreground"><ClientDate value={e.date} /></span>
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

function PeerNotesTab({ patientId, canWrite }: { patientId: string; canWrite: boolean }) {
  const p = useEhr(() => AdelanteEHR.getPatient(patientId));
  const notes = p?.peerNotes ?? [];
  const [text, setText] = useState("");
  return (
    <div className="space-y-3">
      {canWrite && (
        <Card className="p-3 space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Peer specialist note</div>
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Peer-support note (non-clinical)." />
          <Button
            size="sm"
            onClick={() => {
              AdelanteEHR.addPeerNote(patientId, {
                date: new Date().toISOString(),
                author: "Peer specialist",
                text,
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
          <li className="text-xs text-muted-foreground">No peer notes yet.</li>
        )}
        {notes.map((n) => (
          <li key={n.id} className="rounded border p-3 text-sm">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{n.author}</span>
              <ClientDate value={n.date} />
            </div>
            <div className="mt-1">{n.text}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}