// §Consent W2/W4/W5/W6 — staff side in the chart's Consents section: send,
// track, signed copies (read-only), renew, revoke, sign in person.
// Every write goes through runAction. Draft — pending counsel review.
import { useState } from "react";
import { toast } from "sonner";
import { useEhr, type Patient } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { runAction } from "@/lib/actions/runAction";
import {
  listPublishedForms, listRequests, listSignedCopies, renewalsDue, intakePacketFor, CARE_IMPACT, STATUS_LABEL, CONSENT_DRAFT_LABEL, PLACEHOLDER_WORDING, DECLINE_OUTCOME, groupConsentGate, careStartBlocked, type FormKey,
} from "@/lib/consentForms";
import { patientPathway } from "@/lib/flagJourneys";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FormsToSign } from "./FormsToSign";

export function ConsentFormsPanel({ patient }: { patient: Patient }) {
  const acting = useActingStaff();
  const actor = { role: acting.role, staffId: acting.staffId, staffName: acting.staffName };
  const storeActor = { role: acting.role, ...(acting.staffId ? { staffId: acting.staffId } : {}), name: acting.staffName ?? acting.role };
  const snap = JSON.parse(useEhr(() => JSON.stringify({ reqs: listRequests(patient.id), copies: listSignedCopies(patient.id), forms: listPublishedForms().filter((f) => f.audience === "patient"), renew: renewalsDue(patient.id).map((c) => c.formKey), gate: groupConsentGate(patient.id) ?? null, blocked: careStartBlocked(patient.id) }))) as {
    reqs: ReturnType<typeof listRequests>; copies: ReturnType<typeof listSignedCopies>; forms: ReturnType<typeof listPublishedForms>; renew: FormKey[]; gate: string | null; blocked: boolean;
  };
  const [pick, setPick] = useState<FormKey[]>([]);
  const [sendOpen, setSendOpen] = useState(false);
  const [view, setView] = useState<string | null>(null);
  const [revoke, setRevoke] = useState<FormKey | null>(null);
  const [reason, setReason] = useState("");
  const [inPerson, setInPerson] = useState<"off" | "on" | "locked">("off");
  const run = (id: string, via: string, args: unknown[], ok: string) => {
    const r = runAction(id, actor, patient, { via, args });
    if (!r.ok) toast.error(r.reason);
    else toast.success(ok);
    return r.ok;
  };
  const latest = new Map<string, (typeof snap.reqs)[number]>();
  for (const r of snap.reqs) if (!r.advocateId) latest.set(r.formKey, r);
  const viewing = snap.copies.find((c) => c.copy.id === view);
  const lang = patient.preferredLanguage === "es" ? "es" : "en";

  return (
    <section className="rounded-md border border-border p-3 space-y-3" data-testid="consent-forms-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-navy">Forms to sign</h3>
          <p className="text-[11px] text-muted-foreground">{CONSENT_DRAFT_LABEL} · {PLACEHOLDER_WORDING}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" data-testid="send-intake-packet" onClick={() => run("consent_form_send", "buildIntakePacket", [patient.id, storeActor], "Intake packet sent")}>Send intake packet</Button>
          <Button size="sm" variant="outline" onClick={() => setSendOpen(true)}>Send a form</Button>
          <Button size="sm" data-testid="sign-in-person" onClick={() => setInPerson("on")}>Sign in person</Button>
        </div>
      </div>
      {snap.blocked && <p className="rounded bg-destructive/10 p-2 text-xs font-medium text-destructive">HIPAA declined — care can't start until it is signed.</p>}
      {snap.gate && <p className="rounded bg-amber-500/10 p-2 text-xs font-medium" data-testid="group-consent-needed">{snap.gate} — group booking unavailable. Individual visits and MAT are not affected.</p>}
      {latest.size === 0 ? <p className="text-xs text-muted-foreground">No forms sent yet.</p> : (
        <ul className="divide-y text-sm" data-testid="form-status-list">
          {[...latest.values()].map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
              <span>{snap.forms.find((f) => f.key === r.formKey)?.title.en ?? r.formKey} <span className="text-[11px] text-muted-foreground">v{r.version} · sent by {r.sentBy.name}{r.required ? "" : " · offered only"}</span></span>
              <span className="flex items-center gap-2">
                <Badge variant="outline" data-testid={`form-status-${r.formKey}`}>{STATUS_LABEL[r.status]}</Badge>
                {r.status === "declined" && DECLINE_OUTCOME[r.formKey] && <span className="text-[11px] text-muted-foreground">{DECLINE_OUTCOME[r.formKey]}</span>}
                {snap.renew.includes(r.formKey) && <Button size="sm" variant="ghost" onClick={() => run("consent_form_send", "resendCurrent", [patient.id, r.formKey, storeActor], "Current version resent")}>Resend</Button>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div>
        <h4 className="text-xs font-semibold text-navy">Signed copies (read only)</h4>
        {snap.copies.length === 0 ? <p className="text-xs text-muted-foreground">None yet.</p> : (
          <ul className="mt-1 space-y-1 text-xs" data-testid="signed-copies">
            {snap.copies.map(({ copy: c, ended, retainUntil }) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" className="text-left text-teal underline" onClick={() => setView(c.id)}>{c.title} · v{c.version} · {c.language.toUpperCase()} · {new Date(c.signedAt).toLocaleDateString()}</button>
                <span className="text-muted-foreground">{ended ? `${ended.reason} · keep until ${retainUntil} (Draft)` : "In effect"}</span>
                {!ended && <Button size="sm" variant="ghost" onClick={() => { setRevoke(c.formKey); setReason(""); }}>Revoke…</Button>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Sheet open={sendOpen} onOpenChange={setSendOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader><SheetTitle>Send forms</SheetTitle></SheetHeader>
          <p className="mt-1 text-xs text-muted-foreground">Published forms only. The patient gets a neutral notice ("You have a form to review"). SMS is Simulated.</p>
          <p className="mt-1 text-xs">Intake packet for this pathway: {intakePacketFor(patientPathway(patient.id)).map((i) => i.key).join(", ")}</p>
          <ul className="mt-3 space-y-2">
            {snap.forms.map((f) => (
              <li key={f.key}><label className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={pick.includes(f.key)} onCheckedChange={(v) => setPick((p) => (v ? [...p, f.key] : p.filter((x) => x !== f.key)))} /> {f.title.en} <span className="text-[11px] text-muted-foreground">v{f.version}</span></label></li>
            ))}
          </ul>
          <Button className="mt-3 w-full" disabled={!pick.length} onClick={() => { if (run("consent_form_send", "sendForms", [{ patientId: patient.id, formKeys: pick, actor: storeActor }], "Sent")) { setPick([]); setSendOpen(false); } }}>Send {pick.length || ""}</Button>
        </SheetContent>
      </Sheet>

      <Sheet open={!!viewing} onOpenChange={(o) => !o && setView(null)}>
        <SheetContent className="overflow-y-auto">
          {viewing && (<>
            <SheetHeader><SheetTitle>{viewing.copy.title}</SheetTitle></SheetHeader>
            <dl className="mt-2 grid grid-cols-2 gap-1 text-xs" data-testid="signed-copy-detail">
              <dt>Version</dt><dd>v{viewing.copy.version}</dd>
              <dt>Language</dt><dd>{viewing.copy.language.toUpperCase()}</dd>
              <dt>Text hash</dt><dd className="break-all">{viewing.copy.textHash}</dd>
              <dt>Method</dt><dd>{viewing.copy.signatureMethod.replace("_", " ")}</dd>
              <dt>Signer</dt><dd>{viewing.copy.signerName} ({viewing.copy.relationship})</dd>
              <dt>Signed</dt><dd>{new Date(viewing.copy.signedAt).toLocaleString()}</dd>
              <dt>Channel</dt><dd>{viewing.copy.channel.replace("_", " ")}</dd>
              <dt>Sent by</dt><dd>{viewing.copy.sentBy ?? "—"}</dd>
              <dt>Ends</dt><dd>{viewing.copy.endsOn ?? "No end date"}</dd>
              <dt>Retain until</dt><dd>{viewing.retainUntil ?? "10 years after it ends (Draft)"}</dd>
            </dl>
            <pre className="mt-3 whitespace-pre-wrap rounded bg-secondary p-2 text-xs">{viewing.copy.fullText}</pre>
          </>)}
        </SheetContent>
      </Sheet>

      <Sheet open={!!revoke} onOpenChange={(o) => !o && setRevoke(null)}>
        <SheetContent>
          <SheetHeader><SheetTitle>Revoke signed form</SheetTitle></SheetHeader>
          {revoke && <p className="mt-2 rounded bg-amber-500/10 p-2 text-sm" data-testid="care-impact">{CARE_IMPACT[revoke].en}</p>}
          <Textarea className="mt-3" aria-label="Reason" placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          <Button className="mt-3 w-full" variant="destructive" disabled={reason.trim().length < 3} onClick={() => { if (run("consent_form_revoke", "revokeForm", [{ patientId: patient.id, formKey: revoke, by: "staff", reason, actor: storeActor }], "Revoked — the signed copy stays on file")) setRevoke(null); }}>Revoke</Button>
        </SheetContent>
      </Sheet>

      {inPerson !== "off" && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background p-4" data-testid="in-person-mode">
          {inPerson === "on" ? (
            <div className="mx-auto max-w-xl space-y-3">
              <FormsToSign patientId={patient.id} lang={lang} channel="in_person" patientName={`${patient.firstName} ${patient.lastName}`} />
              <Button variant="outline" className="min-h-11 w-full rounded-full" onClick={() => setInPerson("locked")}>{lang === "es" ? "Terminé" : "I'm done"}</Button>
            </div>
          ) : (
            <div className="mx-auto mt-24 max-w-sm space-y-4 text-center" data-testid="in-person-locked">
              <p className="text-lg font-semibold">Locked — please hand the tablet back to staff.</p>
              <Button onClick={() => setInPerson("off")}>Staff: unlock</Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
