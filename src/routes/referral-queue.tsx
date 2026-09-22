// §Phase 4d — the staff referral queue. Until now the "Referrals" nav entry
// pointed at the PUBLIC submission form, which dropped staff out of the EHR
// shell entirely; the real consolidated tracker only existed embedded in two
// dashboards. This is its dedicated home, following the same shape as the
// other single-purpose staff queues (/notes-queue, /crisis-queue).
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { canAccess, useActingStaff } from "@/lib/roles";
import { ReferralTrackerCard } from "@/components/admin/ReferralTrackerCard";
import { ReferralSubmissionForm } from "@/components/referral/ReferralSubmissionForm";
import { Lock, Plus } from "lucide-react";

export const Route = createFileRoute("/referral-queue")({
  head: () => ({
    meta: [
      { title: "Referral queue — Adelante" },
      {
        name: "description",
        content:
          "Work every referral into Adelante care: contact, enroll or decline, with aging and outreach status.",
      },
      { property: "og:title", content: "Referral queue — Adelante" },
      {
        property: "og:description",
        content: "Work every referral into Adelante care from one staff queue.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReferralQueuePage,
});

function ReferralQueuePage() {
  const { role } = useActingStaff();
  const access = canAccess(role, "care_coordination");
  const referrals = useEhr(() => AdelanteEHR.listReferrals());
  const [submitOpen, setSubmitOpen] = useState(false);

  if (access.level === "none") {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Card className="p-6 text-sm text-muted-foreground flex items-center gap-2">
          <Lock className="h-4 w-4" /> Your role can&apos;t view referrals.
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy">Referrals</h1>
          <p className="text-sm text-muted-foreground">
            Everyone referred into Adelante care. Open a referral to contact, enroll or decline it.
          </p>
        </div>
        <Button onClick={() => setSubmitOpen(true)} data-testid="staff-submit-referral">
          <Plus className="h-4 w-4 mr-2" />
          Submit a referral
        </Button>
      </header>

      <ReferralTrackerCard referrals={referrals} title="Referral queue" limit={100} />

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submit a referral on someone&apos;s behalf</DialogTitle>
            <DialogDescription>
              The same form the public uses. Enter the referring person and agency as they gave them
              to you — not your own details unless you are the referrer.
            </DialogDescription>
          </DialogHeader>
          <ReferralSubmissionForm variant="staff" onSubmitted={() => setSubmitOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
