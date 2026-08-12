import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AdelanteEHR } from "@/lib/ehr";
import { scanTextForCrisis } from "@/lib/crisisTextDetection";

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
  const [sent, setSent] = useState(false);

  function submit() {
    const id = AdelanteEHR.getCurrentPatientId();
    if (id) {
      AdelanteEHR.recordFrontDoorEntry(id, { otherHelpNote: note.trim() || undefined });
    }
    // §Crisis detection — free text from a person at the front door. Runs
    // whether or not a chart exists yet: with no patient id the scan raises an
    // anonymous crisis alert to the same role that owns the crisis queue.
    scanTextForCrisis(id, note, { surface: "the front-door 'what brings you here' note" });
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
          <Button onClick={submit} disabled={!note.trim()}>
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
