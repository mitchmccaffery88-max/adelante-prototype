// §CF pre-release intake build 1 — the EARLY, required capacity & legal
// authority step.
//
// It sits first on the episode panel, above every other category, because the
// rest of the checklist depends on its answer. Nothing here re-implements the
// four-tier advocate model or the AHCD workflow: identifying an advocate goes
// through the real `createAdvocateInvitation` mechanism, and validating a
// directive renders the existing `AhcdValidationChecklist` verbatim.
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr, type PreReleaseEpisode } from "@/lib/ehr";
import {
  CAPACITY_GATE_BADGE,
  CAPACITY_LABEL,
  INTAKE_CAPACITY_OPTIONS,
  capacityRequiresSurrogate,
  type IntakeCapacityStatus,
} from "@/lib/capacity";
import { useActingStaff } from "@/lib/roles";
import { AhcdValidationChecklist } from "@/components/advocate/AhcdValidationChecklist";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { ClientDate } from "@/components/ClientDate";
import { AlertTriangle, CheckCircle2, ShieldQuestion, UserPlus } from "lucide-react";

export function CapacityAuthorityStep({ episode }: { episode: PreReleaseEpisode }) {
  const { role, staffName } = useActingStaff();
  const state = useEhr(() => AdelanteEHR.preReleaseCapacityState(episode.id));
  const [status, setStatus] = useState<IntakeCapacityStatus>(
    state.determination?.status ?? "competent",
  );
  const [basis, setBasis] = useState("");

  const determination = state.determination;
  const surrogateNeeded = determination ? capacityRequiresSurrogate(determination.status) : false;

  function save() {
    try {
      AdelanteEHR.recordPreReleaseCapacity({
        episodeId: episode.id,
        status,
        basis,
        determinedBy: staffName,
        actorRole: role,
      });
      setBasis("");
      toast.success("Capacity determination recorded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record the determination.");
    }
  }

  return (
    <Card className="border-l-4 border-l-navy p-4" data-testid="capacity-step">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 font-medium">
            <ShieldQuestion className="h-4 w-4" /> Step 1 — Capacity &amp; legal authority
            <Badge variant="outline">Required</Badge>
          </div>
          <p className="mt-1 max-w-prose text-xs text-muted-foreground">
            Can this individual participate in and consent to their own intake right now? Every
            consent-dependent step below depends on this answer, so it is asked first.
          </p>
        </div>
        <Badge
          data-testid="capacity-gate-badge"
          variant={state.decision.canProceed ? "default" : "destructive"}
        >
          {CAPACITY_GATE_BADGE[state.decision.state]}
        </Badge>
      </div>

      <div className="mt-3 space-y-3 rounded-md border p-3">
        {determination && (
          <p className="text-xs text-muted-foreground" data-testid="capacity-recorded">
            Recorded as <strong>{CAPACITY_LABEL[determination.status]}</strong> by{" "}
            {determination.determinedBy} · <ClientDate value={determination.determinedAt} /> —{" "}
            {determination.basis}
          </p>
        )}
        <div className="space-y-1">
          <Label>Capacity determination</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as IntakeCapacityStatus)}>
            <SelectTrigger data-testid="capacity-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTAKE_CAPACITY_OPTIONS.map((o) => (
                <SelectItem key={o.key} value={o.key}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {INTAKE_CAPACITY_OPTIONS.find((o) => o.key === status)?.detail}
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="capacity-basis">What you observed</Label>
          <Textarea
            id="capacity-basis"
            data-testid="capacity-basis"
            rows={2}
            value={basis}
            onChange={(e) => setBasis(e.target.value)}
            placeholder="How you reached this determination, and where it is documented"
          />
        </div>
        <Button size="sm" data-testid="capacity-save" disabled={!basis.trim()} onClick={save}>
          {determination ? "Re-record determination" : "Record determination"}
        </Button>
      </div>

      {determination && !surrogateNeeded && (
        <p className="mt-3 flex items-start gap-2 rounded-md bg-success/10 p-3 text-xs text-success">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Standard HIPAA / Authorized Representative path. The individual signs their own consents
          as the intake proceeds; an advocate may still be invited, but is not required.
        </p>
      )}

      {surrogateNeeded && (
        <div className="mt-3 space-y-3">
          {!state.decision.canProceed && (
            <p
              data-testid="capacity-block-reason"
              className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {state.decision.reason}
            </p>
          )}
          <IdentifyAdvocateForm episode={episode} />
          {state.authorityLinks.map((l) => (
            <div key={l.id} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <strong>{l.advocateName}</strong>
                <span className="text-xs text-muted-foreground">
                  {l.relationship ?? "advocate"} · invitation {l.status}
                </span>
                {AdelanteEHR.advocateAccess(l.id).allowed && (
                  <Badge className="border-0 bg-success/15 text-success">Authority in force</Badge>
                )}
              </div>
              {l.authorizationType === "ahcd" && (
                <AhcdValidationChecklist
                  linkId={l.id}
                  reviewerName={staffName}
                  reviewerRole={role}
                />
              )}
              {l.authorizationType === "conservatorship" && !l.conservatorshipDocs && (
                <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  Certified conservatorship court documents are not on file. Authority stays closed
                  until they are verified onto this connection.
                </p>
              )}
              {!l.authorizationType && (
                <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  Invitation sent to {l.invitationSentTo}. The advocate confirms which instrument
                  they hold when they claim it — an invitation alone grants nothing.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function IdentifyAdvocateForm({ episode }: { episode: PreReleaseEpisode }) {
  const { role, staffName } = useActingStaff();
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [contact, setContact] = useState("");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [expected, setExpected] = useState<"ahcd" | "conservatorship">("ahcd");

  function submit() {
    try {
      const link = AdelanteEHR.identifyPreReleaseAdvocate({
        episodeId: episode.id,
        advocateName: name,
        ...(relationship.trim() ? { relationship: relationship.trim() } : {}),
        invitationSentTo: contact,
        invitationChannel: channel,
        expectedAuthorization: expected,
        identifiedBy: staffName,
        actorRole: role,
      });
      setName("");
      setRelationship("");
      setContact("");
      toast.success(`Invitation sent to ${link.invitationSentTo} — code ${link.invitationCode}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send the invitation.");
    }
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <UserPlus className="h-4 w-4" /> Locate an AHCD or conservatorship
      </div>
      <p className="text-xs text-muted-foreground">
        Identify the person named on the directive or court order. Sending the invitation here is
        the real designation — it goes directly to them, never through the member.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          data-testid="advocate-name"
          placeholder="Advocate name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Relationship (optional)"
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
        />
        <Input
          data-testid="advocate-contact"
          placeholder={channel === "email" ? "Their email" : "Their mobile number"}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />
        <Select value={channel} onValueChange={(v) => setChannel(v as "email" | "sms")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">Text message</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={expected}
          onValueChange={(v) => setExpected(v as "ahcd" | "conservatorship")}
        >
          <SelectTrigger data-testid="advocate-instrument">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ahcd">Advance Health Care Directive (AHCD)</SelectItem>
            <SelectItem value="conservatorship">Conservatorship</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button
        size="sm"
        data-testid="advocate-invite"
        disabled={!name.trim() || !contact.trim()}
        onClick={submit}
      >
        Send invitation
      </Button>
    </div>
  );
}
