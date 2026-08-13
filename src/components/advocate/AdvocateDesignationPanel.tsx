// §v3.0 Phase 4 — designation surface for advocates / family members.
//
// Used by the patient on /home, and by the CF Care Manager / ECM Provider on
// the patient's behalf during pre-release intake. There is NO search here and
// none is possible: designation flows one way only — a patient names someone,
// and the invitation goes to THAT person's own contact. An advocate can never
// initiate a connection.
import { toast } from "sonner";
import { AdelanteEHR, useEhr, type AdvocateLink } from "@/lib/ehr";
import { ADVOCATE_AUTHORIZATION_TYPES } from "@/lib/advocate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClientDate } from "@/components/ClientDate";
import { ShieldCheck } from "lucide-react";
import { AhcdValidationChecklist } from "./AhcdValidationChecklist";
import { AdvocateInviteForm } from "./AdvocateInviteForm";

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
              {/*
                §Phase 4.2 (6.5) — staff-only. The validation checklist is
                frontline work on the directive document itself, not something
                the patient works through, so it never renders on /home.
              */}
              {designatedBy.actor !== "patient" &&
                l.status === "active" &&
                l.authorizationType === "ahcd" && (
                  <AhcdValidationChecklist
                    linkId={l.id}
                    reviewerName={designatedBy.name}
                    reviewerRole={designatedBy.actor}
                    className="mt-3"
                  />
                )}
            </li>
          ))}
        </ul>
      )}

      {/* One shared form for every entry point — see `AdvocateInviteForm`. The
          code is never rendered here: it goes to the advocate's own contact,
          and the demo claim path (see `advocateDemo.ts`) accepts any code. */}
      <AdvocateInviteForm
        patientId={patientId}
        designatedBy={designatedBy}
        title="Invite someone"
      />
    </Card>
  );
}
