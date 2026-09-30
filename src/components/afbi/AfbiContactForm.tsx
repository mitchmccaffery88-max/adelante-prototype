// §Batch A3 — quick side-drawer form, built to finish in under 30 seconds on a phone.
import { useState } from "react";
import { toast } from "sonner";
import { WifiOff } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { actFor } from "@/lib/actions/act";
import { confirmationFor } from "@/lib/actions/runAction";
import {
  AFBI_ACTIVITIES,
  AFBI_LOCATION_TYPES,
  AFBI_ONLINE_ONLY_NOTE,
  AFBI_OUTCOMES,
  listAfbiContactsFor,
  listAfbiLinkRequests,
  type AfbiActivity,
  type AfbiLocationType,
  type AfbiOutcome,
} from "@/lib/afbiOutreach";
import { DRAFT_RULE_LABEL } from "@/lib/serviceClassification";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const chip = (on: boolean) => (on ? "default" : "outline") as "default" | "outline";

export function AfbiContactForm({ patientId, onDone }: { patientId?: string; onDone: (message: string) => void }) {
  const me = useActingStaff();
  const patient = useEhr(() => (patientId ? AdelanteEHR.getPatient(patientId) : undefined));
  const [location, setLocation] = useState<AfbiLocationType>("street");
  const [initials, setInitials] = useState("");
  const [description, setDescription] = useState("");
  const [activities, setActivities] = useState<AfbiActivity[]>(["engagement"]);
  const [minutes, setMinutes] = useState(15);
  const [outcome, setOutcome] = useState<AfbiOutcome>("engaged");
  const [nextStep, setNextStep] = useState("");
  const toggle = (a: AfbiActivity) => setActivities((l) => (l.includes(a) ? l.filter((x) => x !== a) : [...l, a]));

  const save = () => {
    try {
      actFor("afbi_contact", "recordAfbiContact", patientId, { role: me.role, name: me.staffName, staffId: me.staffId }, {
        locationType: location,
        patientId,
        initials,
        description,
        activities,
        minutes,
        outcome,
        nextStep,
      });
      onDone(confirmationFor("afbi_contact", "Field outreach contact saved"));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4" data-testid="afbi-form">
      <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        <WifiOff className="h-3.5 w-3.5" /> {AFBI_ONLINE_ONLY_NOTE}
      </p>
      <div className="space-y-1.5">
        <Label>Where (general only — no address)</Label>
        <div className="flex flex-wrap gap-1.5">
          {AFBI_LOCATION_TYPES.map((l) => (
            <Button key={l.id} type="button" size="sm" variant={chip(location === l.id)} onClick={() => setLocation(l.id)}>{l.label}</Button>
          ))}
        </div>
      </div>
      {patient ? (
        <p className="text-sm">Person: <span className="font-medium">{patient.firstName} {patient.lastName}</span></p>
      ) : (
        <div className="grid grid-cols-[5rem_1fr] gap-2">
          <div className="space-y-1.5"><Label htmlFor="afbi-initials">Initials</Label><Input id="afbi-initials" value={initials} maxLength={4} onChange={(e) => setInitials(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="afbi-desc">Short description</Label><Input id="afbi-desc" value={description} maxLength={140} placeholder="e.g. red backpack, near the bus stop" onChange={(e) => setDescription(e.target.value)} /></div>
          <p className="col-span-2 text-xs text-muted-foreground">Not enrolled yet. You can ask to link this contact to their chart after they enroll.</p>
        </div>
      )}
      <div className="space-y-1.5">
        <Label>What happened</Label>
        <div className="flex flex-wrap gap-1.5">
          {AFBI_ACTIVITIES.map((a) => (
            <Button key={a.id} type="button" size="sm" variant={chip(activities.includes(a.id))} onClick={() => toggle(a.id)} aria-pressed={activities.includes(a.id)}>{a.label}</Button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="afbi-min">Minutes</Label>
        <div className="flex flex-wrap items-center gap-1.5">
          {[10, 15, 30, 45, 60].map((m) => (
            <Button key={m} type="button" size="sm" variant={chip(minutes === m)} onClick={() => setMinutes(m)}>{m}</Button>
          ))}
          <Input id="afbi-min" type="number" inputMode="numeric" className="w-20" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Outcome</Label>
        <div className="flex flex-wrap gap-1.5">
          {AFBI_OUTCOMES.map((o) => (
            <Button key={o.id} type="button" size="sm" variant={chip(outcome === o.id)} onClick={() => setOutcome(o.id)}>{o.label}</Button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5"><Label htmlFor="afbi-next">Next step (optional)</Label><Input id="afbi-next" value={nextStep} maxLength={200} onChange={(e) => setNextStep(e.target.value)} /></div>
      <p className="text-xs text-muted-foreground">
        <Badge variant="outline" className="mr-1 text-[10px]">Set by rule</Badge>
        Funding: ISL (non-Medi-Cal) · Outreach &amp; engagement. Never billed to Medi-Cal. {DRAFT_RULE_LABEL}.
      </p>
      <Button className="w-full" onClick={save} data-testid="afbi-save">Save contact</Button>
      {!patientId && <AfbiLinkList />}
    </div>
  );
}

/** Unlinked contacts: ask to link one to a chart (a coordinator confirms in Patient matching). */
function AfbiLinkList() {
  const me = useActingStaff();
  const rows = useEhr(() => listAfbiContactsFor(me.role).filter((c) => !c.patientId).slice(0, 5));
  const pending = useEhr(() => new Set(listAfbiLinkRequests("open").map((l) => l.contactId)));
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const [pick, setPick] = useState<Record<string, string>>({});
  if (!rows.length) return null;
  const request = (contactId: string) => {
    try {
      actFor("afbi_contact", "requestAfbiLink", pick[contactId], { role: me.role, name: me.staffName, staffId: me.staffId }, contactId, pick[contactId]);
      toast.success("Link sent to Patient matching for review");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="space-y-2 border-t pt-3" data-testid="afbi-link-list">
      <p className="text-xs font-medium uppercase text-muted-foreground">Not yet linked to a chart</p>
      {rows.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{c.initials}</span>
          <span className="text-xs text-muted-foreground">{new Date(c.at).toLocaleDateString()}</span>
          {pending.has(c.id) ? (
            <Badge variant="outline">Waiting for review</Badge>
          ) : (
            <>
              <select aria-label="Enrolled patient" className="h-8 rounded-md border bg-background px-2 text-xs" value={pick[c.id] ?? ""} onChange={(e) => setPick((m) => ({ ...m, [c.id]: e.target.value }))}>
                <option value="">Now enrolled as…</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
              </select>
              <Button size="sm" variant="outline" disabled={!pick[c.id]} onClick={() => request(c.id)}>Ask to link</Button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
