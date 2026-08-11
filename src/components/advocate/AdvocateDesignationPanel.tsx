// §v3.0 Phase 4 — designation surface for advocates / family members.
//
// Used by the patient on /home, and by the CF Care Manager / ECM Provider on
// the patient's behalf during pre-release intake. There is NO search here and
// none is possible: designation flows one way only — a patient names someone,
// and the invitation goes to THAT person's own contact. An advocate can never
// initiate a connection.
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr, type AdvocateLink } from "@/lib/ehr";
import { ADVOCATE_AUTHORIZATION_TYPES } from "@/lib/advocate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ClientDate } from "@/components/ClientDate";
import { ShieldCheck, UserPlus, Send } from "lucide-react";
import { AhcdValidationChecklist } from "./AhcdValidationChecklist";

const AUTH_LABEL = new Map(ADVOCATE_AUTHORIZATION_TYPES.map((a) => [a.key, a.label]));

export function AdvocateDesignationPanel({
  patientId,
  designatedBy,
  className,
}: {
  patientId: string;
  designatedBy: AdvocateLink["designatedBy"];
  className?: string;
}) {
  const links = useEhr(() => AdelanteEHR.listAdvocateLinks(patientId));
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [contact, setContact] = useState("");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [lastCode, setLastCode] = useState<string | null>(null);

  function invite() {
    try {
      const link = AdelanteEHR.createAdvocateInvitation({
        patientId,
        advocateName: name,
        relationship,
        invitationSentTo: contact,
        invitationChannel: channel,
        designatedBy,
      });
      setName("");
      setRelationship("");
      setContact("");
      setLastCode(link.invitationCode);
      toast.success(`Invitation sent directly to ${link.invitationSentTo}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send that invitation.");
    }
  }

  function revoke(link: AdvocateLink) {
    const reason = window.prompt("Why is this access being removed?")?.trim();
    if (!reason) return;
    try {
      AdelanteEHR.revokeAdvocateLink(link.id, designatedBy.name, reason);
      toast.success("Access removed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove access.");
    }
  }

  return (
    <Card className={`p-5 space-y-4 ${className ?? ""}`}>
      <div>
        <h2 className="font-display text-lg text-navy flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-teal" /> Advocates &amp; family
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          One trusted person — a family member, conservator or authorized representative — can be
          invited to see upcoming appointments and groups. They see nothing else: no notes, no
          care plan, no messages. The invitation goes straight to them, and access can be removed
          at any time.
        </p>
      </div>

      {links.length > 0 && (
        <ul className="space-y-2">
          {links.map((l) => (
            <li key={l.id} className="rounded-lg border p-3 text-sm space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-navy">
                  {l.advocateName}
                  {l.relationship ? ` · ${l.relationship}` : ""}
                </span>
                <Badge variant={l.status === "active" ? "default" : "secondary"}>{l.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {l.authorizationType
                  ? AUTH_LABEL.get(l.authorizationType)
                  : "Authorization not confirmed yet — no access."}
              </p>
              <p className="text-xs text-muted-foreground">
                Invited <ClientDate value={l.designatedAt} /> · sent to {l.invitationSentTo}
              </p>
              {l.status !== "revoked" && (
                <Button size="sm" variant="ghost" onClick={() => revoke(l)}>
                  Remove access
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="adv-name">Their name</Label>
          <Input id="adv-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="adv-rel">Relationship (optional)</Label>
          <Input
            id="adv-rel"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="adv-contact">Their email or mobile number</Label>
          <Input
            id="adv-contact"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Sent here, directly to them"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="adv-channel">Send by</Label>
          <select
            id="adv-channel"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={channel}
            onChange={(e) => setChannel(e.target.value as "email" | "sms")}
          >
            <option value="email">Email</option>
            <option value="sms">Text message</option>
          </select>
        </div>
      </div>

      <Button onClick={invite} className="gap-2">
        <UserPlus className="h-4 w-4" /> Send invitation
      </Button>

      {lastCode && (
        // DEMO AFFORDANCE ONLY. In production the code is delivered by the
        // email/SMS transport and is never displayed here — relaying it
        // through the patient is exactly the tampering vector that direct
        // delivery closes.
        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground flex items-start gap-2">
          <Send className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>Demo only:</strong> no email/SMS transport is wired in this prototype, so the
            invitation code is shown here to make the flow testable:{" "}
            <code className="font-mono">{lastCode}</code>. In production it is delivered to the
            advocate directly and never shown on this screen.
          </span>
        </p>
      )}
    </Card>
  );
}
