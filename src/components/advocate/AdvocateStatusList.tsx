// §Group 2 O2 — advocate status for the patient: Invited, Waiting for your
// consent, Waiting for their sign-up, Active. Delivery errors are shown.
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { advocateInvitationConsentActive } from "@/lib/advocateInviteDelivery";
import { advocateStatus, ADVOCATE_STATUS_LABEL, contactDrifted } from "@/lib/contactAdvocate";
import { readEmergencyContacts } from "@/lib/emergencyContacts";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function AdvocateStatusList({ patientId }: { patientId: string }) {
  const { lang } = useI18n();
  const es = lang === "es";
  const links = useEhr(() => AdelanteEHR.listAdvocateLinks(patientId).filter((l) => l.status === "invited" || l.status === "active"));
  const consent = useEhr(() => advocateInvitationConsentActive(patientId));
  const contacts = useEhr(() => readEmergencyContacts(AdelanteEHR.getPatient(patientId)));
  if (!links.length) return null;
  return (
    <ul className="space-y-2" data-testid="advocate-status-list">
      {links.map((l) => {
        const st = advocateStatus(l, consent);
        const c = l.contactId ? contacts.find((x) => x.id === l.contactId) : undefined;
        const drift = c && contactDrifted(l, c);
        return (
          <li key={l.id} className="rounded-md border p-3 text-sm space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{l.advocateName}</span>
              <Badge variant="outline" data-testid="advocate-status">{ADVOCATE_STATUS_LABEL[st][es ? "es" : "en"]}</Badge>
            </div>
            {l.notificationDelivery?.status === "failed" && (
              <p role="alert" className="text-xs text-destructive">
                {es ? "No se pudo enviar la invitación: " : "The invitation could not be sent: "}{l.notificationDelivery.detail ?? ""}
              </p>
            )}
            {drift && c && (
              <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="advocate-drift">
                <span>{es ? "Cambiaron los datos del contacto — ¿actualizar defensor? (Borrador)" : "Contact details changed — update advocate?"}</span>
                <Button size="sm" variant="outline" className="min-h-11" onClick={() => { try { AdelanteEHR.updateAdvocateFromContact(l.id, c); toast.success(es ? "Actualizado" : "Advocate updated"); } catch (e) { toast.error((e as Error).message); } }}>
                  {es ? "Actualizar" : "Update advocate"}
                </Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
