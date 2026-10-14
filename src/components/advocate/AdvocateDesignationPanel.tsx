import { CircleAlert } from "lucide-react";
import { StatusChip } from "@/components/ui/status-chip";
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
import { Link } from "@tanstack/react-router";
import { AhcdValidationChecklist } from "./AhcdValidationChecklist";
import { AdvocateInviteForm } from "./AdvocateInviteForm";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.336c81cdb6b2": {
    "en": "Advocates & family",
    "es": "Personas de apoyo y familia"
  },
  "ui.42fee695a3b4": {
    "en": "One trusted person — a family member, conservator or authorized representative — can be invited to see upcoming appointments and groups. They see nothing else: no notes, no care plan, no messages. The invitation goes straight to them, and access can be removed at any time.",
    "es": "Puedes invitar a una persona de confianza (un familiar, curador o representante autorizado) para que vea las próximas citas y grupos. No verán nada más: ni notas, ni el plan de atención, ni mensajes. La invitación se les envía directamente y puedes quitarles el acceso en cualquier momento."
  },
  "ui.e51845cb1141": {
    "en": "Named",
    "es": "Designado"
  },
  "ui.62e5c2f080e0": {
    "en": "Invitation pending — sign consent to activate.",
    "es": "Invitación pendiente: firma el consentimiento para activar el acceso."
  },
  "ui.70e36caeb7b3": {
    "en": "Review consent",
    "es": "Revisar consentimiento"
  },
  "ui.a13a9514ccdc": {
    "en": "Remove access",
    "es": "Quitar acceso"
  },
  "ui.9768ea31dce2": {
    "en": "Invite someone",
    "es": "Invitar a alguien"
  }
} as const;


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
  const { lang: screenLang } = useI18n();

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
          <ShieldCheck className="h-5 w-5 text-teal" /> {SCREEN_COPY["ui.336c81cdb6b2"][screenLang]} </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {SCREEN_COPY["ui.42fee695a3b4"][screenLang]} </p>
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
                {designatedBy.actor === "patient" ? <StatusChip state={l.status === "active" ? "done" : l.status === "invited" ? "team" : "closed"} label={l.status} /> : <Badge variant={l.status === "active" ? "default" : "secondary"}>{l.status}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {l.authorizationType
                  ? AUTH_LABEL.get(l.authorizationType)
                  : "Authorization not confirmed yet — no access."}
              </p>
              <p className="text-xs text-muted-foreground">
                {SCREEN_COPY["ui.e51845cb1141"][screenLang]} <ClientDate value={l.designatedAt} /> · {l.notificationSentAt ? `sent to ${l.invitationSentTo}` : `will be sent to ${l.invitationSentTo} after consent`}
              </p>
              {l.status === "invited" && !l.notificationSentAt && l.notificationDelivery?.status !== "failed" && l.notificationDelivery?.status !== "not_configured" && (
                <p className="text-xs text-muted-foreground">
                  {SCREEN_COPY["ui.62e5c2f080e0"][screenLang]} {" "}
                  <Link to="/consent" search={{ patientId: l.patientId }} className="text-teal underline underline-offset-2">
                    {SCREEN_COPY["ui.70e36caeb7b3"][screenLang]} </Link>
                </p>
              )}
              {(l.notificationDelivery?.status === "failed" || l.notificationDelivery?.status === "not_configured") && (
                <p className="text-xs text-attention" role="alert"><CircleAlert className="mr-1 inline size-4 shrink-0 align-text-bottom" aria-hidden="true" />
                  {l.notificationDelivery.status === "not_configured"
                    ? "We couldn't send this invitation because messaging is not connected. Your care team can help."
                    : "We couldn't send this invitation. Your care team can help confirm the contact method and try again."}
                </p>
              )}
              {l.status !== "revoked" && (
                <Button size="sm" variant="ghost" onClick={() => revoke(l)}>
                  {SCREEN_COPY["ui.a13a9514ccdc"][screenLang]} </Button>
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
        title={SCREEN_COPY["ui.9768ea31dce2"][screenLang]}
      />
    </Card>
  );
}
