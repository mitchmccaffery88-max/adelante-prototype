// §Cosign inbox — cross-patient queue of signed notes awaiting a cosignature.
//
// Same shape as Released Patient Search / Shift Count: a population-level view
// built on records that already exist in the chart. Gated on `therapy_notes`,
// exactly like the Notes tab it feeds from.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AttestationSignatureBlock } from "@/components/signature/AttestationSignatureBlock";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import {
  attestationBlockers,
  attestationStatement,
  buildAttestationRecord,
  emptyAttestationDraft,
  mergeBlockers,
  type AttestationDraft,
} from "@/lib/attestation";
import { AdelanteEHR, isNoteSudSensitive, useEhr, type Patient, type ProgressNote } from "@/lib/ehr";
import { canSignNotes, isMyCosign } from "@/lib/notes";
import { canAccess, useActingStaff } from "@/lib/roles";
import { ASAM_DRAFT_NOTE, ASAM_SIGN_ROLES, dmcOdsLevelLabel } from "@/lib/asam";
import { cosignAsamAssessment } from "@/lib/asamFlow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClientDate } from "@/components/ClientDate";
import { EmptyState } from "@/components/EmptyState";
import { ArrowLeft, Inbox, Lock } from "lucide-react";

export const Route = createFileRoute("/cosign-inbox")({
  head: () => ({
    meta: [
      { title: "Cosign inbox — Adelante" },
      {
        name: "description",
        content:
          "Cross-patient queue of signed progress notes awaiting clinical cosignature, with attested cosign and reasoned decline.",
      },
      { property: "og:title", content: "Cosign inbox — Adelante" },
      {
        property: "og:description",
        content: "Review, cosign, or decline pending clinical notes across the caseload.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CosignInboxPage,
});


function CosignInboxPage() {
  const { role, staffName } = useActingStaff();
  const access = canAccess(role, "therapy_notes");
  const pending = useEhr(() => AdelanteEHR.listNotesAwaitingCosign());
  const [openId, setOpenId] = useState<string | null>(null);

  const { mine, others } = useMemo(() => {
    const mine: typeof pending = [];
    const others: typeof pending = [];
    for (const row of pending) {
      (isMyCosign(row.note, { role, staffName }) ? mine : others).push(row);
    }
    return { mine, others };
  }, [pending, role, staffName]);

  if (access.level === "none") {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <EmptyState
          icon={Lock}
          title="Cosign inbox is restricted"
          description={access.reason ?? "Your role can't view clinical notes."}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <Link to="/clinician" className="inline-flex items-center gap-1 text-xs text-teal">
        <ArrowLeft className="h-3 w-3" /> Back to clinician
      </Link>
      <header>
        <h1 className="font-display text-2xl text-navy flex items-center gap-2">
          <Inbox className="h-5 w-5 text-teal" /> Cosign inbox
        </h1>
        <p className="text-sm text-muted-foreground">
          Signed notes still awaiting a cosignature. Cosigning requires attestation; declining
          requires a reason and returns the note to draft for the author.
        </p>
      </header>

      <Section
        title="Awaiting my cosign"
        empty="Nothing is waiting on you right now."
        rows={mine}
        openId={openId}
        setOpenId={setOpenId}
        actionable={canSignNotes(role)}
      />
      <Section
        title="All open cosign requests"
        empty="No other open cosign requests."
        rows={others}
        openId={openId}
        setOpenId={setOpenId}
        actionable={false}
      />
      <AsamCosignSection />
    </div>
  );
}

// §Phase 10c — counselor/trainee-authored ASAM assessments awaiting an LPHA
// co-signature. Nothing about these assessments is visible to roles outside
// the LPHA sign list, and no output has fired yet — outputs fire on cosign.
function AsamCosignSection() {
  const { role, staffName, staffId, clinicianId } = useActingStaff();
  const rows = useEhr(() => AdelanteEHR.listAsamAwaitingCosign());
  const [draft, setDraft] = useState<AttestationDraft>(emptyAttestationDraft());
  const [reason, setReason] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  if (!ASAM_SIGN_ROLES.includes(role)) return null;

  const actor = { staffId, name: staffName, role, clinicianId };
  return (
    <section className="space-y-2" data-testid="asam-cosign-section">
      <h2 className="font-display text-sm text-navy">
        ASAM assessments awaiting LPHA co-signature{" "}
        <span className="text-muted-foreground">({rows.length})</span>
      </h2>
      <p className="text-[11px] text-muted-foreground">
        {ASAM_DRAFT_NOTE}. Episode, claim, CalOMS prompt and care-plan outputs fire only when you co-sign.
      </p>
      {rows.length === 0 && (
        <Card className="p-3 text-xs text-muted-foreground">No ASAM assessments are waiting.</Card>
      )}
      {rows.map(({ patient, asam }) => (
        <Card key={asam.id} className="p-3" data-testid={`asam-cosign-${asam.id}`}>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left"
            onClick={() => setOpenId(openId === asam.id ? null : asam.id)}
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-navy">
                {patient.firstName} {patient.lastName}
              </div>
              <div className="text-[11px] text-muted-foreground">
                ASAM by {asam.authoredBy.name} ({asam.authoredBy.role}) ·{" "}
                {asam.signedAt ? <ClientDate value={asam.signedAt} /> : "—"}
              </div>
            </div>
            <Badge className="bg-gold/30 text-navy border-0 text-[10px]">Awaiting LPHA cosign</Badge>
          </button>
          {openId === asam.id && (
            <div className="mt-2 space-y-2 border-t border-border pt-2">
              <p className="text-xs text-muted-foreground">
                Actual level (clinician-selected): {dmcOdsLevelLabel(asam.actualLevel)} · Diagnoses:{" "}
                {asam.diagnosisCodes.join(", ") || "—"}
              </p>
              <AttestationSignatureBlock
                statement={attestationStatement("asam_supervisor_sign")}
                draft={draft}
                onChange={setDraft}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={attestationBlockers(draft).length > 0}
                  onClick={() => {
                    try {
                      cosignAsamAssessment(patient.id, asam.id, actor, draft);
                      setDraft(emptyAttestationDraft());
                      toast.success("ASAM co-signed — outputs fired.");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : String(e));
                    }
                  }}
                  data-testid="asam-cosign-btn"
                >
                  Co-sign (LPHA)
                </Button>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Decline reason (required to decline)"
                  className="min-h-8 text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    try {
                      AdelanteEHR.declineAsamCosign(patient.id, asam.id, actor, reason);
                      setReason("");
                      toast.success("Returned to the author as a draft.");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : String(e));
                    }
                  }}
                >
                  Decline
                </Button>
              </div>
            </div>
          )}
        </Card>
      ))}
    </section>
  );
}

type Row = { patient: Patient; note: ProgressNote };

function Section({
  title,
  empty,
  rows,
  openId,
  setOpenId,
  actionable,
}: {
  title: string;
  empty: string;
  rows: Row[];
  openId: string | null;
  setOpenId: (id: string | null) => void;
  actionable: boolean;
}) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-sm text-navy">
        {title} <span className="text-muted-foreground">({rows.length})</span>
      </h2>
      {rows.length === 0 && <Card className="p-3 text-xs text-muted-foreground">{empty}</Card>}
      {rows.map(({ patient, note }) => (
        <Card key={note.id} className="p-3">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left"
            onClick={() => setOpenId(openId === note.id ? null : note.id)}
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-navy">
                {patient.firstName} {patient.lastName}
                <span className="ml-2 text-[11px] font-normal text-muted-foreground capitalize">
                  {note.sessionType.replace("_", " ")}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Signed by {note.signedBy} ·{" "}
                {note.signedAt ? <ClientDate value={note.signedAt} /> : "—"}
                {note.cosignRole?.length ? ` · needs ${note.cosignRole.join(" / ")}` : ""}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {isNoteSudSensitive(note) && (
                <Badge className="bg-destructive/15 text-destructive border-0 text-[10px]">
                  42 CFR 2
                </Badge>
              )}
              {note.authorSource === "ai_draft" && (
                <Badge className="bg-muted text-muted-foreground border-0 text-[10px]">
                  Machine draft
                </Badge>
              )}
              <Badge className="bg-gold/30 text-navy border-0 text-[10px]">Awaiting cosign</Badge>
            </div>
          </button>
          {openId === note.id && (
            <CosignDetail patientId={patient.id} note={note} actionable={actionable} />
          )}
        </Card>
      ))}
    </section>
  );
}

function CosignDetail({
  patientId,
  note,
  actionable,
}: {
  patientId: string;
  note: ProgressNote;
  actionable: boolean;
}) {
  const { role, staffName, staffId, clinicianId } = useActingStaff();
  const [comment, setComment] = useState("");
  const [draft, setDraft] = useState<AttestationDraft>(emptyAttestationDraft());
  const statement = attestationStatement("progress_note_supervisor_sign");
  const blockers = mergeBlockers(attestationBlockers(draft));
  const [reason, setReason] = useState("");

  const cosign = () => {
    try {
      const attestation = buildAttestationRecord({ statement, draft, signedBy: staffName });
      AdelanteEHR.cosignProgressNote(patientId, note.id, {
        cosignedBy: staffName,
        cosignedById: clinicianId ?? staffId,
        role,
        attestation,
        comment,
      });
      const claim = note.appointmentId
        ? AdelanteEHRExt.claimForEncounter(note.appointmentId)
        : undefined;
      toast.success("Note cosigned", {
        ...(claim ? { description: `Claim is now ${claim.state}.` } : {}),
      });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const decline = () => {
    try {
      AdelanteEHR.declineProgressNoteCosign(patientId, note.id, {
        declinedBy: staffName,
        role,
        reason,
      });
      toast.success("Cosign declined — note returned to draft", {
        description: "No orders were voided: Adelante has no note-to-order link yet.",
      });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3 text-xs">
      <dl className="space-y-1.5">
        {(["subjective", "objective", "assessment", "plan"] as const).map((k) =>
          note[k] ? (
            <div key={k}>
              <dt className="font-medium text-navy capitalize">{k}</dt>
              <dd className="text-foreground/80">{note[k]}</dd>
            </div>
          ) : null,
        )}
      </dl>
      <p className="text-[10px] text-muted-foreground">
        Read-only. Cosigning does not edit the note; a decline sends it back to the author.
      </p>
      {actionable ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[11px]" htmlFor={`c-${note.id}`}>
              Cosign comment (optional)
            </Label>
            <Textarea
              id={`c-${note.id}`}
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
          <AttestationSignatureBlock
            statement={statement}
            draft={draft}
            onChange={setDraft}
            signatureLabel="Supervisor signature"
          />
          {blockers.length > 0 && (
            <ul className="space-y-0.5 text-[11px] text-muted-foreground" data-testid="cosign-blockers">
              {blockers.map((b) => (
                <li key={b.code}>• {b.message}</li>
              ))}
            </ul>
          )}
          <Button
            size="sm"
            className="w-full bg-navy text-navy-foreground hover:bg-navy/90"
            disabled={blockers.length > 0}
            onClick={cosign}
          >
            Cosign note
          </Button>
          <div className="space-y-1.5 rounded-md border border-border p-2">
            <Label className="text-[11px]" htmlFor={`d-${note.id}`}>
              Decline reason (required)
            </Label>
            <Textarea
              id={`d-${note.id}`}
              rows={2}
              value={reason}
              placeholder="What needs to change before this can be cosigned?"
              onChange={(e) => setReason(e.target.value)}
            />
            <Button
              size="sm"
              variant="destructive"
              className="w-full"
              disabled={reason.trim().length < 3}
              onClick={decline}
            >
              Decline & return to draft
            </Button>
            <p className="text-[10px] text-muted-foreground">
              Known gap: the reference EMR also voids orders signed in the same encounter. Adelante
              has no note-to-order link, so no orders are voided here.
            </p>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Visible for coordination only — your role or the requested cosign role doesn’t match.
        </p>
      )}
    </div>
  );
}