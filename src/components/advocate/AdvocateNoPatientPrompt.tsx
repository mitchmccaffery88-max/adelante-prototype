// §Advocate Build 2 — fixes the real dead-end: an advocate-only visitor who
// lands on /patient or /home has no patient record and used to get the generic
// "we don't have a record for you yet / get started" empty state, which is both
// wrong and a dead end. If an advocate session exists we show the way back to
// the advocate shell instead of the sign-up prompt.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HeartHandshake } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAdvocateSessionId } from "@/components/ContextSwitcher";

export function AdvocateNoPatientPrompt({ fallback }: { fallback: ReactNode }) {
  const linkId = useAdvocateSessionId();
  if (!linkId) return <>{fallback}</>;
  return (
    <Card className="space-y-3 p-6 text-sm" data-testid="advocate-no-patient-prompt">
      <p className="flex items-center gap-2 font-display text-lg text-navy">
        <HeartHandshake className="h-5 w-5 text-teal" /> You're signed in as an advocate
      </p>
      <p className="text-muted-foreground">
        This page is a patient's own care portal, and you don't have a patient record here. Your
        advocate view is in a separate place.
      </p>
      <Button asChild>
        <Link to="/advocate">Go to my advocate view</Link>
      </Button>
    </Card>
  );
}
