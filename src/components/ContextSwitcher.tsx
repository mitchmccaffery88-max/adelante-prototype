// §Advocate Build 2 item 3 — role/context switch UI.
//
// Built ON TOP of the existing dual-session model, which is unchanged: the
// patient session is `adelante.currentPatientId` (owned by the store) and the
// advocate session is `adelante.advocateLinkId` (owned by /advocate). They
// coexist; this component only makes the second one visible from the first
// shell and vice versa. Nothing here writes or clears either key.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeftRight, HeartHandshake } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { cn } from "@/lib/utils";

const ADVOCATE_SESSION_KEY = "adelante.advocateLinkId";

/** Read the advocate session after hydration so SSR and client agree. */
export function useAdvocateSessionId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    try {
      setId(window.localStorage.getItem(ADVOCATE_SESSION_KEY));
    } catch {
      setId(null);
    }
  }, []);
  return id;
}

/** Patient shell → advocate shell. Renders only when an advocate link exists. */
export function AdvocateContextSwitch({ className }: { className?: string }) {
  const linkId = useAdvocateSessionId();
  const identity = useEhr(() =>
    linkId ? AdelanteEHR.advocatePatientIdentity(linkId) : undefined,
  );
  if (!linkId || !identity) return null;
  return (
    <Link
      to="/advocate"
      data-testid="switch-to-advocate"
      className={cn(
        "flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-teal/40 bg-teal/5 px-4 py-2.5 text-sm font-medium text-navy hover:bg-teal/10",
        className,
      )}
    >
      <span className="flex items-center gap-2">
        <HeartHandshake className="h-4 w-4 text-teal" />
        {/* The name follows the same effective-access gate as the banner. */}
        {identity.allowed && identity.firstName
          ? `Advocating for ${identity.firstName}`
          : "Advocate access (pending verification)"}
      </span>
      <ArrowLeftRight className="h-4 w-4 opacity-60" />
    </Link>
  );
}

/** Advocate shell → patient shell. Renders only when a real patient session exists. */
export function SelfCareContextSwitch({ className }: { className?: string }) {
  const currentId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const patient = useEhr(() => AdelanteEHR.getPatient(currentId));
  if (!patient) return null;
  return (
    <Link
      to="/home"
      data-testid="switch-to-my-care"
      className={cn(
        "flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-navy/20 bg-navy/5 px-4 py-2.5 text-sm font-medium text-navy hover:bg-navy/10",
        className,
      )}
    >
      <span className="flex items-center gap-2">
        <ArrowLeftRight className="h-4 w-4 text-navy/70" />
        Back to my care ({patient.firstName})
      </span>
    </Link>
  );
}
