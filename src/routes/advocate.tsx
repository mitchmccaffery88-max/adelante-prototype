// §v3.0 Phase 4 — the advocate's own surface.
//
// This route is NOT part of the staff shell and carries no `StaffRole`: an
// advocate is an external person, not an employee, so it never appears in
// `STAFF_NAV` and never consults the RBAC matrix. The only way in is an
// invitation code delivered directly to the advocate. There is deliberately no
// patient search, no name/DOB entry, and no way to enumerate patients here.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { ADVOCATE_AUTHORIZATION_TYPES, type AdvocateAuthorizationType } from "@/lib/advocate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ClientDate } from "@/components/ClientDate";
import {
  AdvocateTierBadge,
  AdvocateCoordinationPanel,
  AdvocateCarePlanParticipationPanel,
  AdvocateEligibilityPanel,
  AdvocateClinicalPanel,
  AdvocateSelfCareCard,
  AdvocateDocumentsPanel,
  AdvocateSelfHelpPanel,
} from "@/components/advocate/AdvocateWorkspace";
import { AdvocatePoAwarenessPanel } from "@/components/advocate/AdvocatePoAwarenessPanel";
import { AdvocateIdentityBanner } from "@/components/advocate/AdvocateIdentityBanner";
import { AdvocateNextStepsPanel } from "@/components/advocate/AdvocateNextStepsPanel";
import { AdvocateMessagesPanel } from "@/components/advocate/AdvocateMessagesPanel";
import { AdvocateAppointmentsPanel } from "@/components/advocate/AdvocateAppointmentsPanel";
import { SelfCareContextSwitch } from "@/components/ContextSwitcher";
import {
  AdvocateClaimDocumentChecklist,
  AdvocateDocumentStatusPanel,
} from "@/components/advocate/AdvocateDocumentChecklist";
import type { AdvocateDocRequirementKey } from "@/lib/advocateDocs";
import { ShieldCheck, Lock } from "lucide-react";

export const Route = createFileRoute("/advocate")({
  head: () => ({
    meta: [
      { title: "Advocate access — Adelante" },
      {
        name: "description",
        content:
          "Invitation-only access for a designated advocate or family member to a patient's upcoming appointments and groups.",
      },
      { property: "og:title", content: "Advocate access — Adelante" },
      {
        property: "og:description",
        content:
          "Invitation-only, schedule-limited access for a designated advocate or family member.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdvocatePage,
});

const SESSION_KEY = "adelante.advocateLinkId";

function AdvocatePage() {
  // The "session" for this prototype: the claimed link id only. No patient id
  // is ever stored client-side, so a tampered value can at worst point at
  // another link — which still has to pass the live gate on every read.
  const [linkId, setLinkId] = useState<string | null>(null);
  useEffect(() => {
    setLinkId(window.localStorage.getItem(SESSION_KEY));
  }, []);

  function connect(id: string) {
    window.localStorage.setItem(SESSION_KEY, id);
    setLinkId(id);
  }
  function signOut() {
    window.localStorage.removeItem(SESSION_KEY);
    setLinkId(null);
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4 sm:p-6">
      <header>
        <h1 className="font-display text-2xl text-navy flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-teal" /> Advocate access
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You can see the upcoming schedule of the person who invited you, and help with
          coordination — what else you can see depends on the authorization you hold. Every time you
          open this page it is recorded in their record.
        </p>
      </header>
      {linkId ? (
        <AdvocateScheduleView linkId={linkId} onSignOut={signOut} />
      ) : (
        <>
          {/* Dual-role: someone who also has their own record can get back to
              it without claiming anything. */}
          <SelfCareContextSwitch />
          <ClaimForm onClaimed={connect} />
        </>
      )}
    </div>
  );
}

function ClaimForm({ onClaimed }: { onClaimed: (linkId: string) => void }) {
  const [code, setCode] = useState("");
  const [authType, setAuthType] = useState<AdvocateAuthorizationType | "">("");
  const [attested, setAttested] = useState("");
  const [docs, setDocs] = useState<AdvocateDocRequirementKey[]>([]);

  // Deep link from the invitation notification: /advocate?code=ADV-...
  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.search).get("code");
    if (fromLink) setCode(fromLink);
  }, []);

  function claim() {
    if (!authType) {
      toast.error("Choose the authorization that applies to you.");
      return;
    }
    try {
      const link = AdelanteEHR.claimAdvocateInvitation({
        code,
        authorizationType: authType,
        attestedName: attested,
        attestedRequirements: docs,
        // Self-referential guard: if a patient session is live, the store
        // refuses a claim on that same person's record.
        ...(AdelanteEHR.getCurrentPatientId()
          ? { actingPatientId: AdelanteEHR.getCurrentPatientId() }
          : {}),
      });
      toast.success("Connected.");
      onClaimed(link.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not use that invitation.");
    }
  }

  return (
    <Card className="space-y-5 p-5">
      <div className="space-y-1">
        <Label htmlFor="adv-code">Invitation code</Label>
        <Input
          id="adv-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ADV-XXXX-XXXX-XXXX"
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          This was sent directly to you. If you don't have one, ask the person you're supporting to
          invite you — there is no other way to connect.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Which authorization applies to you?</Label>
        <RadioGroup
          value={authType}
          onValueChange={(v) => {
            setAuthType(v as AdvocateAuthorizationType);
            // Requirements are per-instrument; a changed answer resets them.
            setDocs([]);
          }}
          className="space-y-2"
        >
          {ADVOCATE_AUTHORIZATION_TYPES.map((a) => (
            <label
              key={a.key}
              htmlFor={`auth-${a.key}`}
              className="flex cursor-pointer gap-3 rounded-lg border p-3 text-sm"
            >
              <RadioGroupItem id={`auth-${a.key}`} value={a.key} className="mt-1" />
              <span>
                <span className="font-medium text-navy">{a.label}</span>
                <span className="block text-xs text-muted-foreground">{a.summary}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </div>

      {authType && (
        <AdvocateClaimDocumentChecklist
          authorizationType={authType}
          checked={docs}
          onChange={setDocs}
        />
      )}

      <div className="space-y-1">
        <Label htmlFor="adv-attest">Type your full name to attest this is accurate</Label>
        <Input id="adv-attest" value={attested} onChange={(e) => setAttested(e.target.value)} />
      </div>

      <Button onClick={claim}>Connect</Button>
    </Card>
  );
}

function AdvocateScheduleView({ linkId, onSignOut }: { linkId: string; onSignOut: () => void }) {
  // Live-evaluated on every render: a revocation, an expiry, or a withdrawn
  // ROI stops this view without anything needing to be told to stop.
  const link = useEhr(() => AdelanteEHR.getAdvocateLink(linkId));
  const view = useEhr(() => AdelanteEHR.advocateSchedule(linkId));
  const authLabel = ADVOCATE_AUTHORIZATION_TYPES.find(
    (a) => a.key === link?.authorizationType,
  )?.label;

  if (!link) {
    return (
      <Card className="space-y-3 p-5">
        <p className="text-sm text-muted-foreground">This connection no longer exists.</p>
        <Button variant="outline" onClick={onSignOut}>
          Start over
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
        <div>
          <p className="font-medium text-navy">{link.advocateName}</p>
          {/* div, not p: the tier badge renders a block element. */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {authLabel} <AdvocateTierBadge linkId={linkId} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={view.allowed ? "default" : "secondary"}>
            {view.allowed ? "Active" : "No access"}
          </Badge>
          <Button size="sm" variant="ghost" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </Card>

      {/* §Build 2 item 1 — identity banner sits above everything and is
          driven by effective access, not by the link row existing. */}
      <AdvocateIdentityBanner linkId={linkId} />
      {/* §Build 3 Part A — what is still outstanding, and who has to move it.
          Renders directly under the banner and disappears once access is
          effective with nothing pending. */}
      <AdvocateNextStepsPanel
        linkId={linkId}
        attestedName={link.authorizationAttestedName ?? link.advocateName}
      />
      {/* Dual-role: reverse switch back to this person's own care, when they
          also hold a patient session. */}
      <SelfCareContextSwitch />

      {!view.allowed ? (
        <Card className="flex gap-3 p-5 text-sm">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium text-navy">You don't have access right now</p>
            <p className="mt-1 text-muted-foreground">{view.reason}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Nothing about this person's care is shown until that is resolved.
            </p>
          </div>
        </Card>
      ) : (
        <AdvocateAppointmentsPanel linkId={linkId} />
      )}

      {/* Paperwork status renders whether or not access is open — missing
          documentation is usually the REASON access is closed, so hiding it
          behind the gate would hide the fix. */}
      <AdvocateDocumentStatusPanel
        linkId={linkId}
        attestedName={link.authorizationAttestedName ?? link.advocateName}
      />

      {view.allowed && (
        <>
          <AdvocatePoAwarenessPanel linkId={linkId} patientId={link?.patientId} />
          <AdvocateMessagesPanel linkId={linkId} />
          <AdvocateCoordinationPanel linkId={linkId} />
          <AdvocateCarePlanParticipationPanel linkId={linkId} />
          <AdvocateEligibilityPanel linkId={linkId} />
          <AdvocateDocumentsPanel linkId={linkId} />
          <AdvocateSelfHelpPanel linkId={linkId} />
          <AdvocateClinicalPanel linkId={linkId} />
        </>
      )}

      <AdvocateSelfCareCard linkId={linkId} />
    </div>
  );
}
