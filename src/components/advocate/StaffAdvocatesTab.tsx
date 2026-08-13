// §Advocate build 1 — the staff surface for managing advocate connections.
//
// This is the ECM Provider / Administrator invite call site (the CF Care
// Manager path stays in pre-release intake where it belongs, tied to the
// capacity determination). It renders the SAME `AdvocateInviteForm` as the
// patient-facing panel, so the plain-language type descriptions and the
// documentation preview cannot diverge between entry points.
//
// It also carries the "send the missing paperwork request" action: staff can
// re-ask an already-connected advocate for a specific document without
// tearing down and re-issuing the whole invitation.
import { toast } from "sonner";
import { AdelanteEHR, useEhr, type AdvocateLink } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { ADVOCATE_AUTHORIZATION_TYPES } from "@/lib/advocate";
import {
  ADVOCATE_DOC_REQUIREMENTS,
  COMMUNICATION_RIGHTS_REQUIREMENT_KEYS,
  requirementsForType,
} from "@/lib/advocateDocs";
import { AdvocateInviteForm } from "./AdvocateInviteForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClientDate } from "@/components/ClientDate";
import { MailWarning, MessageSquare, ShieldCheck } from "lucide-react";

const AUTH_LABEL = new Map(ADVOCATE_AUTHORIZATION_TYPES.map((a) => [a.key, a.label]));

export function StaffAdvocatesTab({
  patientId,
  readOnly,
}: {
  patientId: string;
  readOnly?: boolean;
}) {
  const { role, staffName } = useActingStaff();
  const links = useEhr(() => AdelanteEHR.listAdvocateLinks(patientId));
  // Only the roles this build authorises as inviters appear as inviters; any
  // other role with read access to the consent ledger sees the list only.
  const canInvite =
    !readOnly && (role === "ecm_provider" || role === "sys_admin" || role === "cf_care_manager");
  const actor =
    role === "ecm_provider"
      ? ("ecm_provider" as const)
      : role === "sys_admin"
        ? ("administrator" as const)
        : ("cf_care_manager" as const);

  return (
    <div className="space-y-4">
      {links.length === 0 && (
        <p className="text-sm text-muted-foreground">No advocate connections on this record.</p>
      )}
      {links.map((l) => (
        <StaffAdvocateCard key={l.id} link={l} staffName={staffName} readOnly={!canInvite} />
      ))}
      {canInvite && (
        <AdvocateInviteForm
          patientId={patientId}
          designatedBy={{ actor, name: staffName }}
          title="Invite an advocate on this person's behalf"
        />
      )}
    </div>
  );
}

function StaffAdvocateCard({
  link,
  staffName,
  readOnly,
}: {
  link: AdvocateLink;
  staffName: string;
  readOnly: boolean;
}) {
  const rows = useEhr(() => AdelanteEHR.advocateDocumentRequirements(link.id));
  const type = link.authorizationType ?? link.expectedAuthorizationType;
  const defs = type ? requirementsForType(type) : [];
  const keys = Array.from(new Set([...defs.map((d) => d.key), ...rows.map((r) => r.key)]));

  function request(key: (typeof keys)[number]) {
    try {
      AdelanteEHR.requestAdvocateDocument({ linkId: link.id, key, requestedBy: staffName });
      toast.success(`Requested from ${link.advocateName}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send that request.");
    }
  }

  function verify(key: (typeof keys)[number]) {
    const ref = window.prompt("Reference for the document you checked (optional)") ?? "";
    try {
      AdelanteEHR.verifyAdvocateDocumentRequirement({
        linkId: link.id,
        key,
        verifiedBy: staffName,
        ...(ref.trim() ? { verificationRef: ref.trim() } : {}),
      });
      toast.success("Marked as verified.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not verify that.");
    }
  }

  return (
    <div className="space-y-2 rounded-lg border p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium text-navy">
          <ShieldCheck className="h-4 w-4 text-teal" />
          {link.advocateName}
          {link.relationship ? ` · ${link.relationship}` : ""}
        </span>
        <Badge variant={link.status === "active" ? "default" : "secondary"}>{link.status}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {type ? AUTH_LABEL.get(type) : "Authorization not confirmed yet"} · invited{" "}
        <ClientDate value={link.designatedAt} /> by {link.designatedBy.name} (
        {link.designatedBy.actor.replace(/_/g, " ")}) · sent to {link.invitationSentTo}
      </p>
      <p className="text-xs text-muted-foreground">
        {link.notificationSentAt ? (
          <>
            Notification delivered <ClientDate value={link.notificationSentAt} /> — 14-day window
            runs to <ClientDate value={link.invitationExpiresAt} />.
          </>
        ) : (
          <>
            Not delivered yet ({link.notificationDelivery?.status ?? "pending"}) — the 14-day window
            starts when the advocate actually receives it.
          </>
        )}
      </p>

      {keys.length > 0 && (
        <ul className="space-y-2 pt-1">
          {keys.map((key) => {
            const row = rows.find((r) => r.key === key);
            const def = ADVOCATE_DOC_REQUIREMENTS[key];
            const status = row?.status ?? "pending";
            return (
              <li
                key={key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-xs"
              >
                <span>
                  <span className="font-medium text-navy">{def.label}</span>
                  <span className="block text-muted-foreground">
                    {status === "verified"
                      ? `Verified by ${row?.verifiedBy}`
                      : status === "attested"
                        ? `Advocate confirmed as ${row?.attestedName}`
                        : "Not on file"}
                    {row?.requestedAt ? ` · requested ${row.requestCount ?? 1}×` : ""}
                  </span>
                </span>
                {!readOnly && status !== "verified" && (
                  <span className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => request(key)}
                    >
                      <MailWarning className="h-3.5 w-3.5" /> Request
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => verify(key)}>
                      Mark verified
                    </Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* §Build 3 — the communication-rights axis is separate paperwork, not a
          tier upgrade: a general AR designation does NOT carry it. Staff add
          the specific row here, and it only counts once verified. */}
      {!readOnly && (
        <div className="space-y-2 rounded-md border border-dashed p-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-navy">
            <MessageSquare className="h-3.5 w-3.5 text-teal" /> Communication rights (messaging)
          </p>
          <p className="text-[11px] text-muted-foreground">
            Two-way messaging with the care team needs its own authorization. Add and verify the
            document that actually grants it.
          </p>
          <div className="flex flex-wrap gap-2">
            {COMMUNICATION_RIGHTS_REQUIREMENT_KEYS.filter((k) => !keys.includes(k)).map((k) => (
              <Button key={k} size="sm" variant="outline" onClick={() => request(k)}>
                Add: {ADVOCATE_DOC_REQUIREMENTS[k].label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
