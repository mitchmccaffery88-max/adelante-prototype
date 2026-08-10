import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { QuestionCard } from "@/components/frontdoor/QuestionCard";
import { AdelanteEHR } from "@/lib/ehr";
import type { TriState } from "@/lib/frontDoor";

export const Route = createFileRoute("/start/support")({
  head: () => ({
    meta: [
      { title: "What kind of support? — Adelante" },
      {
        name: "description",
        content:
          "Tell us whether you're looking for mental health, medication management, or substance use support.",
      },
      { property: "og:title", content: "What kind of support? — Adelante" },
      {
        property: "og:description",
        content: "Mental health, medication management, and substance use support at Adelante.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StartQ3,
});

function StartQ3() {
  const navigate = useNavigate();

  function answer(v: TriState) {
    const id = AdelanteEHR.getCurrentPatientId();
    if (id) AdelanteEHR.recordFrontDoorEntry(id, { seekingCareForSelf: v });
    if (v === "yes") navigate({ to: "/intake" });
    else navigate({ to: "/start/other-help" });
  }

  return (
    <QuestionCard
      step={3}
      total={3}
      question="Are you looking for mental health, medication management, or substance use support for yourself?"
      help="You don't need a diagnosis or a referral to say yes."
      options={[
        { key: "yes", label: "Yes", hint: "We'll start your intake." },
        { key: "no", label: "No — I'm here for something else" },
      ]}
      onAnswer={answer}
    />
  );
}
