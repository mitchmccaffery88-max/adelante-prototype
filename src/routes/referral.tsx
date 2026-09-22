// The PUBLIC referral submission page. Unauthenticated, no staff shell.
// §Phase 4d — the form itself now lives in a shared component so staff can
// submit on someone's behalf from the staff referral queue without a second
// copy of it. Nothing about this page's fields or behaviour changed.
import { createFileRoute } from "@tanstack/react-router";
import { ReferralSubmissionForm } from "@/components/referral/ReferralSubmissionForm";

export const Route = createFileRoute("/referral")({
  head: () => ({
    meta: [
      { title: "Refer someone — Adelante" },
      {
        name: "description",
        content:
          "A short, private form to refer a recently released individual to Adelante care. No clinical detail required.",
      },
      { property: "og:title", content: "Refer someone — Adelante" },
      {
        property: "og:description",
        content:
          "A short, private form to refer someone to Adelante care. No clinical detail required.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReferralPage,
});

function ReferralPage() {
  return <ReferralSubmissionForm variant="public" />;
}
