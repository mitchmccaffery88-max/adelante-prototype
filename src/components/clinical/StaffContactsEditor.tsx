// §K2 — staff edit of emergency contacts + advocate, the same model as
// onboarding: relationship dropdown, separate phone and email, "Make this
// person the advocate" link, and the change prompt (AdvocateStatusList).
import { useState } from "react";
import { toast } from "sonner";
import { useEhr, type EmergencyContact, type Patient } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { runAction } from "@/lib/actions/runAction";
import { readEmergencyContacts, emptyEmergencyContact } from "@/lib/emergencyContacts";
import { relationshipFromText, relationshipText, validPhone, validEmail, newContactId, advocateDraftFromContact, authorizationForAdvocateType, validateAdvocateDraft, emptyAdvocateDraft, type AdvocateDraft } from "@/lib/contactAdvocate";
import { RelationshipSelect, AdvocateSection } from "@/components/advocate/AdvocateSection";
import { AdvocateStatusList } from "@/components/advocate/AdvocateStatusList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function StaffContactsEditor({ patient, readOnly }: { patient: Patient; readOnly?: boolean }) {
  const acting = useActingStaff();
  const actor = { role: acting.role, staffId: acting.staffId, staffName: acting.staffName };
  const saved = useEhr(() => JSON.stringify(readEmergencyContacts(AdelanteEHRPatient(patient.id))));
  const [rows, setRows] = useState<EmergencyContact[]>(() => JSON.parse(saved) as EmergencyContact[]);
  const [adv, setAdv] = useState<AdvocateDraft | null>(null);
  const set = (i: number, patch: Partial<EmergencyContact>) => setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const errs = rows.map((c) => [c.phone && !validPhone(c.phone) ? "phone" : "", c.email && !validEmail(c.email) ? "email" : ""].filter(Boolean));
  const save = () => {
    const withIds = rows.map((c) => (c.id ? c : { ...c, id: newContactId() }));
    const r = runAction("patient_contacts_update", actor, patient, { args: [patient.id, withIds, { staffId: acting.staffId, name: acting.staffName ?? acting.role, role: acting.role }] });
    if (r.ok) { setRows(withIds); toast.success("Contacts saved"); } else toast.error(r.reason);
  };
  const invite = () => {
    if (!adv) return;
    const e = validateAdvocateDraft(adv);
    if (e.length) { toast.error("Check the advocate details."); return; }
    const linked = rows.find((c) => c.id === adv.contactId);
    const r = runAction("patient_contacts_update", actor, patient, { via: "createAdvocateInvitation", args: [{
      patientId: patient.id, advocateName: adv.name, relationship: relationshipText(adv.relationshipId, adv.relationshipOther),
      invitationSentTo: adv.sendBy === "sms" ? adv.phone.trim() : adv.email.trim(), invitationChannel: adv.sendBy,
      expectedAuthorizationType: authorizationForAdvocateType(adv.typeId) ?? "family_participation",
      designatedBy: { actor: acting.role === "ecm_provider" ? "ecm_provider" : "administrator", name: acting.staffName ?? acting.role },
      ...(linked?.id ? { contactId: linked.id, contactSnapshot: { name: linked.name, phone: linked.phone, ...(linked.email ? { email: linked.email } : {}) } } : {}),
    }] });
    if (r.ok) { toast.success("Advocate invited — waits for the patient's consent"); setAdv(null); } else toast.error(r.reason);
  };
  return (
    <div className="space-y-2" data-testid="staff-contacts-editor">
      {rows.map((c, i) => {
        const rel = relationshipFromText(c.relationship);
        return (
          <div key={c.id ?? i} className="space-y-2 rounded border p-2" data-testid={`staff-contact-${i}`}>
            <div className="text-xs font-medium">{i === 0 ? "Primary contact" : `Contact ${i + 1}`}</div>
            <Input aria-label={`Name — contact ${i + 1}`} placeholder="Name" value={c.name} disabled={readOnly} onChange={(e) => set(i, { name: e.target.value })} />
            <RelationshipSelect value={rel.id} other={rel.other} lang="en" label={`Relationship — contact ${i + 1}`} onChange={(id, other) => set(i, { relationship: relationshipText(id, other) })} />
            <Input aria-label={`Phone — contact ${i + 1}`} placeholder="Phone" value={c.phone} disabled={readOnly} onChange={(e) => set(i, { phone: e.target.value })} />
            {errs[i]!.includes("phone") && <p className="text-xs text-destructive">Enter a 10-digit phone number.</p>}
            <Input aria-label={`Email — contact ${i + 1}`} placeholder="Email" value={c.email ?? ""} disabled={readOnly} onChange={(e) => set(i, { email: e.target.value })} />
            {errs[i]!.includes("email") && <p className="text-xs text-destructive">Enter a valid email.</p>}
            {!readOnly && c.id && <button type="button" className="min-h-11 text-xs font-medium text-teal underline" onClick={() => setAdv(advocateDraftFromContact(c, emptyAdvocateDraft()))}>Make this person the advocate</button>}
          </div>
        );
      })}
      {!readOnly && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setRows((r) => [...r, emptyEmergencyContact()])}>Add contact</Button>
          <Button size="sm" disabled={errs.some((e) => e.length > 0)} onClick={save}>Save contacts</Button>
        </div>
      )}
      <AdvocateStatusList patientId={patient.id} />
      <Sheet open={!!adv} onOpenChange={(o) => !o && setAdv(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader><SheetTitle>Make advocate</SheetTitle></SheetHeader>
          <p className="mt-1 text-xs text-muted-foreground">The patient signs the advocate consent themselves (Forms to sign). Nothing is shared until both sign.</p>
          {adv && <AdvocateSection draft={adv} onChange={(d) => setAdv(d)} on onToggle={() => setAdv(null)} errors={[]} lang="en" />}
          <Button className="mt-3 w-full" onClick={invite}>Invite advocate</Button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
import { AdelanteEHR } from "@/lib/ehr";
const AdelanteEHRPatient = (id: string) => AdelanteEHR.getPatient(id);
