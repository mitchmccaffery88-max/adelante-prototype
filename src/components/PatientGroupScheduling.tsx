// §Group sessions — patient-facing group scheduling.
//
// Two distinct things live here, and the difference matters:
//   1. "Your group calendar" — read-only upcoming occurrences for groups the
//      patient is ALREADY enrolled in (both categories; seeing what you are
//      enrolled in is not the same as enrolling yourself).
//   2. "Open groups you can join" — self-service enrollment, restricted to
//      `open_psychoeducational` ONLY. `sud_clinical_preauth` groups must never
//      surface here; the store enforces this too (`openGroupsForPatient` +
//      `assertEnrollmentAllowed`), this is not a UI-only filter.
//
// Both paths require the care-plan group-eligibility flag, which staff set.
// PLACEHOLDER: category names, curriculum tags and eligibility criteria are
// all provisional pending Christi/SME content.
//
// FUTURE: an Authorized Representative / Collateral (advocate) acting for the
// patient will reuse this surface — the actor is passed to the store, which is
// the single place that decides who may enroll.
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AdelanteEHR, formatLocationAddress, useEhr } from "@/lib/ehr";
import { nextOccurrenceForGroup } from "@/lib/groupMetrics";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClientDate } from "@/components/ClientDate";
import { Users, CalendarClock, MapPin, MessageSquare } from "lucide-react";

/** Prefilled body for the care-team message on the missing-eligibility state. */
export const GROUP_ELIGIBILITY_MESSAGE_DRAFT =
  "Hi — I'd like to join a group. Could you add groups to my care plan so I can sign up?";

export function PatientGroupScheduling({ patientId }: { patientId: string }) {
  const eligible = useEhr(() => AdelanteEHR.isGroupEligible(patientId));
  const enrolled = useEhr(() => AdelanteEHR.groupsForPatient(patientId));
  const open = useEhr(() => AdelanteEHR.openGroupsForPatient(patientId));

  const enrolledRows = useMemo(
    () =>
      enrolled.map((g) => ({
        group: g,
        starts: AdelanteEHR.groupOccurrenceStarts(g.id, 4),
      })),
    [enrolled],
  );

  return (
    <div className="space-y-4">
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="font-display text-lg text-navy">Your group calendar</h2>
          <p className="text-xs text-muted-foreground">
            The next meetings for groups you're already part of.
          </p>
        </div>
        {enrolledRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You're not in any groups right now. Your care team will let you know if a group would
            help.
          </p>
        ) : (
          <ul className="space-y-3">
            {enrolledRows.map(({ group, starts }) => {
              const loc = AdelanteEHR.getLocation(group.locationId);
              return (
                <li key={group.id} className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-teal" />
                    <span className="font-medium text-navy">{group.topic}</span>
                  </div>
                  {group.description && (
                    <p className="text-sm text-muted-foreground">{group.description}</p>
                  )}
                  {loc && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> {loc.name} — {formatLocationAddress(loc)}
                    </p>
                  )}
                  {starts.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No meetings scheduled yet.</p>
                  ) : (
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {starts.map((s) => (
                        <li key={s} className="flex items-center gap-1.5">
                          <CalendarClock className="h-3.5 w-3.5 text-teal" />
                          <ClientDate
                            value={s}
                            options={{
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            }}
                          />
                          <span>· {group.durationMin} min</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="p-6 space-y-4">
        <div>
          <h2 className="font-display text-lg text-navy">Open groups you can join</h2>
          <p className="text-xs text-muted-foreground">
            Open groups you can sign up for yourself. Other groups are arranged with your care
            team.
          </p>
        </div>
        {!eligible ? (
          // Not an error state: the patient has done nothing wrong, they just
          // haven't been marked eligible for groups yet. Same guidance tone as
          // every other empty state, and it names the concrete next step.
          <div className="space-y-2" data-testid="group-eligibility-guidance">
            <p className="text-sm text-navy">
              You're not marked as eligible for groups yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Groups are added to your care plan by your care team. Ask your case manager or
              therapist to add groups to your care plan, and open group sign-up will show up here
              straight away.
            </p>
            <p className="text-xs text-muted-foreground">
              You can message your care team from your home page, or bring it up at your next
              appointment.
            </p>
            <Button asChild size="sm" variant="outline" className="min-h-11">
              <Link
                to="/home"
                search={{ msg: GROUP_ELIGIBILITY_MESSAGE_DRAFT }}
                data-testid="group-eligibility-message-care-team"
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Message care team
              </Link>
            </Button>
          </div>
        ) : open.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No open groups available right now. Check back soon.
          </p>
        ) : (
          <ul className="space-y-3">
            {open.map((g) => {
              const loc = AdelanteEHR.getLocation(g.locationId);
              const next = nextOccurrenceForGroup(g.id);
              return (
                <li key={g.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-navy">{g.topic}</span>
                    <Badge variant="secondary">Open group</Badge>
                  </div>
                  {g.description && (
                    <p className="text-sm text-muted-foreground">{g.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5 text-teal" />
                    {next ? (
                      <ClientDate
                        value={next}
                        options={{
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        }}
                      />
                    ) : (
                      "Next meeting to be scheduled"
                    )}
                    <span>· {g.durationMin} min</span>
                  </p>
                  {loc && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> {loc.name} — {formatLocationAddress(loc)}
                    </p>
                  )}
                  <Button
                    size="sm"
                    className="bg-navy text-navy-foreground hover:bg-navy/90"
                    onClick={() => {
                      try {
                        AdelanteEHR.selfEnrollInGroup({ sessionId: g.id, patientId });
                        toast.success("You're signed up for this group.");
                      } catch (err) {
                        toast.error(
                          err instanceof Error ? err.message : "Could not join that group.",
                        );
                      }
                    }}
                  >
                    Join this group
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}