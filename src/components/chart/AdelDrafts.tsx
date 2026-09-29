// §Chart redesign turn 5 — "Draft with Adel" surfaces. Adel drafts; a person
// reviews, edits, and signs / sends / decides. Every draft shows
// ADEL_REVIEW_LABEL and which engine produced it (rule-based template).
import { useEffect, useState } from "react";
const loggedRefills = new Set<string>();
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { AdelanteEHR, useEhr, type RefillRequest } from "@/lib/ehr";
import { useActingStaff, type StaffRole } from "@/lib/roles";
import {
  ADEL_REVIEW_LABEL,
  ADEL_SOURCE_RULES,
  ADEL_THRESHOLDS_DRAFT,
  OUTREACH_REASON_LABEL,
  acceptNoteDraft,
  adelDraftAudit,
  attachReferralPacket,
  buildNoteDraft,
  buildOutreachDraft,
  buildReferralPacket,
  buildRefillSummary,
  canSendOutreach,
  discardAdelDraft,
  outreachReasons,
  referralPacket,
  sendOutreach,
  type NoteDraft,
  type OutreachReason,
} from "@/lib/adelDrafts";
import { RefillCuresStep } from "@/components/clinical/RefillCuresStep";
import { filterSudMedsForRole } from "@/lib/asamReporting";
import type { HlocReferral } from "@/lib/outpatientCare";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export function AdelDraftLabel() {
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-[11px]" data-testid="adel-draft-label">
      <span className="inline-flex items-center gap-1 rounded bg-gold/20 px-1.5 py-0.5 font-medium text-navy">
        <Sparkles className="h-3 w-3" /> {ADEL_REVIEW_LABEL}
      </span>
      <span className="text-muted-foreground">{ADEL_SOURCE_RULES}</span>
    </p>
  );
}

function useActor() {
  const { role, staffName, clinicianId, staffId } = useActingStaff();
  return { role, staffId, actor: { name: staffName, role, ...(clinicianId ? { clinicianId } : {}) } };
}

// ---------------------------------------------------------------- note
export function NoteDraftPanel({ patientId }: { patientId: string }) {
  const { role, actor } = useActor();
  const [orig, setOrig] = useState<NoteDraft | null>(null);
  const [draft, setDraft] = useState<NoteDraft | null>(null);
  const start = () => {
    const p = AdelanteEHR.getPatient(patientId);
    if (!p) return;
    const d = buildNoteDraft(p, role as StaffRole);
    setOrig(d);
    setDraft(d);
    adelDraftAudit("progress_note", "drafted", patientId, actor);
  };
  if (!draft || !orig)
    return (
      <Button variant="outline" size="sm" onClick={start} data-testid="adel-note-draft">
        <Sparkles className="h-4 w-4" /> Draft with Adel
      </Button>
    );
  const field = (k: keyof NoteDraft, label: string) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Textarea rows={4} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} aria-label={label} />
    </div>
  );
  return (
    <div className="space-y-2 rounded-lg border border-gold/50 p-3" data-testid="adel-note-panel">
      <AdelDraftLabel />
      {field("subjective", "Subjective")}
      {field("objective", "Objective — changes since last note")}
      {field("assessment", "Assessment — current risk")}
      {field("plan", "Plan")}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          data-testid="adel-note-accept"
          onClick={() => {
            const n = acceptNoteDraft({ patientId, draft, original: orig, actor });
            setDraft(null);
            toast.success(n ? "Draft note created — review and sign it below" : "Couldn't create the note");
          }}
        >
          Accept as unsigned note
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            discardAdelDraft("progress_note", patientId, actor);
            setDraft(null);
          }}
        >
          Discard
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">Accepting creates an unsigned draft. Nothing is signed until you sign it.</p>
    </div>
  );
}

// ---------------------------------------------------------------- refill
export function RefillDecisionPanel({ patientId }: { patientId: string }) {
  const { role } = useActingStaff();
  const refills = useEhr(() => AdelanteEHR.listRefillRequests({ patientId, status: "pending" }));
  const visible = filterSudMedsForRole(refills, role, AdelanteEHR.getPatient(patientId)).visible;
  if (!visible.length) return <p className="text-sm text-muted-foreground">No refill requests waiting.</p>;
  return (
    <div className="space-y-3">
      {visible.map((r) => (
        <RefillCard key={r.id} refill={r} />
      ))}
    </div>
  );
}
const SUGGESTION_LABEL = { approve: "Approve 30 days", approve_with_visit: "Needs visit first", deny: "Deny with reason" } as const;
function RefillCard({ refill }: { refill: RefillRequest }) {
  const { role, actor } = useActor();
  const s = useEhr(() => JSON.stringify(buildRefillSummary(refill, role as StaffRole)));
  const sum = JSON.parse(s) as ReturnType<typeof buildRefillSummary>;
  const [reason, setReason] = useState("");
  useEffect(() => {
    const k = `${actor.name}:${refill.id}`;
    if (loggedRefills.has(k)) return;
    loggedRefills.add(k);
    adelDraftAudit("refill", "drafted", refill.patientId, actor, { refillId: refill.id, suggestion: sum.suggestion });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refill.id]);
  const decide = (decision: "approved" | "needs_appointment" | "denied") => {
    try {
      AdelanteEHR.reviewRefill({ id: refill.id, decision, ...(decision === "denied" ? { denyReason: reason } : {}), clinicianId: actor.clinicianId ?? actor.name, actorRole: role });
      const chosen = decision === "approved" ? "approve" : decision === "needs_appointment" ? "approve_with_visit" : "deny";
      adelDraftAudit("refill", chosen === sum.suggestion ? "accepted" : "edited", refill.patientId, actor, { refillId: refill.id, suggestion: sum.suggestion, decision });
      toast.success(`Refill ${decision === "needs_appointment" ? "approved — visit needed" : decision}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="space-y-2 rounded-lg border p-3 text-sm" data-testid="adel-refill-card">
      <p className="font-medium text-navy">{refill.medicationName}</p>
      <AdelDraftLabel />
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {sum.lines.map((l) => (
          <div key={l.label} className="contents">
            <dt className="text-muted-foreground">{l.label}</dt>
            <dd className="text-navy">{l.value}</dd>
          </div>
        ))}
      </dl>
      <p className="rounded bg-muted px-2 py-1 text-xs" data-testid="adel-refill-suggestion">
        <span className="font-medium">Suggested: {SUGGESTION_LABEL[sum.suggestion]}.</span> {sum.why}
      </p>
      <p className="text-[10px] text-muted-foreground">{ADEL_THRESHOLDS_DRAFT}. You decide.</p>
      {sum.controlled && <RefillCuresStep refill={refill} />}
      <div className="flex flex-wrap items-end gap-2">
        <Button size="sm" onClick={() => decide("approved")}>Approve</Button>
        <Button size="sm" variant="outline" onClick={() => decide("needs_appointment")}>Approve with visit</Button>
        <Input className="h-8 w-48" placeholder="Reason (required to deny)" aria-label="Deny reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button size="sm" variant="destructive" onClick={() => decide("denied")}>Deny</Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- outreach
export function OutreachDraftPanel({ patientId, reason: fixed }: { patientId: string; reason?: OutreachReason }) {
  const { role, actor } = useActor();
  const p = useEhr(() => AdelanteEHR.getPatient(patientId));
  const reasons = p ? outreachReasons(p, role as StaffRole) : [];
  const [reason, setReason] = useState<OutreachReason>(fixed ?? reasons[0] ?? "contact_due");
  const [lang, setLang] = useState<"en" | "es">(p?.preferredLanguage === "es" ? "es" : "en");
  const [orig, setOrig] = useState<string | null>(null);
  const [text, setText] = useState("");
  if (!p) return null;
  const canSend = canSendOutreach(role as StaffRole, p);
  const make = (r: OutreachReason, l: "en" | "es", first: boolean) => {
    const t = buildOutreachDraft(p, r, l, actor.name);
    setOrig(t);
    setText(t);
    if (first) adelDraftAudit("outreach", "drafted", patientId, actor, { reason: r, lang: l });
  };
  if (orig === null)
    return (
      <div className="flex flex-wrap items-center gap-2">
        {!fixed && (
          <select className="h-8 rounded-md border px-2 text-xs" aria-label="Outreach reason" value={reason} onChange={(e) => setReason(e.target.value as OutreachReason)}>
            {reasons.map((r) => (
              <option key={r} value={r}>{OUTREACH_REASON_LABEL[r]}</option>
            ))}
          </select>
        )}
        <Button size="sm" variant="outline" onClick={() => make(reason, lang, true)} data-testid="adel-outreach-draft">
          <Sparkles className="h-4 w-4" /> Draft outreach with Adel
        </Button>
      </div>
    );
  return (
    <div className="space-y-2 rounded-lg border border-gold/50 p-3" data-testid="adel-outreach-panel">
      <AdelDraftLabel />
      <p className="text-xs text-muted-foreground">
        {OUTREACH_REASON_LABEL[reason]} · plain language, no clinical or substance use details.
        {lang === "es" && " Spanish: Draft — pending bilingual review."}
      </p>
      <div className="flex gap-1" role="group" aria-label="Language">
        {(["en", "es"] as const).map((l) => (
          <Button key={l} size="sm" variant={lang === l ? "default" : "outline"} onClick={() => { setLang(l); make(reason, l, false); }}>
            {l === "en" ? "English" : "Español"}
          </Button>
        ))}
      </div>
      <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} aria-label="Outreach message" data-testid="adel-outreach-text" />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={!canSend}
          data-testid="adel-outreach-send"
          onClick={() => {
            try {
              sendOutreach({ patientId, text, original: orig, reason, lang, actor });
              setOrig(null);
              toast.success("Message sent to the patient");
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          Send message
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { discardAdelDraft("outreach", patientId, actor, { reason }); setOrig(null); }}>
          Discard
        </Button>
      </div>
      {!canSend && <p className="text-[11px] text-muted-foreground">Your role can't message patients.</p>}
    </div>
  );
}
export function OutreachDraftDialog({ patientId, reason, label = "Draft outreach" }: { patientId: string; reason: OutreachReason; label?: string }) {
  const [open, setOpen] = useState(false);
  const p = AdelanteEHR.getPatient(patientId);
  return (
    <>
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpen(true)} data-testid="mywork-adel-outreach">
        <Sparkles className="h-3 w-3" /> {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle>Message {p?.firstName}</DialogTitle>
          <DialogDescription className="text-xs">{OUTREACH_REASON_LABEL[reason]}</DialogDescription>
          <OutreachDraftPanel patientId={patientId} reason={reason} />
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------- referral packet
export function ReferralPacketDraft({ referral }: { referral: HlocReferral }) {
  const { role, actor } = useActor();
  const attached = useEhr(() => referralPacket(referral.id));
  const [orig, setOrig] = useState<string | null>(null);
  const [text, setText] = useState("");
  if (orig === null)
    return (
      <div className="space-y-1">
        {attached?.status === "attached" && (
          <details className="text-xs" data-testid="adel-packet-attached">
            <summary className="cursor-pointer text-navy">Referral packet attached by {attached.by} (draft attachment)</summary>
            <pre className="mt-1 whitespace-pre-wrap rounded bg-muted p-2 text-[11px]">{attached.text}</pre>
          </details>
        )}
        <Button
          size="sm"
          variant="outline"
          data-testid="adel-packet-draft"
          onClick={() => {
            const t = buildReferralPacket(referral, role as StaffRole);
            setOrig(t);
            setText(t);
            adelDraftAudit("referral_packet", "drafted", referral.patientId, actor, { referralId: referral.id });
          }}
        >
          <Sparkles className="h-4 w-4" /> {attached ? "Redraft packet with Adel" : "Draft referral packet with Adel"}
        </Button>
      </div>
    );
  return (
    <div className="space-y-2 rounded-lg border border-gold/50 p-3" data-testid="adel-packet-panel">
      <AdelDraftLabel />
      <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} aria-label="Referral packet" className="text-xs" />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => { attachReferralPacket(referral, text, orig, actor); setOrig(null); toast.success("Packet attached to the referral as a draft"); }}>
          Attach to referral
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { discardAdelDraft("referral_packet", referral.patientId, actor, { referralId: referral.id }); setOrig(null); }}>
          Discard
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">Sending the referral still needs the Part 2 consent check.</p>
    </div>
  );
}
