import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AdelanteEHR } from "@/lib/ehr";
import { SignupFlow } from "@/components/frontdoor/SignupFlow";

export const Route = createFileRoute("/start/signup")({
  head: () => ({
    meta: [
      { title: "Create your account — Adelante" },
      {
        name: "description",
        content:
          "Set up your Adelante account: your name, date of birth, and how we reach you. Takes about a minute, before any questions about care.",
      },
      { property: "og:title", content: "Create your account — Adelante" },
      {
        property: "og:description",
        content: "Set up your Adelante account before starting care — about a minute.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignupPage,
});

/**
 * §Front-door — the PUBLIC entry point (Tier 1). Thin: the form itself lives
 * in `SignupFlow`, shared verbatim with the Tier 2 staff-operated tool at
 * `/assisted-signup`. No operator is passed here, so the flow shows the
 * optional "did someone help you?" field and attributes nothing to staff.
 */
function SignupPage() {
  const navigate = useNavigate();
  return (
    <SignupFlow
      onComplete={(patient, mode) => {
        AdelanteEHR.setCurrentPatientId(patient.id);
        if (mode === "claimed") {
          toast.success(`Welcome back, ${patient.firstName}`, {
            description: "We found the plan your care team set up for you.",
          });
        } else {
          toast.success("Account created", { description: "Next: a few quick questions." });
        }
        navigate({ to: "/start" });
      }}
    />
  );
}
