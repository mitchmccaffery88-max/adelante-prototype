// §v3.0 Phase 4 — the advocate's own surface.
//
// This route is NOT part of the staff shell and carries no `StaffRole`: an
// advocate is an external person, not an employee, so it never appears in
// `STAFF_NAV` and never consults the RBAC matrix. The only way in is an
// invitation code delivered directly to the advocate. There is deliberately no
// patient search, no name/DOB entry, and no way to enumerate patients here.
//
// §Advocate Access Redesign Phase 2 (final) — this file is now the LAYOUT for
// the advocate shell: session/claim handling, the advocate identity header,
// and `<Outlet />`. Each sidebar destination is a real child route, so the
// sidebar switches views instead of scrolling one long page.
import { createFileRoute, Outlet } from "@tanstack/react-router";
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
import { AdvocateTierBadge } from "@/components/advocate/AdvocateWorkspace";
import { SelfCareContextSwitch } from "@/components/ContextSwitcher";
import { AdvocateSessionProvider } from "@/components/advocate/AdvocateSessionContext";
import { AdvocateClaimDocumentChecklist } from "@/components/advocate/AdvocateDocumentChecklist";
import type { AdvocateDocRequirementKey } from "@/lib/advocateDocs";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/advocate")({
  // The advocate session (`adelante.advocateLinkId`) is client-only, so the
  // server can never render the right view here. Client-render the route to
  // avoid a guaranteed hydration mismatch.
  ssr: false,
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
  component: AdvocateLayout,
});

const SESSION_KEY = "adelante.advocateLinkId";

function AdvocateLayout() {
  // The "session" for this prototype: the claimed link id only. No patient id
  // is ever stored client-side, so a tampered value can at worst point at
  // another link — which still has to pass the live gate on every read.
  const [linkId, setLinkId] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setLinkId(window.localStorage.getItem(SESSION_KEY));
    read();
    // The session can be changed by something outside this tree (the demo
    // scenario switcher, another tab). Re-read rather than stay stale.
    window.addEventListener("adelante:advocate-session", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("adelante:advocate-session", read);
      window.removeEventListener("storage", read);
    };
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
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
      {linkId ? (
        <AdvocateShell linkId={linkId} onSignOut={signOut} />
      ) : (
        <>
          <header>
            <h1 className="font-display text-2xl text-navy flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-teal" /> Advocate access
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              You can see the upcoming schedule of the person who invited you, and help with
              coordination — what else you can see depends on the authorization you hold. Every
              time you open this page it is recorded in their record.
            </p>
          </header>
          {/* Dual-role: someone who also has their own record can get back to
              it without claiming anything. */}
          <SelfCareContextSwitch />
          <ClaimForm onClaimed={connect} />
        </>
      )}
    </div>
  );
}

function AdvocateShell({ linkId, onSignOut }: { linkId: string; onSignOut: () => void }) {
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
    <AdvocateSessionProvider
      value={{
        linkId,
        attestedName: link.authorizationAttestedName ?? link.advocateName,
        advocateName: link.advocateName,
        signOut: onSignOut,
      }}
    >
      {/* Advocate identity — provider-of-record style header, kept visually
          separate from the person's sections below. */}
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

      {/* On mobile the sidebar is hidden, so the switch rides here instead. */}
      <div className="md:hidden">
        <SelfCareContextSwitch />
      </div>

      <Outlet />
    </AdvocateSessionProvider>
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
