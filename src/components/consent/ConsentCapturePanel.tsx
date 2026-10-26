// §B2-2 — staff capture of typed consent records in the chart's Consents
// section: record (in-person e-sign or verbal assent where allowed), upload a
// paper copy (Simulated) or send for patient e-sign, plus the typed-record
// history. Every write goes through runAction. Draft — pending counsel.
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { useEhr, type Patient } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { runAction, confirmationFor } from "@/lib/actions/runAction";
import { chartAction } from "@/lib/chartActions";
import {
  CAPTURE_DRAFT_LABEL,
  CONSENT_TYPE_LABEL,
  UPLOAD_SIMULATED_LABEL,
  consentRecordHistory,
  listESignRequests,
  type CaptureDraft,
  type HistoryRow,
} from "@/lib/consentCapture";
import {
  PART2_ELEMENT_KEYS,
  PART2_ELEMENT_LABELS,
  VERBAL_ASSENT_REFERRER_PURPOSE,
  isPart2Type,
  verbalAssentAllowed,
  type ConsentType,
  type Part2ElementKey,
} from "@/lib/consentRecordModel";
import { CONSENT_PURPOSES, PURPOSE_LABEL, type ConsentPurposeCode } from "@/lib/consentPurposes";
import { CHANNEL_LABEL, getDisclosureEntry } from "@/lib/part2Disclosure";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusChip } from "@/components/ui/status-chip";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useConfirmDialog } from "@/components/staff/use-confirm-dialog";
import { REVOKE_WORDING_DRAFT, type RevokeMethod } from "@/lib/consentLifecycle";

type Mode = "capture" | "upload" | "esign";
const TYPES = Object.keys(CONSENT_TYPE_LABEL) as ConsentType[];
const STATUS_WORD: Record<HistoryRow["status"], string> = { active: "Active", expired: "Expired", revoked: "Revoked", superseded: "Superseded", legacy_unverified: "Legacy: unverified" };
const METHOD_WORD = { e_sign: "E-signature", wet_sign_upload: "Paper upload", verbal_assent: "Verbal assent" } as const;
const field = "mt-1 block min-h-9 w-full rounded-sm border border-input bg-background px-2 text-sm";

export function ConsentCapturePanel({ patient }: { patient: Patient }) {
  const acting = useActingStaff();
  const actor = { role: acting.role, staffId: acting.staffId, staffName: acting.staffName };
  const storeActor = { role: acting.role, ...(acting.staffId ? { staffId: acting.staffId } : {}), name: acting.staffName ?? acting.role };
  const snap = JSON.parse(useEhr(() => JSON.stringify({ rows: consentRecordHistory(patient.id), waiting: listESignRequests(patient.id).filter((r) => r.status === "waiting").length }))) as { rows: HistoryRow[]; waiting: number };
  const can = (id: string) => chartAction(id).allowed(actor, patient).state !== "hidden";
  const [mode, setMode] = useState<Mode | null>(null);
  const [view, setView] = useState<string | null>(null);
  const [renew, setRenew] = useState<HistoryRow | null>(null);
  // The dialog's request is captured once at ask(); the live selection lives
  // in RevokeMethodField's own state and is read through this ref on confirm.
  const revokeMethod = useRef<RevokeMethod>("written");
  const confirm = useConfirmDialog();
  const viewing = snap.rows.find((r) => r.id === view);
  const showCapture = can("consent_record_capture");
  const showUpload = can("consent_record_upload");
  const showSend = can("consent_record_request_esign");
  const showRenew = can("consent_record_renew");
  const showRevoke = can("consent_record_revoke");
  const askRevoke = (r: HistoryRow) => {
    revokeMethod.current = "written";
    confirm.ask({
      title: `Revoke: ${CONSENT_TYPE_LABEL[r.consentType].en}`,
      description: REVOKE_WORDING_DRAFT,
      confirmLabel: "Revoke consent",
      keepLabel: "Keep it",
      reasonLabel: "Note (optional)",
      children: <RevokeMethodField initial="written" onChange={(m) => { revokeMethod.current = m; }} />,
      onConfirm: (reason) => {
        const r2 = runAction("consent_record_revoke", actor, patient, { via: "revokeTypedConsent", args: [{ recordId: r.id, method: revokeMethod.current, note: reason, actor: storeActor }] });
        if (r2.ok) toast.success(confirmationFor("consent_record_revoke", "Consent revoked — it stays in the history"));
        else toast.error(r2.reason);
        return r2.ok;
      },
    });
  };

  return (
    <section className="space-y-3 rounded-md border border-border p-3" data-testid="consent-capture-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Consent records</h3>
          <p className="text-[14px] text-muted-foreground">{CAPTURE_DRAFT_LABEL}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {showSend && <Button size="sm" variant="outline" onClick={() => setMode("esign")} data-testid="consent-send-esign">Send for e-sign</Button>}
          {showUpload && <Button size="sm" variant="outline" onClick={() => setMode("upload")} data-testid="consent-upload">Upload paper copy</Button>}
          {showCapture && <Button size="sm" onClick={() => setMode("capture")} data-testid="consent-capture">Record a consent</Button>}
        </div>
      </div>
      {snap.waiting > 0 && <p className="text-[14px]" data-testid="consent-esign-waiting"><StatusChip lang="en" state="team" label={`Waiting on patient: ${snap.waiting} to sign`} /></p>}
      {snap.rows.length === 0 ? (
        <p className="text-[14px] text-muted-foreground">No typed consent records yet.</p>
      ) : (
        <ol className="divide-y text-[14px]" data-testid="consent-history">
          {snap.rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5" data-testid={`consent-history-${r.consentType}`}>
              <button type="button" className="text-left text-primary underline" onClick={() => setView(r.id)}>
                {CONSENT_TYPE_LABEL[r.consentType].en} · {r.recipients.map((x) => x.name).join(", ")} · v{r.document?.version ?? 1}
              </button>
              <span className="flex flex-wrap items-center gap-2">
                {r.purposeNeedsReview && <StatusChip lang="en" state="yourturn" label="Purpose needs review" data-testid={`purpose-review-${r.id}`} />}
                {r.simulatedUpload && <StatusChip lang="en" state="simulated" label="Simulated" />}
                <StatusChip lang="en" state={r.status === "active" ? "done" : "closed"} label={STATUS_WORD[r.status]} data-testid={`consent-status-${r.id}`} />
              </span>
            </li>
          ))}
        </ol>
      )}

      <Sheet open={!!mode} onOpenChange={(o) => !o && setMode(null)}>
        <SheetContent className="overflow-y-auto">
          {mode && <CaptureForm mode={mode} patient={patient} onDone={(ok, msg, id) => { if (ok) { toast.success(confirmationFor(id, msg)); setMode(null); } else toast.error(msg); }} run={(id, via, args) => runAction(id, actor, patient, { via, args })} storeActor={storeActor} />}
        </SheetContent>
      </Sheet>

      <Sheet open={!!renew} onOpenChange={(o) => !o && setRenew(null)}>
        <SheetContent className="overflow-y-auto">
          {renew && <CaptureForm mode="capture" patient={patient} renewFrom={renew} onDone={(ok, msg, id) => { if (ok) { toast.success(confirmationFor(id, msg)); setRenew(null); } else toast.error(msg); }} run={(id, via, args) => runAction(id, actor, patient, { via, args })} storeActor={storeActor} />}
        </SheetContent>
      </Sheet>
      {confirm.dialog}

      <Sheet open={!!viewing} onOpenChange={(o) => !o && setView(null)}>
        <SheetContent className="overflow-y-auto">
          {viewing && (
            <>
              <SheetHeader><SheetTitle>{CONSENT_TYPE_LABEL[viewing.consentType].en}</SheetTitle></SheetHeader>
              <dl className="mt-2 grid grid-cols-2 gap-1 text-[14px]" data-testid="consent-record-detail">
                <dt>Status</dt><dd>{STATUS_WORD[viewing.status]}</dd>
                <dt>Recipients</dt><dd>{viewing.recipients.map((x) => `${x.name} (${x.kind})`).join(", ")}</dd>
                <dt>Purpose</dt><dd>{viewing.purpose ?? "—"}</dd>
                <dt>Covers</dt><dd>{viewing.items.join(", ")}</dd>
                <dt>In force</dt><dd>{viewing.effectiveDate} → {viewing.expirationDate ?? viewing.expiresOnEvent ?? "—"}</dd>
                <dt>Method</dt><dd>{viewing.method ? METHOD_WORD[viewing.method] : "—"}</dd>
                <dt>Signer</dt><dd>{viewing.signer} ({viewing.relationship})</dd>
                <dt>Signed</dt><dd>{viewing.signedAt?.slice(0, 10)}</dd>
                <dt>Recorded by</dt><dd>{viewing.recordedBy}</dd>
                {viewing.witness && (<><dt>Witness</dt><dd>{viewing.witness}</dd></>)}
                {viewing.assentWording && (<><dt>Words read</dt><dd>{viewing.assentWording}</dd></>)}
                <dt>Template</dt><dd>{viewing.document?.formKey} v{viewing.document?.version}</dd>
                <dt>Document hash</dt><dd className="break-all font-mono">{viewing.document?.documentHash}</dd>
                {viewing.document?.uploadRef && (<><dt>Paper copy</dt><dd>{UPLOAD_SIMULATED_LABEL}</dd></>)}
                {viewing.supersedesId && (<><dt>Replaces</dt><dd className="font-mono">{viewing.supersedesId}</dd></>)}
                <dt>Disclosures</dt><dd data-testid="consent-linked-disclosures">{viewing.disclosureIds.length ? (
                  <ul className="space-y-1">
                    {viewing.disclosureIds.map((id) => {
                      const d = getDisclosureEntry(id);
                      return <li key={id} data-testid={`consent-linked-disclosure-${id}`}><span className="font-mono">{id}</span>{d ? ` · ${CHANNEL_LABEL[d.channel]} · ${d.at.slice(0, 10)} · ${d.recipient.type}` : ""}</li>;
                    })}
                  </ul>
                ) : "None linked yet"}</dd>
              </dl>
              {viewing.status === "active" && (showRenew || showRevoke) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {showRenew && <Button size="sm" variant="outline" onClick={() => { const r = viewing; setView(null); setRenew(r); }} data-testid={`consent-renew-${viewing.id}`}>Renew</Button>}
                  {showRevoke && <Button size="sm" variant="outline" onClick={() => { const r = viewing; setView(null); askRevoke(r); }} data-testid={`consent-revoke-${viewing.id}`}>Revoke</Button>}
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function CaptureForm({ mode, patient, run, onDone, storeActor, renewFrom }: {
  mode: Mode;
  patient: Patient;
  storeActor: { role: string; staffId?: string; name: string };
  run: (id: string, via: string, args: unknown[]) => { ok: boolean; reason?: string };
  onDone: (ok: boolean, msg: string, id: string) => void;
  /** §B2-3 — when set, the form renews this record: terms are fixed from it. */
  renewFrom?: HistoryRow;
}) {
  const [type, setType] = useState<ConsentType>(renewFrom?.consentType ?? "hipaa_authorization");
  const [recipient, setRecipient] = useState(renewFrom?.recipients.map((x) => x.name).join(", ") ?? "");
  const [kind, setKind] = useState<"person" | "org">(renewFrom?.recipients[0]?.kind ?? "org");
  const [purposePick, setPurposePick] = useState<ConsentPurposeCode | "">((renewFrom?.purposeCode as ConsentPurposeCode | undefined) ?? "");
  const [purposeNote, setPurposeNote] = useState("");
  const [enrolledOnly, setEnrolledOnly] = useState(false);
  const [items, setItems] = useState(renewFrom?.items.join(", ") ?? "");
  const [endDate, setEndDate] = useState("");
  const [endEvent, setEndEvent] = useState("");
  const [elements, setElements] = useState<Partial<Record<Part2ElementKey, boolean>>>({});
  const [method, setMethod] = useState<"e_sign" | "verbal_assent">("e_sign");
  const [signer, setSigner] = useState(`${patient.firstName} ${patient.lastName}`);
  const [relationship, setRelationship] = useState<"patient" | "guardian" | "proxy">("patient");
  const [attested, setAttested] = useState(false);
  const [wording, setWording] = useState("");
  const [witness, setWitness] = useState("");
  const [signedOn, setSignedOn] = useState("");
  const [fileName, setFileName] = useState("");
  const part2 = isPart2Type(type);
  // Required picker stores the code; the label (plus optional note) is display text only.
  const purposeCode: string | undefined = type === "referrer_authorization" && enrolledOnly ? VERBAL_ASSENT_REFERRER_PURPOSE : purposePick || undefined;
  const purpose = renewFrom ? renewFrom.purpose ?? "" : purposeCode ? `${PURPOSE_LABEL[purposeCode as ConsentPurposeCode]}${purposeNote.trim() ? ` — ${purposeNote.trim()}` : ""}` : "";
  const verbalOk = verbalAssentAllowed(type, purposeCode);
  const draft: CaptureDraft = {
    patientId: patient.id,
    consentType: type,
    recipients: recipient.trim() ? [{ kind, name: recipient.trim() }] : [],
    purpose,
    ...(purposeCode ? { purposeCode } : {}),
    items: items.split(",").map((s) => s.trim()).filter(Boolean),
    ...(endDate ? { expiresOn: endDate } : {}),
    ...(endEvent.trim() ? { expiresOnEvent: endEvent.trim() } : {}),
    ...(part2 ? { part2Elements: elements } : {}),
  };
  const title = renewFrom ? "Renew this consent" : mode === "capture" ? "Record a consent" : mode === "upload" ? "Upload a signed paper consent" : "Send a consent for e-sign";
  const submit = () => {
    if (!renewFrom && !purposeCode) { onDone(false, "Choose a purpose.", "consent_record_capture"); return; }
    const effMethod = verbalOk ? method : "e_sign";
    if (renewFrom) {
      const r = run("consent_record_renew", "renewTypedConsent", [{ recordId: renewFrom.id, ...(endDate ? { expiresOn: endDate } : {}), ...(endEvent.trim() ? { expiresOnEvent: endEvent.trim() } : {}), method: effMethod, signer, relationship, attested, ...(effMethod === "verbal_assent" ? { assentWording: wording } : {}), ...(witness.trim() ? { witness } : {}), actor: storeActor }]);
      onDone(r.ok, r.ok ? "Renewed — the old version stays in the history" : r.reason ?? "Couldn't save.", "consent_record_renew");
      return;
    }
    const r =
      mode === "capture"
        ? run("consent_record_capture", "captureConsentRecord", [{ draft, method: effMethod, signer, relationship, attested, ...(effMethod === "verbal_assent" ? { assentWording: wording } : {}), ...(witness.trim() ? { witness } : {}), actor: storeActor }])
        : mode === "upload"
          ? run("consent_record_upload", "uploadPaperConsent", [{ draft, signer, relationship, signedOn, fileName, ...(witness.trim() ? { witness } : {}), actor: storeActor }])
          : run("consent_record_request_esign", "requestConsentESign", [{ draft, actor: storeActor }]);
    const id = mode === "capture" ? "consent_record_capture" : mode === "upload" ? "consent_record_upload" : "consent_record_request_esign";
    onDone(r.ok, r.ok ? (mode === "esign" ? "Sent — the patient sees it in Forms to sign" : "Consent recorded") : r.reason ?? "Couldn't save.", id);
  };
  return (
    <div className="space-y-3 text-sm" data-testid={`consent-form-${mode}`}>
      <SheetHeader><SheetTitle>{title}</SheetTitle></SheetHeader>
      <p className="text-[14px] text-muted-foreground">{CAPTURE_DRAFT_LABEL}{mode === "upload" ? ` · ${UPLOAD_SIMULATED_LABEL}` : ""}</p>
      {renewFrom ? (
        <dl className="space-y-1 rounded-sm border border-border p-2 text-[14px]" data-testid="renew-terms">
          <div><dt className="inline font-semibold">Type: </dt><dd className="inline">{CONSENT_TYPE_LABEL[renewFrom.consentType].en}</dd></div>
          <div><dt className="inline font-semibold">Recipients: </dt><dd className="inline">{renewFrom.recipients.map((x) => x.name).join(", ")}</dd></div>
          <div><dt className="inline font-semibold">Purpose: </dt><dd className="inline">{renewFrom.purpose}</dd></div>
          <div><dt className="inline font-semibold">Covers: </dt><dd className="inline">{renewFrom.items.join(", ")}</dd></div>
          <p className="text-muted-foreground">Same terms as the record it replaces{part2 ? ", including the Part 2 checklist and redisclosure notice" : ""}. Set a new end date or event below.</p>
        </dl>
      ) : (
        <>
      <label className="block">Consent type
        <select className={field} value={type} onChange={(e) => { setType(e.target.value as ConsentType); setMethod("e_sign"); }} aria-label="Consent type">
          {TYPES.map((t) => <option key={t} value={t}>{CONSENT_TYPE_LABEL[t].en}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="col-span-2 block">Recipient<Input className="mt-1" aria-label="Recipient" value={recipient} maxLength={120} onChange={(e) => setRecipient(e.target.value)} /></label>
        <label className="block">Kind
          <select className={field} value={kind} onChange={(e) => setKind(e.target.value as "person" | "org")} aria-label="Recipient kind"><option value="org">Organization</option><option value="person">Person</option></select>
        </label>
      </div>
      <label className="block">Purpose <span className="text-muted-foreground">(Required)</span>
        <select className={field} value={purposePick} required aria-required="true" onChange={(e) => setPurposePick(e.target.value as ConsentPurposeCode | "")} aria-label="Purpose">
          <option value="">Choose a purpose</option>
          {CONSENT_PURPOSES.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
        </select>
      </label>
      <label className="block">Purpose note (optional)<Input className="mt-1" aria-label="Purpose note" value={purposeNote} maxLength={200} onChange={(e) => setPurposeNote(e.target.value)} /></label>
      {type === "referrer_authorization" && (
        <label className="flex min-h-9 items-center gap-2"><Checkbox checked={enrolledOnly} onCheckedChange={(v) => setEnrolledOnly(v === true)} aria-label="Enrolled update only" /> Only the &quot;enrolled on &lt;date&gt;&quot; update</label>
      )}
      <label className="block">Information covered (comma separated)<Input className="mt-1" aria-label="Information covered" value={items} maxLength={300} onChange={(e) => setItems(e.target.value)} /></label>
        </>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="block">Ends on<Input className="mt-1" type="date" aria-label="Ends on" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
        <label className="block">Or ends when<Input className="mt-1" aria-label="Ends when" value={endEvent} maxLength={120} onChange={(e) => setEndEvent(e.target.value)} /></label>
      </div>
      {part2 && !renewFrom && (
        <fieldset className="rounded-sm border border-border p-2" data-testid="part2-checklist">
          <legend className="px-1 font-semibold">Part 2 required elements · Draft — pending counsel</legend>
          {PART2_ELEMENT_KEYS.map((k) => (
            <label key={k} className="flex min-h-9 items-center gap-2"><Checkbox checked={!!elements[k]} onCheckedChange={(v) => setElements((e) => ({ ...e, [k]: v === true }))} aria-label={PART2_ELEMENT_LABELS[k]} /> {PART2_ELEMENT_LABELS[k]}</label>
          ))}
          <p className="mt-1 text-[14px] text-muted-foreground"><Lock className="mr-1 inline size-4 align-text-bottom" aria-hidden="true" />Needs an e-signature or an uploaded wet signature. Includes the redisclosure notice.</p>
        </fieldset>
      )}
      {mode !== "esign" && (
        <>
          {mode === "capture" && verbalOk && (
            <label className="block">How it was given
              <select className={field} value={method} onChange={(e) => setMethod(e.target.value as "e_sign" | "verbal_assent")} aria-label="Signature method"><option value="e_sign">E-signature in person</option><option value="verbal_assent">Verbal assent</option></select>
            </label>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="block">Signer<Input className="mt-1" aria-label="Signer" value={signer} maxLength={100} onChange={(e) => setSigner(e.target.value)} /></label>
            <label className="block">Signing as
              <select className={field} value={relationship} onChange={(e) => setRelationship(e.target.value as typeof relationship)} aria-label="Signing as"><option value="patient">Patient</option><option value="guardian">Guardian</option><option value="proxy">Legal representative</option></select>
            </label>
          </div>
          {mode === "capture" && method === "verbal_assent" && verbalOk && (
            <label className="block">Exact words read to the person<Textarea className="mt-1" aria-label="Exact words read" value={wording} maxLength={600} onChange={(e) => setWording(e.target.value)} /></label>
          )}
          {mode === "upload" && (
            <div className="grid grid-cols-2 gap-2">
              <label className="block">Date on the paper<Input className="mt-1" type="date" aria-label="Date on the paper" value={signedOn} onChange={(e) => setSignedOn(e.target.value)} /></label>
              <label className="block">Scanned file<Input className="mt-1" type="file" aria-label="Scanned file" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")} /></label>
            </div>
          )}
          <label className="block">Witness (optional)<Input className="mt-1" aria-label="Witness" value={witness} maxLength={100} onChange={(e) => setWitness(e.target.value)} /></label>
          {mode === "capture" && (
            <label className="flex min-h-9 items-center gap-2"><Checkbox checked={attested} onCheckedChange={(v) => setAttested(v === true)} aria-label="Attestation" /> {method === "verbal_assent" && verbalOk ? "I read these exact words and heard the person agree." : "The signer typed their name and agreed in front of me."}</label>
          )}
        </>
      )}
      <Button className="w-full" onClick={submit} data-testid="consent-form-submit">{mode === "esign" ? "Send to patient" : "Save consent record"}</Button>
    </div>
  );
}

/** Owns the live method selection inside the revoke dialog. */
export function RevokeMethodField({ initial, onChange }: { initial: RevokeMethod; onChange: (m: RevokeMethod) => void }) {
  const [value, setValue] = useState<RevokeMethod>(initial);
  return (
    <label className="block text-sm">How the person asked
      <select className={field} value={value} onChange={(e) => { const m = e.target.value as RevokeMethod; setValue(m); onChange(m); }} aria-label="Revocation method">
        <option value="written">In writing</option>
        <option value="e_sign">E-sign / portal</option>
        <option value="oral">Told to staff</option>
      </select>
    </label>
  );
}
