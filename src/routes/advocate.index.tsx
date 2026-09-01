// §Advocate Access Redesign Phase 2 (final) — the Dashboard, deliberately
// short. Identity/access status, outstanding items ONLY when there are any,
// one compact "Supporting [Name]" summary, and quick entries. Everything else
// (paperwork, self-help, self-referral, the person's detail) is its own real
// destination in the sidebar, so nothing is duplicated inline here.
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Calendar, FileStack, MessageSquare, Map, ChevronRight } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClientDate } from "@/components/ClientDate";
import { AdvocateIdentityBanner } from "@/components/advocate/AdvocateIdentityBanner";
import { AdvocateNextStepsPanel } from "@/components/advocate/AdvocateNextStepsPanel";
import { useAdvocateSession } from "@/components/advocate/AdvocateSessionContext";
import { useSupportingName } from "@/components/advocate/AdvocateViewParts";

export const Route = createFileRoute("/advocate/")({
  component: AdvocateDashboard,
});

function AdvocateDashboard() {
  const { linkId, attestedName } = useAdvocateSession();
  const supportingName = useSupportingName(linkId);
  const schedule = useEhr(() => AdelanteEHR.advocateSchedule(linkId));
  const messages = useEhr(() => AdelanteEHR.advocateCareMessages(linkId));
  const next = schedule.items[0];

  return (
    <div className="space-y-4">
      <AdvocateIdentityBanner linkId={linkId} />

      {/* Renders nothing at all when access is live and nothing is
          outstanding — the panel's own rule, not a second one here. */}
      <AdvocateNextStepsPanel linkId={linkId} attestedName={attestedName} />

      {schedule.allowed && (
        <Card className="space-y-3 p-5" data-testid="advocate-supporting-summary">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg text-navy">
                {supportingName ? `Supporting ${supportingName}` : "The person you support"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {next ? (
                  <>
                    Next: {next.label} · <ClientDate
                      value={next.start}
                      options={{ dateStyle: "medium", timeStyle: "short" }}
                    />
                  </>
                ) : (
                  "Nothing on the schedule right now."
                )}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {messages.allowed
                  ? `${messages.messages.length} message${messages.messages.length === 1 ? "" : "s"} in the care thread`
                  : "Messages aren't available with your current authorization."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link to="/advocate/appointments">
                Open appointments <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/advocate/messages">
                <MessageSquare className="h-4 w-4" /> Messages
              </Link>
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile to="/advocate/library" icon={BookOpen} label="Library" line="Reading for advocates" />
        <Tile
          to="/advocate/resources"
          icon={Map}
          label="Resources"
          line="Community help nearby"
        />
        <Tile
          to="/advocate/my-documents"
          icon={FileStack}
          label="My documents"
          line="Your authorization paperwork"
        />
      </div>

      {!schedule.allowed && (
        <Card className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
          Once your authorization is on file, the person you support appears here.
        </Card>
      )}
    </div>
  );
}

function Tile({
  to,
  icon: Icon,
  label,
  line,
}: {
  to: string;
  icon: typeof BookOpen;
  label: string;
  line: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-start gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-secondary"
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-teal" aria-hidden="true" />
      <span>
        <span className="block text-sm font-medium text-navy">{label}</span>
        <span className="block text-xs text-muted-foreground">{line}</span>
      </span>
    </Link>
  );
}
