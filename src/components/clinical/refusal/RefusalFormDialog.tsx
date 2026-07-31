// §MAR Phase 3 — Refusal legal document (port of the reference's
// RefusalFormDialog).
//
// The refused dose is ALREADY charted before this dialog opens. Closing or
// "Sign later" leaves the form in pending_signature — it never un-charts the
// administration and never blocks the MAR.
import { useEffect, useMemo, useState } from "react";
import { AdelanteEHR, useEhr, type RefusalForm } from "@/lib/ehr";
import {
  CAPACITY_BANNER_TEXT,
  DECLINE_REASONS,
  GUARDIAN_NOTE_TEXT,
  INTERPRETER_METHODS,
  NURSE_ATTESTATION_TEXT,
  needsInterpreter,
  refusalFinalizeProblems,
  refusalMedSummary,
  witnessRequiredFor,
  type PatientMode,
  type RefusalFinalizePayload,
} from "@/lib/refusal";
import { witnessCandidates } from "@/lib/mar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SignaturePad } from "./SignaturePad";
import { toast } from "sonner";
import { AlertTriangle, Info } from "lucide-react";

const emptyPayload = (): RefusalFinalizePayload => ({ nurseAttested: false });

export function RefusalFormDialog({
  patientId,
  form,
  staffName,
  onClose,
  onFinalized,
}: {
  patientId: string;
  form: RefusalForm | null;
  staffName: string;
  onClose: () => void;
  onFinalized: (form: RefusalForm, orderId: string) => void;
}) {
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const [payload, setPayload] = useState<RefusalFinalizePayload>(emptyPayload);

  // Reset every field when the target form changes — one patient's signature
  // must never bleed onto the next queued refusal.
  useEffect(() => {
    setPayload(emptyPayload());
  }, [form?.id]);

  const admin = useMemo(
    () => (patient?.administrations ?? []).find((a) => a.id === form?.administrationId),
    [patient, form?.administrationId],
  );
  const order = useMemo(
    () => (patient?.orders ?? []).find((o) => o.id === admin?.orderId),
    [patient, admin?.orderId],
  );
  const witnesses = useMemo(() => witnessCandidates(staffName), [staffName]);

  if (!form) return null;

  const patch = (p: Partial<RefusalFinalizePayload>) => setPayload((prev) => ({ ...prev, ...p }));
  const capacityFlagged = form.capacityFlagsAtSigning.length > 0;
  const interpreterNeeded = needsInterpreter(form.languageCode);
  const witnessNeeded = witnessRequiredFor(payload.patientMode, form.capacityFlagsAtSigning);
  const problems = refusalFinalizeProblems(form, payload);

  const finalize = () => {
    try {
      const saved = AdelanteEHR.finalizeRefusalForm(patientId, form.id, payload, staffName);
      toast.success("Refusal document finalized.");
      onFinalized(saved, admin?.orderId ?? "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not finalize the refusal document.");
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Medication refusal — legal document</DialogTitle>
          <DialogDescription>
            Completing this form documents the refusal for the legal record. The dose is already
            charted as refused; closing without signing leaves the form pending signature.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* ----- Medication summary ------------------------------------ */}
          <div className="rounded-md border border-border p-3">
            <div className="font-medium">{refusalMedSummary(order)}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{form.medClass === "*" ? "General" : form.medClass}</Badge>
              <span>Risk text {form.riskTextVersion}</span>
              {admin?.reason && <span>· Refusal reason charted: {admin.reason}</span>}
            </div>
          </div>

          {/* ----- Capacity banner (reference wording, verbatim) ---------- */}
          {capacityFlagged && (
            <div className="flex gap-2 rounded-md border border-amber-500/60 bg-amber-50/40 p-3 text-xs dark:bg-amber-950/10">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p>{CAPACITY_BANNER_TEXT}</p>
                <p className="mt-1 text-muted-foreground">
                  Active flags: {form.capacityFlagsAtSigning.join(", ")}
                </p>
              </div>
            </div>
          )}

          {/* ----- Guardian note (note only — no capture flow this pass) -- */}
          {form.guardianRequired && (
            <div className="flex gap-2 rounded-md border border-border p-3 text-xs">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p>{GUARDIAN_NOTE_TEXT}</p>
            </div>
          )}

          {/* ----- Interpreter ------------------------------------------- */}
          {interpreterNeeded && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <Label className="text-xs">
                Interpretation (patient language: {form.languageCode.toUpperCase()}) *
              </Label>
              <Select
                value={payload.interpreterMethod ?? ""}
                onValueChange={(v) => patch({ interpreterMethod: v, interpreterUsed: v !== "not_available" })}
              >
                <SelectTrigger aria-label="Interpreter method" className="w-full">
                  <SelectValue placeholder="How was interpretation provided?" />
                </SelectTrigger>
                <SelectContent>
                  {INTERPRETER_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {payload.interpreterMethod && payload.interpreterMethod !== "not_available" && (
                <Input
                  aria-label="Interpreter name or ID"
                  placeholder="Interpreter name or line ID"
                  value={payload.interpreterName ?? ""}
                  onChange={(e) => patch({ interpreterName: e.target.value })}
                />
              )}
              {payload.interpreterMethod === "not_available" && (
                <Textarea
                  aria-label="Interpreter absent justification"
                  rows={2}
                  placeholder="Why was it necessary to proceed without an interpreter?"
                  value={payload.interpreterAbsentJustification ?? ""}
                  onChange={(e) => patch({ interpreterAbsentJustification: e.target.value })}
                />
              )}
              <p className="text-xs text-muted-foreground">
                Risk text below is English only in this release — a Spanish version requires
                clinical review before it can be presented as a legal disclosure.
              </p>
            </div>
          )}

          {/* ----- Risk text + nurse attestation -------------------------- */}
          <div className="rounded-md border border-border p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Risks of refusing this medication
            </div>
            <p className="mt-2 whitespace-pre-line">{form.riskTextSnapshot}</p>
            <label className="mt-3 flex items-start gap-2">
              <Checkbox
                checked={payload.nurseAttested}
                onCheckedChange={(v) => patch({ nurseAttested: v === true })}
                aria-label="Nurse risk attestation"
              />
              <span>{NURSE_ATTESTATION_TEXT}</span>
            </label>
          </div>

          {/* ----- Patient signed / declined branch ----------------------- */}
          <div className="space-y-2 rounded-md border border-border p-3">
            <Label className="text-xs">Patient acknowledgment *</Label>
            <div className="flex flex-wrap gap-2">
              {(["signed", "declined"] as PatientMode[]).map((m) => (
                <Button
                  key={m}
                  size="sm"
                  variant={payload.patientMode === m ? "default" : "outline"}
                  aria-label={`patient ${m}`}
                  onClick={() => patch({ patientMode: m })}
                >
                  {m === "signed" ? "Patient signs" : "Patient declines to sign"}
                </Button>
              ))}
            </div>

            {payload.patientMode === "signed" && (
              <SignaturePad
                label="Patient signature"
                required
                value={payload.patientSignatureDataUrl}
                onChange={(v) => patch({ patientSignatureDataUrl: v })}
              />
            )}

            {payload.patientMode === "declined" && (
              <div className="space-y-2">
                <Select
                  value={payload.patientDeclineReason ?? ""}
                  onValueChange={(v) => patch({ patientDeclineReason: v })}
                >
                  <SelectTrigger aria-label="Decline reason" className="w-full">
                    <SelectValue placeholder="Why did the patient not sign?" />
                  </SelectTrigger>
                  <SelectContent>
                    {DECLINE_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  aria-label="Decline notes"
                  rows={2}
                  placeholder="Optional notes"
                  value={payload.patientDeclineNotes ?? ""}
                  onChange={(e) => patch({ patientDeclineNotes: e.target.value })}
                />
              </div>
            )}
          </div>

          {/* ----- Witness (only when a non-flagged patient declines) ------ */}
          {witnessNeeded && (
            <div className="space-y-2 rounded-md border border-amber-500/60 p-3">
              <Label className="text-xs text-amber-700 dark:text-amber-400">
                Witness to the patient's refusal to sign *
              </Label>
              <Select
                value={payload.witnessStaffName ?? ""}
                onValueChange={(v) => patch({ witnessStaffName: v })}
              >
                <SelectTrigger aria-label="Refusal witness" className="w-full">
                  <SelectValue placeholder="Select witnessing clinician" />
                </SelectTrigger>
                <SelectContent>
                  {witnesses.map((w) => (
                    <SelectItem key={w.id} value={w.name}>
                      {w.name}
                      {w.credential ? ` · ${w.credential}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <SignaturePad
                label="Witness signature"
                value={payload.witnessSignatureDataUrl}
                onChange={(v) => patch({ witnessSignatureDataUrl: v })}
              />
            </div>
          )}

          {/* ----- Nurse signature + note --------------------------------- */}
          <div className="space-y-2 rounded-md border border-border p-3">
            <SignaturePad
              label={`Nurse signature (${staffName})`}
              required
              value={payload.nurseSignatureDataUrl}
              onChange={(v) => patch({ nurseSignatureDataUrl: v })}
            />
            <Textarea
              aria-label="Nurse note"
              rows={2}
              placeholder="Optional nurse note (guardian contact, prescriber notification, etc.)"
              value={payload.nurseNote ?? ""}
              onChange={(e) => patch({ nurseNote: e.target.value })}
            />
            <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Password re-verification pending real staff authentication.
            </p>
          </div>

          {problems.length > 0 && (
            <ul
              aria-label="Refusal form blockers"
              className="list-inside list-disc rounded-md border border-border p-3 text-xs text-muted-foreground"
            >
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Sign later
          </Button>
          <Button disabled={problems.length > 0} onClick={finalize}>
            Finalize refusal document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
