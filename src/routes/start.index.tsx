import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { QuestionCard } from "@/components/frontdoor/QuestionCard";
import { AdelanteEHR } from "@/lib/ehr";
import type { TriState } from "@/lib/frontDoor";

export const Route = createFileRoute("/start/")({
  head: () => ({
    meta: [
      { title: "Getting started — Adelante" },
      {
        name: "description",
        content:
          "A few quick questions so we can point you to the right place — care, advocate access, or help finding your record.",
      },
      { property: "og:title", content: "Getting started — Adelante" },
      {
        property: "og:description",
        content: "A few quick questions so we can point you to the right place at Adelante.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StartQ1,
});

function StartQ1() {
  const navigate = useNavigate();

  function answer(v: TriState) {
    const id = AdelanteEHR.getCurrentPatientId();
    // "unsure" sets recordLookupPending for the Phase 2 safety-net lookup.
    if (id) AdelanteEHR.recordFrontDoorEntry(id, { existingCare: v });
    if (v === "yes") navigate({ to: "/start/reconnect" });
    else navigate({ to: "/start/helping" });
  }

  return (
    <QuestionCard
      step={1}
      total={3}
      question="Do you already have a care plan or case manager with Adelante?"
      help="If you've worked with us before, we don't want to start you over from scratch."
      options={[
        { key: "yes", label: "Yes", hint: "We'll help you get back into your record." },
        { key: "no", label: "No" },
        {
          key: "unsure",
          label: "I'm not sure",
          hint: "That's fine — we'll check for you along the way.",
        },
      ]}
      onAnswer={answer}
    />
  );
}
