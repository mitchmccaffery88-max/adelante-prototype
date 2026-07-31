// §Cosign inbox — cross-patient queue of signed notes awaiting a cosignature.
//
// Same shape as Released Patient Search / Shift Count: a population-level view
// built on records that already exist in the chart. Gated on `therapy_notes`,
// exactly like the Notes tab it feeds from.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, isNoteSudSensitive, useEhr, type ProgressNote } from "@/lib/ehr";
import { canSignNotes, isMyCosign } from "@/lib/notes";
import { canAccess, useActingStaff } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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

const COSIGN_ATTESTATION =
  "I attest that I have reviewed this note in full and that my cosignature reflects my independent clinical judgment.";

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
    </div>
  );
}

type Row = { patient: { id: string; firstName: string; lastName: string }; note: ProgressNote };

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
  const { role, staffName } = useActingStaff();
  const [comment, setComment] = useState("");
  const [attested, setAttested] = useState(false);
  const [reason, setReason] = useState("");

  const cosign = () => {
    try {
      AdelanteEHR.cosignProgressNote(patientId, note.id, {
        cosignedBy: staffName,
        role,
        attested,
        comment,
      });
      toast.success("Note cosigned");
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
          <label className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <Checkbox
              checked={attested}
              onCheckedChange={(v) => setAttested(Boolean(v))}
              aria-label="Cosign attestation"
            />
            <span>{COSIGN_ATTESTATION}</span>
          </label>
          <Button
            size="sm"
            className="w-full bg-navy text-navy-foreground hover:bg-navy/90"
            disabled={!attested}
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