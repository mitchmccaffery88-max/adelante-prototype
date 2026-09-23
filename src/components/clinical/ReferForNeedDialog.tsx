// §SDOH Referral Thread Phase 5d-2 — the ONE place a staff member turns a
// social need into a real referral.
//
// Shared by the record's SDOH tab and the Care Coordination tile so the two
// can never drift. Everything Phase 5d-1 established still holds here: the
// data layer enforces the 42 CFR Part 2 consent gate (this dialog only warns
// and reports the refusal honestly), every write is attributed, and a referral
// attached to a staff-only need inherits staff-only visibility.
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Building2, ExternalLink, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AdelanteEHR,
  isPart2SensitiveCategory,
  type ResourceReferralCategory,
  type SdohPlanItem,
} from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { listResources, RESOURCE_CATEGORIES } from "@/lib/communityResources";
import { matchResourcesForNeed } from "@/lib/sdohResourceMatch";

const OFF_DIRECTORY = "__off_directory__";

export function ReferForNeedDialog({
  patientId,
  item,
  open,
  onOpenChange,
}: {
  patientId: string;
  item: SdohPlanItem;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { staffName, role } = useActingStaff();
  // The need's own category suggestion comes from the same matcher the
  // patient-facing resource list uses, so staff and patient see one taxonomy.
  const suggested = useMemo(() => matchResourcesForNeed(item)?.categoryIds ?? [], [item]);
  const [category, setCategory] = useState<ResourceReferralCategory>(
    (suggested[0] as ResourceReferralCategory | undefined) ?? "housing",
  );
  // null = untouched, so the first real directory listing is the default and
  // off-directory is a deliberate choice rather than the path of least effort.
  const [choicePick, setChoicePick] = useState<string | null>(null);
  const [provider, setProvider] = useState("");
  const [note, setNote] = useState("");

  // Real directory listings for this category, with their live link state.
  // Unpublished orgs are still selectable — staff often refer to an org that
  // is mid-verification — but the row says so plainly.
  const orgs = useMemo(() => listResources(category), [category]);
  const choice = choicePick ?? orgs[0]?.id ?? OFF_DIRECTORY;
  const staffOnlyNeed = item.visibleToPatient === false;

  function submit() {
    const fromDirectory = choice !== OFF_DIRECTORY;
    const org = fromDirectory ? orgs.find((o) => o.id === choice) : undefined;
    const name = fromDirectory ? (org?.name ?? "") : provider.trim();
    if (!name) return toast.error("Choose an organization or type the name.");
    if (!fromDirectory && !note.trim()) {
      return toast.error("Add a note for an organization that isn't in the directory.");
    }
    try {
      AdelanteEHR.addResourceReferral(
        patientId,
        {
          category,
          provider: name,
          // Off-directory referrals carry NO `resourceId` and are never added
          // to the directory — publishing stays with content administration.
          ...(fromDirectory && org ? { resourceId: org.id } : {}),
          sdohItemId: item.id,
          note: note.trim(),
        },
        { staffName, role },
      );
      toast.success("Referral created and the need moved to sent.");
      setProvider("");
      setNote("");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create this referral.", {
        action: {
          label: "Open consents",
          onClick: () => window.location.assign(`/record/${patientId}?section=consents`),
        },
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Refer for: {item.need}</DialogTitle>
          <DialogDescription>
            Creating a referral moves this need to <strong>sent</strong>, recorded against your
            name.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Category</Label>
            <Select
              value={category}
              onValueChange={(v) => {
                setCategory(v as ResourceReferralCategory);
                setChoicePick(null);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {suggested.includes(c.id) ? " · suggested" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Organization</Label>
            <Select value={choice} onValueChange={setChoice}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                    {o.status === "verified" ? "" : " · not published"}
                  </SelectItem>
                ))}
                <SelectItem value={OFF_DIRECTORY}>
                  Not in the directory — enter a name
                </SelectItem>
              </SelectContent>
            </Select>
            {orgs.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                No directory listings in this category yet.
              </p>
            )}
          </div>

          {choice === OFF_DIRECTORY ? (
            <div className="space-y-1">
              <Label htmlFor="ref-provider">Organization name</Label>
              <Input
                id="ref-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="Who are you referring to?"
              />
              <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                <ExternalLink className="h-3 w-3 mt-0.5" />
                Recorded as an external referral. It is not added to the community directory —
                that stays with content administration.
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <Building2 className="h-3 w-3 mt-0.5" />
              Linked to the directory listing, so this referral shows whether the organization is
              still published.
            </p>
          )}

          <div className="space-y-1">
            <Label htmlFor="ref-note">
              Note {choice === OFF_DIRECTORY ? "(required)" : "(optional)"}
            </Label>
            <Textarea
              id="ref-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {isPart2SensitiveCategory(category) && (
            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <Lock className="h-3 w-3 mt-0.5 text-teal" />
              This category discloses SUD treatment status. It needs the patient&apos;s 42 CFR
              Part 2 consent on file.
            </p>
          )}
          {staffOnlyNeed && (
            <p className="text-[11px] text-muted-foreground">
              <Badge variant="outline" className="mr-1.5 text-[10px]">
                Staff only
              </Badge>
              This need is not shown to the patient or their advocate, so this referral will be
              staff-only too.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>Create referral</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
