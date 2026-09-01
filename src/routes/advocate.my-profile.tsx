// §Advocate Access Redesign Phase 2 (final) — My profile.
//
// Same STRUCTURE as the patient "My profile" card (labelled rows + an Edit
// action), but the advocate's OWN identity fields, held on their link row.
//
// Deliberately absent, and not by oversight:
//  - Recovery start date: a patient self-tracking concept. If this advocate
//    also holds their own patient record (see "Support for myself"), that
//    record has its own, entirely separate.
//  - Privacy & consent toggles: an advocate's consent mechanism is the
//    document-based authorization system in My documents. Building a parallel
//    toggle here would imply a second, non-existent, way to grant access.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Globe2, Phone as PhoneIcon, ShieldCheck, UserCog } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { ADVOCATE_AUTHORIZATION_TYPES } from "@/lib/advocate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdvocateSession } from "@/components/advocate/AdvocateSessionContext";
import { AdvocateViewHeader } from "@/components/advocate/AdvocateViewParts";

export const Route = createFileRoute("/advocate/my-profile")({
  component: AdvocateMyProfile,
});

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="w-28 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}

const LANG_LABEL: Record<string, string> = { en: "English", es: "Español" };

function AdvocateMyProfile() {
  const { linkId } = useAdvocateSession();
  const link = useEhr(() => AdelanteEHR.getAdvocateLink(linkId));
  const [open, setOpen] = useState(false);
  if (!link) return null;

  const authLabel = ADVOCATE_AUTHORIZATION_TYPES.find(
    (a) => a.key === link.authorizationType,
  )?.label;

  return (
    <div className="space-y-4">
      <AdvocateViewHeader
        icon={UserCog}
        title="My profile"
        lede="Your own details as the person advocating. This is not the record of the person you support."
      />

      <Card className="p-5" data-testid="advocate-profile-card">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
            <UserCog className="h-4 w-4" /> My profile
          </div>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            Edit
          </Button>
        </div>
        <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
          <Row label="Name">{link.advocateName}</Row>
          <Row label="Relationship">
            {link.relationship || <span className="text-muted-foreground">Not on file</span>}
          </Row>
          <Row label="Phone">
            {link.contactPhone ? (
              <span className="inline-flex items-center gap-1.5">
                <PhoneIcon className="h-3.5 w-3.5 text-muted-foreground" /> {link.contactPhone}
              </span>
            ) : (
              <span className="text-muted-foreground">Not on file</span>
            )}
          </Row>
          <Row label="Language">
            <span className="inline-flex items-center gap-1.5">
              <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
              {LANG_LABEL[link.preferredLanguage ?? "en"]}
            </span>
          </Row>
          <Row label="Invited to">{link.invitationSentTo}</Row>
          <Row label="Authorization">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-teal" />
              {authLabel ?? "Not confirmed"}
            </span>
          </Row>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          What you're authorized to see is set by the documents in{" "}
          <Link to="/advocate/my-documents" className="font-medium text-teal underline">
            My documents
          </Link>
          , not by anything on this page.
        </p>
      </Card>

      <EditDialog
        linkId={linkId}
        open={open}
        onOpenChange={setOpen}
        initial={{
          advocateName: link.advocateName,
          relationship: link.relationship ?? "",
          contactPhone: link.contactPhone ?? "",
          preferredLanguage: link.preferredLanguage ?? "en",
        }}
      />
    </div>
  );
}

function EditDialog({
  linkId,
  open,
  onOpenChange,
  initial,
}: {
  linkId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: {
    advocateName: string;
    relationship: string;
    contactPhone: string;
    preferredLanguage: string;
  };
}) {
  const [form, setForm] = useState(initial);

  function save() {
    try {
      AdelanteEHR.updateAdvocateProfile(linkId, {
        advocateName: form.advocateName,
        relationship: form.relationship,
        contactPhone: form.contactPhone,
        preferredLanguage: form.preferredLanguage === "es" ? "es" : "en",
      });
      toast.success("Saved.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save that.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) setForm(initial);
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit my profile</DialogTitle>
          <DialogDescription>
            Your own contact details. Changing these never changes what you can see.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="adv-name">Your name</Label>
            <Input
              id="adv-name"
              value={form.advocateName}
              onChange={(e) => setForm({ ...form, advocateName: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="adv-rel">Relationship to the person you support</Label>
            <Input
              id="adv-rel"
              value={form.relationship}
              onChange={(e) => setForm({ ...form, relationship: e.target.value })}
              placeholder="Sister, friend, caregiver…"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="adv-phone">Phone</Label>
            <Input
              id="adv-phone"
              value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="adv-lang">Preferred language</Label>
            <Select
              value={form.preferredLanguage}
              onValueChange={(v) => setForm({ ...form, preferredLanguage: v })}
            >
              <SelectTrigger id="adv-lang">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
