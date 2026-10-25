// The PUBLIC referral submission page. Unauthenticated, no staff shell.
// §Phase 4d — the form itself now lives in a shared component so staff can
// submit on someone's behalf from the staff referral queue without a second
// copy of it. Nothing about this page's fields or behaviour changed.
import { createFileRoute } from "@tanstack/react-router";
import { ReferralSubmissionForm } from "@/components/referral/ReferralSubmissionForm";
import {websiteEn} from '@/lib/i18n.website';

export const Route = createFileRoute("/referral")({
  head: () => ({
    meta: [
      { title: "Help someone start care — Adelante Health" },
      {
        name: "description",
        content:
          websiteEn['website.v2.referral.intro'],
      },
      { property: "og:title", content: "Help someone start care — Adelante Health" },
      {
        property: "og:description",
        content:
          websiteEn['website.v2.referral.intro'],
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
