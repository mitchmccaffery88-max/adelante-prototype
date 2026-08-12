import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AdelanteEHR } from "@/lib/ehr";
import { detectCrisisLanguage, scanTextForCrisis } from "@/lib/crisisTextDetection";
import { validateContact } from "@/lib/frontDoor";
import { Phone, Siren } from "lucide-react";

export const Route = createFileRoute("/start/other-help")({
  head: () => ({
    meta: [
      { title: "Tell us what brings you here — Adelante" },
      {
        name: "description",
        content:
          "Not looking for care right now? Tell us what you need and we'll point you to the right place.",
      },
      { property: "og:title", content: "Tell us what brings you here — Adelante" },
      {
        property: "og:description",
        content: "Tell Adelante what you're looking for and we'll route you to the right place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OtherHelpPlaceholder,
});

/**
 * PLACEHOLDER (Phase 1). Where a "not seeking care for myself" visitor should
 * actually land is an open product decision. Until that's made this is a plain
 * free-text capture with a human follow-up promise — intentionally NOT an
 * invented destination or a triage tree.
 */
function OtherHelpPlaceholder() {
  const [note, setNote] = useState("");
  const [contact, setContact] = useState("");
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);

  // §Real-time crisis interception — same detector Adel uses, fired as the
  // person types. Resources appear immediately, before and regardless of any
  // submit. The staff-alert layer below is additive, not a replacement.
  const crisis = useMemo(() => detectCrisisLanguage(note), [note]);
  const contactCheck = validateContact(contact);

  function submit() {
    if (!contactCheck.valid) {
      setTouched(true);
      return;
    }
    const id = AdelanteEHR.getCurrentPatientId();
    if (id) {
      AdelanteEHR.recordFrontDoorEntry(id, { otherHelpNote: note.trim() || undefined });
    }
    // Non-clinical holding store — explicitly NOT a chart. See CommunityInquiry.
    AdelanteEHR.createCommunityInquiry({
      body: note,
      contact,
      contactKind: contactCheck.kind ?? "phone",
      crisisFlagged: crisis.matched,
      patternIds: crisis.patternIds,
    });
    // §Crisis detection — free text from a person at the front door. Runs
    // whether or not a chart exists yet: with no patient id the scan raises an
    // anonymous crisis alert to the same role that owns the crisis queue.
    scanTextForCrisis(id, note, {
      surface: "the front-door 'what brings you here' note",
      anonymousContact: contact.trim(),
    });
    setSent(true);
    toast.success("Thanks — we've got it.");
  }

  return (
    <Card className="space-y-5 p-6">
      <div>
        <Badge variant="outline" className="border-gold/50 text-navy">
          Placeholder
        </Badge>
        <h1 className="font-display mt-2 text-2xl text-navy">Tell us what brings you here</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You're not here for mental health, medication, or substance use support for yourself — so
          let's not put you through an intake. Say a little about what you need and someone will
          point you in the right direction.
        </p>
      </div>

      {crisis.matched ? (
        <div
          role="alert"
          data-testid="frontdoor-crisis-resources"
          className="space-y-2 rounded-lg border-2 border-destructive/50 bg-destructive/5 p-4 text-sm"
        >
          <div className="flex items-center gap-2 font-semibold text-destructive">
            <Siren className="h-4 w-4" /> Help is available right now
          </div>
          <p className="text-muted-foreground">
            What you wrote sounds heavy. You don&apos;t have to finish this form — talk to a person
            now. The 988 Suicide &amp; Crisis Lifeline answers any hour, free.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="crisis" size="sm">
              <a href="tel:988">
                <Phone className="h-4 w-4" /> Call 988
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="sms:988">Text 988</a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/crisis">Get help right now</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {sent ? (
        <div className="rounded-lg border-2 border-teal/40 bg-teal/5 p-4 text-sm">
          <div className="font-medium text-navy">Thanks — we've got it.</div>
          <p className="mt-1 text-muted-foreground">
            Someone will follow up. If this is urgent, call the main Adelante line, and if you're in
            crisis call or text 988.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="other-help">What are you looking for?</Label>
          <Textarea
            id="other-help"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            placeholder="In your own words — there's no wrong answer."
          />
          <div className="space-y-1 pt-2">
            <Label htmlFor="other-help-contact">
              Email or phone <span className="text-destructive">*</span>
            </Label>
            <Input
              id="other-help-contact"
              value={contact}
              onBlur={() => setTouched(true)}
              onChange={(e) => setContact(e.target.value)}
              placeholder="you@example.com or (559) 555-0123"
              aria-invalid={touched && !contactCheck.valid}
            />
            <p className="text-xs text-muted-foreground">
              Required — we can&apos;t point you anywhere if we can&apos;t reach you.
            </p>
            {touched && contactCheck.error ? (
              <p className="text-xs font-medium text-destructive">{contactCheck.error}</p>
            ) : null}
          </div>
          <Button onClick={submit} disabled={!note.trim() || !contactCheck.valid}>
            Send
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button asChild variant="outline">
          <Link to="/start/support">Back</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/intake">Actually, I do want care for myself</Link>
        </Button>
      </div>
    </Card>
  );
}
