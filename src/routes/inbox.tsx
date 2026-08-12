// §Inbox — the staff "my work" shell: notes I haven't signed, and provider
// requests waiting on someone.
//
// Routing call: ONE route (`/inbox`) with in-page tabs rather than nested
// routes, matching the existing cross-patient queues (cosign inbox, crisis
// queue, message queue) which are each a single flat page. The existing
// cosign inbox is surfaced as a card/link, not rebuilt.
//
// There is deliberately NO Results tab: lab/imaging results do not exist in
// this build, and a dead tab is worse than an absent one. See the RESERVED
// target schema in `src/lib/labsVitalsScaffold.ts` for the handoff starting
// point (NOT IMPLEMENTED — no runtime consumers).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { canAccess, useActingStaff } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UnsignedNotesQueue } from "@/components/inbox/UnsignedNotesQueue";
import { ProviderRequestQueue } from "@/components/inbox/ProviderRequestQueue";
import { DocumentVerifyQueue } from "@/components/documents/DocumentVerifyQueue";
import { AdvocateReviewQueue } from "@/components/inbox/AdvocateReviewQueue";
import { CommunityInquiryQueue } from "@/components/inbox/CommunityInquiryQueue";
import { ArrowLeft, ClipboardList, FileSignature, Inbox as InboxIcon, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox — Adelante" },
      {
        name: "description",
        content:
          "Staff inbox: your unsigned progress notes and the cross-patient provider request queue, with a link to the cosign inbox.",
      },
      { property: "og:title", content: "Inbox — Adelante" },
      {
        property: "og:description",
        content: "Finish unsigned notes and claim provider requests in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InboxPage,
});

function InboxPage() {
  const { role } = useActingStaff();
  const notes = canAccess(role, "therapy_notes");
  const requests = canAccess(role, "provider_requests");
  const inquiries = canAccess(role, "community_inquiries");
  const [tab, setTab] = useState(notes.level === "none" ? "requests" : "unsigned");

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/clinician">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to clinician
        </Link>
      </Button>
      <header>
        <h1 className="font-display text-2xl text-navy flex items-center gap-2">
          <InboxIcon className="h-5 w-5 text-teal" /> Inbox
        </h1>
        <p className="text-sm text-muted-foreground">
          Your unfinished notes and the shared provider request queue. Cosignatures live in the
          cosign inbox.
        </p>
      </header>

      <Card className="p-3 text-xs flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-navy">
          <FileSignature className="h-4 w-4 text-teal" />
          Notes waiting on your cosignature are tracked separately.
        </span>
        <Button asChild size="sm" variant="outline">
          <Link to="/cosign-inbox">Open cosign inbox</Link>
        </Button>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="unsigned">Unsigned</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="advocate">Advocate</TabsTrigger>
          <TabsTrigger value="inquiries">Community</TabsTrigger>
        </TabsList>
        <TabsContent value="unsigned" className="pt-3">
          {notes.level === "none" ? (
            <Card className="p-6 text-sm text-muted-foreground flex items-center gap-2">
              <Lock className="h-4 w-4" /> Your role can&apos;t view clinical notes.
            </Card>
          ) : (
            <UnsignedNotesQueue />
          )}
        </TabsContent>
        <TabsContent value="requests" className="pt-3">
          {requests.level === "none" ? (
            <Card className="p-6 text-sm text-muted-foreground flex items-center gap-2">
              <Lock className="h-4 w-4" />
              <span className="flex items-center gap-1">
                <ClipboardList className="h-4 w-4" /> Your role can&apos;t view provider requests.
              </span>
            </Card>
          ) : (
            <ProviderRequestQueue />
          )}
        </TabsContent>
        {/* §v3.0 Phase 5 — document verify queue. Ownership is derived from
            the patient's pre-release episode, not assigned here. */}
        <TabsContent value="documents" className="pt-3">
          <DocumentVerifyQueue />
        </TabsContent>
        {/* §Group D items 1 + 2 — advocate care-plan input and eligibility
            attestations, reviewed by the episode-derived plan owner. */}
        <TabsContent value="advocate" className="pt-3">
          <AdvocateReviewQueue />
        </TabsContent>
        {/* §Front door — non-clinical inquiries from people with no chart. */}
        <TabsContent value="inquiries" className="pt-3">
          {inquiries.level === "none" ? (
            <Card className="p-6 text-sm text-muted-foreground flex items-center gap-2">
              <Lock className="h-4 w-4" /> Your role can&apos;t view community inquiries.
            </Card>
          ) : (
            <CommunityInquiryQueue />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
