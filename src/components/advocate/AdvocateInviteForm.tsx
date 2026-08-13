// §Advocate build 1 — ONE invitation form, used by every entry point.
//
// Patient-facing (`AdvocateDesignationPanel`), staff-facing pre-release
// (`CapacityAuthorityStep`) and the staff record panel all render THIS
// component, so the plain-language type descriptions, the documentation
// preview and the delivery behaviour cannot drift apart.
//
// Two things it deliberately does not do: it never searches for a patient,
// and it never claims an invitation grants anything. The type chosen here is
// the inviter's EXPECTATION — the advocate still has to confirm their own
// authorization when they claim.
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, type AdvocateLink } from "@/lib/ehr";
import { ADVOCATE_AUTHORIZATION_TYPES, type AdvocateAuthorizationType } from "@/lib/advocate";
import { requirementsForType } from "@/lib/advocateDocs";
import { deliverAdvocateInvitation } from "@/lib/advocateInviteDelivery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileCheck2, UserPlus } from "lucide-react";

export type AdvocateInviteDraft = {
  advocateName: string;
  relationship: string;
  invitationSentTo: string;
  invitationChannel: "email" | "sms";
  expectedAuthorizationType: AdvocateAuthorizationType;
};

export function AdvocateInviteForm({
  patientId,
  designatedBy,
  allowedTypes,
  title = "Invite an advocate or family member",
  submitLabel = "Send invitation",
  onSubmit,
  onInvited,
}: {
  patientId?: string;
  designatedBy?: AdvocateLink["designatedBy"];
  /** Restrict the chooser — pre-release only locates AHCD / conservatorship. */
  allowedTypes?: AdvocateAuthorizationType[];
  title?: string;
  submitLabel?: string;
  /**
   * Override the store call (pre-release routes through
   * `identifyPreReleaseAdvocate` so the episode linkage is kept). Must return
   * the created link so delivery and the window can be recorded.
   */
  onSubmit?: (draft: AdvocateInviteDraft) => AdvocateLink;
  onInvited?: (link: AdvocateLink) => void;
}) {
  const types = ADVOCATE_AUTHORIZATION_TYPES.filter(
    (t) => !allowedTypes || allowedTypes.includes(t.key),
  );
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [contact, setContact] = useState("");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [type, setType] = useState<AdvocateAuthorizationType>(types[0]!.key);
  const [busy, setBusy] = useState(false);

  const chosen = types.find((t) => t.key === type);
  const requirements = requirementsForType(type);

  async function submit() {
    const draft: AdvocateInviteDraft = {
      advocateName: name.trim(),
      relationship: relationship.trim(),
      invitationSentTo: contact.trim(),
      invitationChannel: channel,
      expectedAuthorizationType: type,
    };
    setBusy(true);
    try {
      const link = onSubmit
        ? onSubmit(draft)
        : AdelanteEHR.createAdvocateInvitation({
            patientId: patientId!,
            advocateName: draft.advocateName,
            ...(draft.relationship ? { relationship: draft.relationship } : {}),
            invitationSentTo: draft.invitationSentTo,
            invitationChannel: draft.invitationChannel,
            expectedAuthorizationType: draft.expectedAuthorizationType,
            designatedBy: designatedBy!,
          });
      setName("");
      setRelationship("");
      setContact("");
      onInvited?.(link);
      // Real transport, honest fallback: the 14-day window only starts when
      // this reports a genuine send.
      await deliverAdvocateInvitation(link);
      const after = AdelanteEHR.getAdvocateLink(link.id);
      if (after?.notificationDelivery?.status === "sent") {
        toast.success(`Invitation sent directly to ${link.invitationSentTo}.`);
      } else {
        toast.warning(
          "Invitation created, but no delivery transport is connected yet — nothing was actually sent.",
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send that invitation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-navy">
        <UserPlus className="h-4 w-4" /> {title}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="adv-name">Their name</Label>
          <Input
            id="adv-name"
            data-testid="advocate-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
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
            data-testid="advocate-contact"
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

      <div className="space-y-1">
        <Label htmlFor="adv-type">What kind of advocate are they?</Label>
        <select
          id="adv-type"
          data-testid="advocate-instrument"
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value as AdvocateAuthorizationType)}
        >
          {types.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        {chosen && <p className="text-xs text-muted-foreground">{chosen.summary}</p>}
      </div>

      <div className="rounded-md bg-muted/50 p-3 text-xs" data-testid="advocate-doc-preview">
        <p className="flex items-center gap-2 font-medium text-navy">
          <FileCheck2 className="h-3.5 w-3.5" /> What they'll be asked for
        </p>
        <ul className="mt-2 space-y-2">
          {requirements.map((r) => (
            <li key={r.key}>
              <span className="font-medium">{r.label}</span>
              <span className="block text-muted-foreground">{r.plainLanguage}</span>
            </li>
          ))}
        </ul>
      </div>

      <Button
        data-testid="advocate-invite"
        className="gap-2"
        disabled={busy || !name.trim() || !contact.trim()}
        onClick={submit}
      >
        <UserPlus className="h-4 w-4" /> {submitLabel}
      </Button>
    </div>
  );
}
