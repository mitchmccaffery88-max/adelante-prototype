// §Phase 10c — the chart's ASAM section. Part 2 protected: the section itself
// is registered under the `screeners_sud` record class in recordSections.tsx,
// so advocates and Part 2-restricted staff never see it. All draft values
// (dimension guidance slots, level list, due dates, sign rules) are labelled
// "Draft — pending clinical sign-off". The system NEVER suggests a level of
// care — both level fields are clinician-selected.
import { useState } from "react";
import { AdelanteEHR, useEhr, type Patient } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import {
  ASAM_DIMENSIONS,
  ASAM_DRAFT_NOTE,
  ASAM_LICENSED_CONTENT_NOTE,
  ASAM_AUTHOR_ROLES,
  DMC_ODS_LEVELS,
  dmcOdsLevelLabel,
  type AsamAssessment,
} from "@/lib/asam";
import { signAsamAssessment } from "@/lib/asamFlow";
import { asamLevelHistory } from "@/lib/asamReporting";
import { calomsCompletenessFor, gateApplies, gateMessageFor, DMC_ODS_DRAFT_NOTE } from "@/lib/dmcOdsReadiness";
import { AdelanteEHRExt, claimBillingBucket, useEhrExt } from "@/lib/ehr-ext";
import { attestationStatement, type AttestationDraft } from "@/lib/attestation";
import { AttestationSignatureBlock } from "@/components/signature/AttestationSignatureBlock";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const inputCls =
  "w-full rounded border border-input bg-background px-2 py-1 text-xs text-foreground";

function StatusBadge({ a }: { a: AsamAssessment }) {
  const label =
    a.status === "signed"
      ? "Signed"
      : a.status === "cosign_pending"
        ? "Awaiting LPHA co-signature"
        : a.status === "declined"
          ? "Co-signature declined — back to draft"
          : "Draft";
  return (
    <Badge variant={a.status === "signed" ? "default" : "outline"} data-testid={`asam-status-${a.status}`}>
      {label}
    </Badge>
  );
}

export function AsamPanel({ patient }: { patient: Patient }) {
  const acting = useActingStaff();
  const canAuthor = ASAM_AUTHOR_ROLES.includes(acting.role);
  const [err, setErr] = useState<string | null>(null);
  const [sigDraft, setSigDraft] = useState<AttestationDraft>({ attested: false });

  const { assessments, openTask } = useEhr(() => ({
    assessments: AdelanteEHR.listAsamAssessments(patient.id),
    openTask: AdelanteEHR.openAsamTask(patient.id),
  }));
  const history = useEhr(() => asamLevelHistory(acting.role, patient));
  const readiness = useEhrExt(() =>
    AdelanteEHRExt.listClaims()
      .filter((c) => c.patientId === patient.id && gateApplies(c))
      .map((c) => ({ c, msg: gateMessageFor(acting.role, c) })),
  );
  const caloms = useEhr(() => calomsCompletenessFor(patient));
  const draft = assessments.find((a) => a.status === "draft" || a.status === "declined");
  const mine = draft && draft.authoredBy.staffId === acting.staffId;

  const actor = {
    staffId: acting.staffId,
    name: acting.staffName,
    role: acting.role,
    clinicianId: acting.clinicianId,
  };

  const startDraft = (clinicianDecision: boolean) => {
    setErr(null);
    try {
      if (clinicianDecision) {
        AdelanteEHR.requestAsamAssessment(patient.id, "Clinician decision from the chart", {
          clinicianDecision: true,
        });
      }
      AdelanteEHR.saveAsamDraft(patient.id, {}, actor);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const update = (patch: Parameters<typeof AdelanteEHR.saveAsamDraft>[1]) => {
    setErr(null);
    try {
      AdelanteEHR.saveAsamDraft(patient.id, patch, actor);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const sign = () => {
    if (!draft) return;
    setErr(null);
    try {
      signAsamAssessment(patient.id, draft.id, actor, sigDraft);
      setSigDraft({ attested: false });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-3" data-testid="asam-panel">
      <div className="rounded-md border border-dashed border-amber-500/60 bg-amber-500/10 p-2 text-[11px] text-amber-900 dark:text-amber-200">
        ASAM framework — {ASAM_DRAFT_NOTE}. {ASAM_LICENSED_CONTENT_NOTE} The system never
        calculates or suggests a level of care; the clinician decides.
      </div>

      {(readiness.length > 0 || caloms.inScope) && (
        <div className="space-y-1 rounded-md border border-border p-2 text-xs" data-testid="dmc-ods-readiness-chart">
          <p className="font-medium">DMC-ODS readiness <span className="font-normal text-muted-foreground">({DMC_ODS_DRAFT_NOTE})</span></p>
          {readiness.map(({ c, msg }) => (
            <p key={c.id} data-testid={msg ? "chart-claim-blocked" : "chart-claim-ok"}>
              {c.serviceCode} on {c.serviceDate} ({claimBillingBucket(c.state)}):{" "}
              {msg ? <span className="text-destructive">{msg}</span> : <span className="text-teal">Medical necessity documented</span>}
            </p>
          ))}
          {caloms.inScope && (
            <p className="text-muted-foreground">
              CalOMS admission: {caloms.admissionMissing.length ? `missing ${caloms.admissionMissing.join(", ")}` : "complete"}
              {caloms.dischargeMissing && ` · Discharge: ${caloms.dischargeMissing.length ? `missing ${caloms.dischargeMissing.join(", ")}` : "complete"}`}
            </p>
          )}
        </div>
      )}

      {history && history.length > 0 && (
        <div className="rounded-md border border-border p-2 text-xs" data-testid="asam-level-history">
          <p className="mb-1 font-medium">Level of care over time (clinician-selected)</p>
          <ol className="space-y-1 border-l border-border pl-3">
            {history.map((h) => (
              <li key={h.asamId}>
                <span className="font-medium">v{h.version}</span> · {h.signedAt.slice(0, 10)} · {h.level}
                {h.amendsId ? " (amendment)" : ""} — signed by {h.signer}
                {h.recommended && (
                  <span className="block text-muted-foreground">
                    Recommended {h.recommended}; reason for difference: {h.reason}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {openTask && (
        <div className="rounded-md border border-border bg-muted/40 p-2 text-xs" data-testid="asam-open-task">
          <span className="font-medium">ASAM assessment needed</span> — due {openTask.dueDate} (draft).
          <span className="block text-muted-foreground">{openTask.detail}</span>
        </div>
      )}

      {err && (
        <p className="text-xs text-destructive" role="alert">
          {err}
        </p>
      )}

      {canAuthor && !draft && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => startDraft(false)} data-testid="asam-start">
            Start ASAM assessment
          </Button>
          {!openTask && (
            <Button size="sm" variant="outline" onClick={() => startDraft(true)} data-testid="asam-start-decision">
              Start ASAM (clinician decision)
            </Button>
          )}
        </div>
      )}

      {draft && (
        <div className="space-y-3 rounded-md border border-border p-3" data-testid="asam-draft">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium">
              Draft by {draft.authoredBy.name} ({draft.authoredBy.role}) · v{draft.version}
            </p>
            <StatusBadge a={draft} />
          </div>
          {draft.triggerReasons.map((r, i) => (
            <p key={i} className="text-[11px] text-muted-foreground">
              Trigger: {r}
            </p>
          ))}
          {mine ? (
            <>
              {ASAM_DIMENSIONS.map((d, i) => (
                <div key={d.key} className="space-y-1" data-testid={`asam-dimension-${d.key}`}>
                  <p className="text-xs font-medium">
                    Dimension {i + 1}: {d.name}
                  </p>
                  <textarea
                    className={inputCls}
                    rows={2}
                    placeholder="Clinical documentation for this dimension"
                    value={draft.dimensions[i]?.documentation ?? ""}
                    onChange={(e) => {
                      const dims = draft.dimensions.map((x, j) =>
                        j === i ? { ...x, documentation: e.target.value } : x,
                      );
                      update({ dimensions: dims });
                    }}
                  />
                  <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    Risk rating (0–4, clinician-assigned)
                    <select
                      className="rounded border border-input bg-background px-1 py-0.5"
                      value={draft.dimensions[i]?.rating ?? 0}
                      onChange={(e) => {
                        const dims = draft.dimensions.map((x, j) =>
                          j === i ? { ...x, rating: Number(e.target.value) as 0 | 1 | 2 | 3 | 4 } : x,
                        );
                        update({ dimensions: dims });
                      }}
                    >
                      {[0, 1, 2, 3, 4].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ))}
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-1 text-[11px] text-muted-foreground">
                  Recommended level (clinician-selected; draft list)
                  <select
                    className={inputCls}
                    value={draft.recommendedLevel ?? ""}
                    onChange={(e) => update({ recommendedLevel: e.target.value || undefined })}
                    data-testid="asam-recommended-level"
                  >
                    <option value="">—</option>
                    {DMC_ODS_LEVELS.map((l) => (
                      <option key={l.key} value={l.key}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-[11px] text-muted-foreground">
                  Actual level (clinician-selected; draft list)
                  <select
                    className={inputCls}
                    value={draft.actualLevel ?? ""}
                    onChange={(e) => update({ actualLevel: e.target.value || undefined })}
                    data-testid="asam-actual-level"
                  >
                    <option value="">—</option>
                    {DMC_ODS_LEVELS.map((l) => (
                      <option key={l.key} value={l.key}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {draft.recommendedLevel && draft.actualLevel && draft.recommendedLevel !== draft.actualLevel && (
                <label className="block space-y-1 text-[11px] text-muted-foreground">
                  Reason the actual level differs (required)
                  <textarea
                    className={inputCls}
                    rows={2}
                    value={draft.levelDifferenceReason ?? ""}
                    onChange={(e) => update({ levelDifferenceReason: e.target.value })}
                  />
                </label>
              )}
              <label className="block space-y-1 text-[11px] text-muted-foreground">
                Linked diagnoses (ICD-10, comma-separated)
                <input
                  className={inputCls}
                  value={draft.diagnosisCodes.join(", ")}
                  onChange={(e) =>
                    update({
                      diagnosisCodes: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
              <div className="rounded-md border border-border p-2">
                <AttestationSignatureBlock
                  statement={attestationStatement("asam_sign")}
                  draft={sigDraft}
                  onChange={setSigDraft}
                />
                <Button
                  size="sm"
                  className="mt-2"
                  disabled={!sigDraft.attested || !sigDraft.signatureDataUrl}
                  onClick={sign}
                  data-testid="asam-sign"
                >
                  Sign assessment
                </Button>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Draft in progress by {draft.authoredBy.name}. Only the author can edit it.
            </p>
          )}
        </div>
      )}

      {assessments.filter((a) => a.status === "cosign_pending" || a.status === "signed").length > 0 && (
        <div className="space-y-2" data-testid="asam-history">
          {assessments
            .filter((a) => a.status === "cosign_pending" || a.status === "signed")
            .map((a) => (
              <div key={a.id} className="rounded-md border border-border p-2 text-xs" data-testid={`asam-record-${a.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    ASAM v{a.version} — {a.authoredBy.name}
                  </span>
                  <StatusBadge a={a} />
                </div>
                <p className="text-muted-foreground">
                  Recommended: {dmcOdsLevelLabel(a.recommendedLevel)} · Actual:{" "}
                  {dmcOdsLevelLabel(a.actualLevel)}
                  {a.levelDifferenceReason ? ` — ${a.levelDifferenceReason}` : ""}
                </p>
                {a.status === "signed" && a.outputs && (
                  <p className="text-muted-foreground" data-testid="asam-outputs">
                    Medical necessity: {a.outputs.medicalNecessity ? "recorded (draft rule)" : "not established (draft rule)"}
                    {a.outputs.episodeId ? " · DMC-ODS episode opened/updated" : ""}
                    {a.outputs.claimId ? " · H0001 claim created" : ""}
                    {a.outputs.calomsPromptTaskId ? " · CalOMS admission prompted" : ""}
                    {a.outputs.referralOutTaskId ? " · referral-out task opened" : ""}
                    {a.outputs.reassessmentTaskId ? " · reassessment scheduled (draft 90 days)" : ""}
                  </p>
                )}
                {a.cosignedBy && (
                  <p className="text-muted-foreground">Co-signed by {a.cosignedBy} (LPHA).</p>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
