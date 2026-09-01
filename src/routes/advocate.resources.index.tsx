// §Advocate Access Redesign Phase 3 — the real directory, reused verbatim.
// No parallel data, no reduced listing set: `CommunityResourceCenter` with the
// advocate surface flag, which only changes where detail links point.
import { createFileRoute } from "@tanstack/react-router";
import { CommunityResourceCenter } from "@/components/reentry/CommunityResourceCenter";

export const Route = createFileRoute("/advocate/resources/")({
  component: () => <CommunityResourceCenter surface="advocate" />,
});
