// §Group sessions — patient-facing group scheduling.
//
// Two distinct things live here, and the difference matters:
//   1. "Your group calendar" — read-only upcoming occurrences for groups the
//      patient is ALREADY enrolled in (both categories; seeing what you are
//      enrolled in is not the same as enrolling yourself).
//   2. "Open groups you can join" — self-service enrollment, restricted to the
//      self-service categories (`open_psychoeducational` and the billable
//      `skills_education`). `sud_clinical_preauth` groups must never surface
//      here; the store enforces this too (`openGroupsForPatient` +
//      `assertEnrollmentAllowed`), this is not a UI-only filter. Billability
//      is deliberately NOT shown to patients.
//
// Both paths require the care-plan group-eligibility flag, which staff set.
// PLACEHOLDER: curriculum tags and eligibility criteria are still provisional
// pending Christi/SME content; categories and billing codes are now real.
//
// FUTURE: an Authorized Representative / Collateral (advocate) acting for the
// patient will reuse this surface — the actor is passed to the store, which is
// the single place that decides who may enroll.
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AdelanteEHR,
  formatLocationAddress,
  isVirtualGroupModality,
  useEhr,
} from "@/lib/ehr";
import { nextOccurrenceForGroup } from "@/lib/groupMetrics";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClientDate } from "@/components/ClientDate";
import { Users, CalendarClock, MapPin } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { patientGroupLabel } from "@/lib/groupJoinView";


export function PatientGroupScheduling({ patientId }: { patientId: string }) {
  const enrolled = useEhr(() => AdelanteEHR.groupsForPatient(patientId));

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
                      {starts.map((s) => {
                        // §Phase 6b — join link per meeting, only when virtual.
                        const virtual = isVirtualGroupModality(
                          AdelanteEHR.groupOccurrenceModality(group.id, s),
                        );
                        const room = virtual
                          ? AdelanteEHR.groupJoinLink(group.id, s)
                          : undefined;
                        return (
                          <li key={s} className="space-y-0.5">
                            <span className="flex items-center gap-1.5">
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
                            </span>
                            {virtual && (
                              <span className="block break-all pl-5">
                                {room ? (
                                  <a
                                    className="text-teal underline"
                                    href={room.joinUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Join online
                                  </a>
                                ) : (
                                  "Meets online — your care team will share the join link."
                                )}
                              </span>
                            )}
                          </li>
                        );
                      })}

                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <AskToJoinGroups patientId={patientId} />
    </div>
  );
}
// §Group join requests — every patient asks; staff review (no silent
// self-enrollment). SUD groups show category-only wording.
function AskToJoinGroups({ patientId }: { patientId: string }) {
  const groups = useEhr(() => AdelanteEHR.requestableGroupsForPatient(patientId));
  const requests = useEhr(() => AdelanteEHR.listGroupJoinRequests({ patientId }));
  const all = useEhr(() => AdelanteEHR.listGroupSessions());
  const [openId, setOpenId] = useState<string>();
  const [note, setNote] = useState("");
  return (
    <Card className="p-6 space-y-4" data-testid="ask-to-join">
      <div>
        <h2 className="font-display text-lg text-navy">Groups you can ask to join</h2>
        <p className="text-xs text-muted-foreground">
          Ask to join and your care team will review it with you.
        </p>
      </div>
      {requests.length > 0 && (
        <ul className="space-y-1.5" aria-label="Your group requests">
          {requests.map((r) => {
            const g = all.find((x) => x.id === r.sessionId);
            return (
              <li key={r.id} className="rounded border p-2.5 text-sm" data-testid="my-group-request">
                <span className="font-medium text-navy">{g ? patientGroupLabel(g) : "Group"}</span>
                <span className="block text-xs text-muted-foreground">
                  {r.status === "pending"
                    ? "Request sent — your care team will review."
                    : r.status === "approved"
                      ? "Approved — you're in this group."
                      : "Not approved this time — your care team can tell you more."}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No other groups to ask about right now.</p>
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => {
            const next = nextOccurrenceForGroup(g.id);
            const sud = g.category === "sud_clinical_preauth";
            return (
              <li key={g.id} className="rounded-lg border p-3 space-y-2">
                <span className="font-medium text-navy">{patientGroupLabel(g)}</span>
                {!sud && g.description && <p className="text-sm text-muted-foreground">{g.description}</p>}
                {!sud && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5 text-teal" />
                    {next ? (
                      <ClientDate value={next} options={{ weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }} />
                    ) : (
                      "Next meeting to be scheduled"
                    )}
                  </p>
                )}
                {!sud && AdelanteEHR.groupVirtualExposure(g.id).virtual && (
                  <p className="text-xs text-muted-foreground">Meets online.</p>
                )}
                {openId === g.id ? (
                  <div className="space-y-2">
                    <Textarea
                      aria-label="Note for your care team (optional)"
                      placeholder="Anything you'd like your care team to know? (optional)"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="min-h-11 bg-navy text-navy-foreground hover:bg-navy/90"
                        onClick={() => {
                          try {
                            AdelanteEHR.requestJoinGroup({ sessionId: g.id, patientId, note });
                            toast.success("Request sent — your care team will review.");
                            setOpenId(undefined);
                            setNote("");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Could not send.");
                          }
                        }}
                      >
                        Send request
                      </Button>
                      <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setOpenId(undefined)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="min-h-11" onClick={() => setOpenId(g.id)}>
                    Ask to join
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
