import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { QuestionCard } from "@/components/frontdoor/QuestionCard";
import { AdelanteEHR } from "@/lib/ehr";
import type { TriState } from "@/lib/frontDoor";

export const Route = createFileRoute("/start/helping")({
  head: () => ({
    meta: [
      { title: "Helping someone else? — Adelante" },
      {
        name: "description",
        content:
          "Tell us whether you're a family member or advocate supporting someone in Adelante care.",
      },
      { property: "og:title", content: "Helping someone else? — Adelante" },
      {
        property: "og:description",
        content: "Family members and advocates connect with an invitation code.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StartQ2,
});

function StartQ2() {
  const navigate = useNavigate();

  function answer(v: TriState) {
    const id = AdelanteEHR.getCurrentPatientId();
    if (id) AdelanteEHR.recordFrontDoorEntry(id, { helpingSomeoneElse: v });
    // Yes goes straight to the existing advocate invitation-code claim screen.
    if (v === "yes") navigate({ to: "/advocate" });
    else navigate({ to: "/start/support" });
  }

  return (
    <QuestionCard
      step={2}
      total={3}
      question="Are you a family member or advocate helping someone with their Adelante care?"
      help="Advocates connect using an invitation code the person you're supporting sends you."
      options={[
        { key: "yes", label: "Yes — I'm helping someone else", hint: "Takes you to advocate access." },
        { key: "no", label: "No — this is for me" },
      ]}
      onAnswer={answer}
    />
  );
}
