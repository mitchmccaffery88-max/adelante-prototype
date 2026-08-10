// §Front-door Phase 3 — Tier 2: authenticated, staff-operated assisted sign-up.
//
// This is NOT a second sign-up implementation. It renders the exact same
// `SignupFlow` the public `/start/signup` page renders; the only differences
// are that (a) it is RBAC-gated to the roles that do enrollment work, and
// (b) a real staff identity is attached to whatever it produces — including
// `consumedBy` on a redeemed enrollment code, which a Tier 2 operator, not
// the patient, is the one consuming.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserCheck, ShieldAlert } from "lucide-react";
import { SignupFlow } from "@/components/frontdoor/SignupFlow";
import { canRunAssistedSignup, useActingStaff, STAFF_ROLES } from "@/lib/roles";

export const Route = createFileRoute("/assisted-signup")({
  head: () => ({
    meta: [
      { title: "Assisted sign-up — Adelante" },
      {
        name: "description",
        content:
          "Staff tool: create an account or claim an enrollment code on someone's behalf, recorded under your own identity.",
      },
      { property: "og:title", content: "Assisted sign-up — Adelante" },
      {
        property: "og:description",
        content: "Run the front-door sign-up flow for someone, logged under your real staff identity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistedSignupPage,
});

function AssistedSignupPage() {
  const { role, staffId, staffName } = useActingStaff();
  const navigate = useNavigate();

  // Per-page locked state — the backstop behind `RouteAccessGuard`, exactly
  // like every other gated surface in this build.
  if (!canRunAssistedSignup(role)) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <Card className="space-y-3 p-6">
          <div className="flex items-center gap-2 text-navy">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <h1 className="font-display text-xl">Assisted sign-up isn't available for your role</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Creating a record for someone else, or claiming their enrollment code, is limited to the
            roles that do enrollment work:{" "}
            {STAFF_ROLES.filter((r) => canRunAssistedSignup(r.key))
              .map((r) => r.label)
              .join(", ")}
            .
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-8 sm:px-6">
      <div>
        <Badge variant="outline" className="border-teal/40 text-teal">
          <UserCheck className="mr-1 h-3.5 w-3.5" /> Staff tool
        </Badge>
        <h1 className="font-display mt-2 text-2xl text-navy">Assisted sign-up</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The same front door the person would use themselves — run by you, and recorded under your
          name.
        </p>
      </div>

      <SignupFlow
        operator={{ staffId, staffName, role }}
        onComplete={(patient, mode) => {
          toast.success(
            mode === "claimed"
              ? `Claimed ${patient.firstName} ${patient.lastName}'s existing record`
              : `Created a record for ${patient.firstName} ${patient.lastName}`,
            { description: `Recorded under ${staffName}.` },
          );
          navigate({ to: "/record/$patientId", params: { patientId: patient.id } });
        }}
      />
    </div>
  );
}
