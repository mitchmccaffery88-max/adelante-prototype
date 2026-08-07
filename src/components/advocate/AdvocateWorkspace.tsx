// §v3.0 Phase 4 expansion — the advocate's expanded surface.
//
// Every panel here is rendered ONLY when the live store gate says the
// permission is held; nothing is hidden with CSS and nothing is fetched
// "just in case". 42 CFR Part 2 content is masked in the data layer
// (`AdelanteEHR.advocate*`), not here — this file cannot un-mask it.
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import type { AdvocateContributionSection } from "@/lib/ehr";
import { ADVOCATE_TIER_LABEL, advocateTier } from "@/lib/advocate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ClientDate } from "@/components/ClientDate";
import { HeartHandshake, ClipboardList, IdCard, Stethoscope, Lock } from "lucide-react";

export function AdvocateTierBadge({ linkId }: { linkId: string }) {
  const link = useEhr(() => AdelanteEHR.getAdvocateLink(linkId));
  if (!link?.authorizationType) return null;
  return <Badge variant="secondary">{ADVOCATE_TIER_LABEL[advocateTier(link.authorizationType)]}</Badge>;
}

export function AdvocateCoordinationPanel({ linkId }: { linkId: string }) {
  const view = useEhr(() => AdelanteEHR.advocateCoordination(linkId));
  const [need, setNeed] = useState("");
  if (!view.allowed) return null;

  function add() {
    const res = AdelanteEHR.advocateAddCoordinationNeed(linkId, { need });
    if (!res.ok) return toast.error(res.reason);
    setNeed("");
    toast.success("Shared with the care team.");
  }

  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 font-display text-lg text-navy">
        <HeartHandshake className="h-5 w-5 text-teal" /> Housing, food & transport
      </h2>
      {view.items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing being coordinated right now.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {view.items.map((i) => (
            <li key={i.id} className="rounded-lg border p-3 text-sm">
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium text-navy">{i.need}</span>
                <Badge variant="outline">{i.status.replace(/_/g, " ")}</Badge>
              </span>
              {i.note && <span className="mt-1 block text-xs text-muted-foreground">{i.note}</span>}
            </li>
          ))}
        </ul>
      )}
      {view.maskedCount > 0 && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> {view.maskedCount} item
          {view.maskedCount === 1 ? " is" : "s are"} protected and not shown to advocates.
        </p>
      )}
      {view.canWrite && (
        <div className="mt-4 space-y-2">
          <Label htmlFor="adv-need">Raise a need</Label>
          <div className="flex gap-2">
            <Input
              id="adv-need"
              value={need}
              onChange={(e) => setNeed(e.target.value)}
              placeholder="e.g. needs a ride to Thursday's appointment"
            />
            <Button onClick={add}>Send</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

const SECTIONS: { key: AdvocateContributionSection; label: string }[] = [
  { key: "housing", label: "Housing" },
  { key: "appointments", label: "Appointments" },
  { key: "pharmacy", label: "Pharmacy" },
  { key: "dme", label: "Equipment" },
  { key: "general", label: "General" },
];

export function AdvocateCarePlanParticipationPanel({ linkId }: { linkId: string }) {
  const view = useEhr(() => AdelanteEHR.advocateCarePlanParticipation(linkId));
  const [section, setSection] = useState<AdvocateContributionSection>("general");
  const [text, setText] = useState("");
  if (!view.allowed) return null;

  function send() {
    const res = AdelanteEHR.advocateAddCarePlanComment(linkId, { section, text });
    if (!res.ok) return toast.error(res.reason);
    setText("");
    toast.success(res.reason);
  }

  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 font-display text-lg text-navy">
        <ClipboardList className="h-5 w-5 text-teal" /> Coming-home plan
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        The care team writes this plan. You can add comments and requests — they'll see them
        alongside it.
      </p>
      {view.plan ? (
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">Housing</dt>
            <dd className="font-medium text-navy">{view.plan.housing.arrangement || "—"}</dd>
          </div>
          <div className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">Appointments arranged</dt>
            <dd className="font-medium text-navy">{view.plan.appointmentCount}</dd>
          </div>
          <div className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">Pharmacy</dt>
            <dd className="font-medium text-navy">{view.plan.pharmacyName ?? "—"}</dd>
          </div>
          <div className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">Equipment needs</dt>
            <dd className="font-medium text-navy">
              {view.plan.dmeNeeds.length ? view.plan.dmeNeeds.join(", ") : "—"}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No plan has been started yet.</p>
      )}

      {view.contributions.length > 0 && (
        <ul className="mt-4 space-y-2">
          {view.contributions.map((c) => (
            <li key={c.id} className="rounded-lg border bg-muted/30 p-3 text-sm">
              <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="uppercase tracking-wide">{c.section}</span>
                <ClientDate value={c.createdAt} />
              </span>
              <span className="mt-1 block">{c.text}</span>
            </li>
          ))}
        </ul>
      )}

      {view.canWrite && (
        <div className="mt-4 space-y-2">
          <Label htmlFor="adv-comment">Add your input</Label>
          <div className="flex flex-wrap gap-2">
            {SECTIONS.map((s) => (
              <Button
                key={s.key}
                size="sm"
                variant={section === s.key ? "default" : "outline"}
                onClick={() => setSection(s.key)}
              >
                {s.label}
              </Button>
            ))}
          </div>
          <Textarea id="adv-comment" value={text} onChange={(e) => setText(e.target.value)} rows={3} />
          <Button onClick={send}>Send to care team</Button>
        </div>
      )}
    </Card>
  );
}

export function AdvocateEligibilityPanel({ linkId }: { linkId: string }) {
  const view = useEhr(() => AdelanteEHR.advocateEligibilityAssist(linkId));
  const [name, setName] = useState("");
  if (!view.allowed) return null;

  function attest() {
    const res = AdelanteEHR.advocateAttestEligibilityAssist(linkId, { attestedName: name });
    if (!res.ok) return toast.error(res.reason);
    setName("");
    toast.success(res.reason);
  }

  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 font-display text-lg text-navy">
        <IdCard className="h-5 w-5 text-teal" /> Medi-Cal application
      </h2>
      {view.coverage ? (
        <p className="mt-3 text-sm">
          Status: <span className="font-medium text-navy">{view.coverage.status}</span> ·{" "}
          {view.coverage.verified}
          {view.coverage.countyOfRelease ? ` · ${view.coverage.countyOfRelease} County` : ""}
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No coverage record yet.</p>
      )}
      {view.canAct && (
        <div className="mt-4 space-y-2">
          <Label htmlFor="adv-attest-elig">
            Type your name to confirm you're helping with this application
          </Label>
          <div className="flex gap-2">
            <Input id="adv-attest-elig" value={name} onChange={(e) => setName(e.target.value)} />
            <Button onClick={attest}>Attest</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            <strong>Placeholder:</strong> this records your attestation only. No application is
            submitted from here — the submission path and DHCS form content are not defined yet.
          </p>
        </div>
      )}
    </Card>
  );
}

export function AdvocateClinicalPanel({ linkId }: { linkId: string }) {
  const view = useEhr(() => AdelanteEHR.advocateCarePlanClinical(linkId));
  if (!view.allowed) return null;
  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 font-display text-lg text-navy">
        <Stethoscope className="h-5 w-5 text-teal" /> Care plan
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Shown because your authorization includes decision-making authority.
      </p>
      {view.summary && <p className="mt-3 text-sm">{view.summary}</p>}
      {view.focusAreas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {view.focusAreas.map((f) => (
            <Badge key={f.key} variant="outline">
              {f.label}
              {f.severity ? ` · ${f.severity}` : ""}
            </Badge>
          ))}
        </div>
      )}
      {view.activeGoals.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {view.activeGoals.map((g) => (
            <li key={g.id}>{g.text}</li>
          ))}
        </ul>
      )}
      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5" /> Substance-use treatment information is protected under 42
        CFR Part 2 and is never shown here, whatever your authorization.
      </p>
    </Card>
  );
}

/**
 * "Would you like support for yourself too?" — one identity, two hats.
 * Accepting creates the advocate's OWN patient record and hands off to the
 * standard intake flow. It is a separate record with separate care; nothing
 * about the person they support is carried across.
 */
export function AdvocateSelfCareCard({ linkId }: { linkId: string }) {
  const link = useEhr(() => AdelanteEHR.getAdvocateLink(linkId));
  const self = useEhr(() => AdelanteEHR.advocateSelfPatient(linkId));
  const [open, setOpen] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  if (!link) return null;

  if (self) {
    return (
      <Card className="space-y-2 p-5 text-sm">
        <h2 className="font-display text-lg text-navy">Your own care</h2>
        <p className="text-muted-foreground">
          You have your own record with us, kept completely separate from the person you support.
        </p>
        <Button
          onClick={() => {
            AdelanteEHR.setCurrentPatientId(self.id);
            window.location.href = "/intake";
          }}
        >
          Go to my care
        </Button>
      </Card>
    );
  }

  if (link.selfCareOfferDeclinedAt && !open) return null;

  return (
    <Card className="space-y-3 p-5 text-sm">
      <h2 className="font-display text-lg text-navy">Would you like support for yourself too?</h2>
      <p className="text-muted-foreground">
        Supporting someone is hard. If you'd like care of your own — mental health, medication
        support, or substance-use help — we can open a record for you here, with the same sign-in.
        It stays completely separate from the person you're supporting: your own care team, your own
        plan, and nothing shared between the two.
      </p>
      {open ? (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="self-first">First name</Label>
              <Input id="self-first" value={first} onChange={(e) => setFirst(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="self-last">Last name</Label>
              <Input id="self-last" value={last} onChange={(e) => setLast(e.target.value)} />
            </div>
          </div>
          <Button
            onClick={() => {
              try {
                const p = AdelanteEHR.startAdvocateSelfCare(linkId, {
                  firstName: first,
                  lastName: last,
                });
                AdelanteEHR.setCurrentPatientId(p.id);
                toast.success("Your own record is ready.");
                window.location.href = "/intake";
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not start.");
              }
            }}
          >
            Start my intake
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button onClick={() => setOpen(true)}>Yes, support for me too</Button>
          <Button variant="ghost" onClick={() => AdelanteEHR.declineAdvocateSelfCare(linkId)}>
            Not now
          </Button>
        </div>
      )}
    </Card>
  );
}
