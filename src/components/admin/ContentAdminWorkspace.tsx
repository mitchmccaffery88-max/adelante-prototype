// §Content Management admin tooling — the real admin surface.
//
// Three real jobs, one page, split the way the work actually splits:
//   Manage  — author or edit a lesson through its own structured schema,
//             preview it, submit it for review.
//   Review  — the generalized analogue of `ResourceVerificationQueue`: an
//             approver reads the preview and either publishes or sends it
//             back with a reason.
//   History — which revision patients are actually being served, and every
//             revision before it. No silent overwrites.
//
// RBAC is the existing matrix, not a new scheme: `content_authoring` write
// = may author; CONTENT_PUBLISHER_ROLES = may publish, and a publisher may
// publish their OWN work — general content needs no second approver. The
// review queue is still here, as an OPTIONAL second pair of eyes rather than a
// precondition. None of this touches the per-patient care-plan / cosign /
// order gates, which are a separate, unchanged clinical control.
import { runAction } from "@/lib/actions/runAction";
import type { ContentActor, ContentResult } from "@/lib/contentPublishing";

function contentAction(actionId: string, input: { actor: ContentActor; [key: string]: unknown }): ContentResult {
  if (!(typeof input.note === "string" && input.note.trim())) {
    const note = window.prompt("Reason for this content change:");
    if (!note?.trim()) return { ok: false, reason: "A reason is required." };
    input = { ...input, note: note.trim() };
  }
  const result = runAction<ContentResult>(actionId, { role: input.actor.role, staffId: input.actor.staffId, staffName: input.actor.name }, undefined, { args: [input] });
  return result.ok ? result.value : { ok: false, reason: result.reason };
}

import { useMemo, useState, useSyncExternalStore } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { FileEdit, ShieldCheck, History } from "lucide-react";
import { useActingStaff } from "@/lib/roles";
import { ClientDate } from "@/components/ClientDate";
import { ContentForm } from "./ContentForm";
import { ContentPreview } from "./ContentPreview";
import { ResourceVerificationQueue } from "./ResourceVerificationQueue";
import { CONTENT_TYPES, contentType, type ContentTypeDescriptor } from "@/lib/contentTypes";
// §C0 Seed load order: the authored lesson seeds and the tag registrations
// load through the catalog, so a fresh /admin-content load sees them.
import "@/lib/contentCatalog";
import "@/lib/contentTags";
import { contentCoverage } from "@/lib/contentTags";
import {
  GOVERNANCE_DRAFT_LABEL,
  READING_LEVEL_TARGET,
  SCREENER_BANDS,
  SPANISH_REQUIRED_TYPES,
  bodyReadingGrade,
  isPart2Content,
  metaOf,
  needsClinicalSignOff,
  part2Suggested,
  spanishStatusOf,
  type ContentMeta,
} from "@/lib/contentGovernance";
import { RESOURCE_CATEGORIES } from "@/lib/communityResources";
import {
  canAuthorContent,
  canPublishContent,
  contentRemovalBlockReason,
  contentReviewQueue,
  contentStoreVersion,
  discardContentDraft,
  getContentEntry,
  hasUnpublishedChanges,
  isContentLive,
  listContent,
  publishContent,
  retireContent,
  returnContentForChanges,
  saveContentDraft,
  submitContentForReview,
  subscribeContent,
  type ContentBody,
  type ContentEntry,
  type ContentTypeId,
} from "@/lib/contentPublishing";

function useContentStore(): number {
  return useSyncExternalStore(subscribeContent, contentStoreVersion, () => 0);
}

/** §C0 Titles everywhere, never raw ids. */
function displayTitle(d: ContentTypeDescriptor, id: string, body?: ContentBody): string {
  const t = body ? d.titleOf(body) : "";
  if (t && !t.startsWith("(")) return t;
  const base = d.baselineBody(id);
  const bt = base ? d.titleOf(base) : "";
  if (bt && !bt.startsWith("(")) return bt;
  return t || "Untitled";
}

function GovernanceChips({ typeId, body }: { typeId: ContentTypeId; body: ContentBody }) {
  const m = metaOf(body);
  const es = spanishStatusOf(body);
  return (
    <span className="flex flex-wrap gap-1">
      {isPart2Content(typeId, body) && (
        <Badge variant="outline" className="text-[10px]">Part 2</Badge>
      )}
      {m.clinical && <Badge variant="outline" className="text-[10px]">Clinical</Badge>}
      {SPANISH_REQUIRED_TYPES.has(typeId) && (
        <Badge variant="outline" className="text-[10px]" data-testid="es-chip">
          ES {es}
        </Badge>
      )}
    </span>
  );
}

const STAGE_LABELS: Record<string, string> = {
  pre_release: "Pre-release",
  first_30: "First 30 days",
  days_30_90: "30–90 days",
  after_90: "After 90 days",
};

/** §C3 "What this addresses" — Draft field set, stored on the body as `meta`. */
function MetaPanel({
  typeId,
  body,
  onChange,
}: {
  typeId: ContentTypeId;
  body: ContentBody;
  onChange: (b: ContentBody) => void;
}) {
  const m = metaOf(body);
  const set = (patch: Partial<ContentMeta>) => onChange({ ...body, meta: { ...m, ...patch, backfilled: false } });
  const toggle = <T,>(list: T[] | undefined, v: T): T[] =>
    (list ?? []).includes(v) ? (list ?? []).filter((x) => x !== v) : [...(list ?? []), v];
  const chip = (on: boolean, label: string, onClick: () => void, testId?: string) => (
    <button
      type="button"
      key={label}
      onClick={onClick}
      data-testid={testId}
      aria-pressed={on}
      className={`rounded-full border px-2 py-0.5 text-[11px] ${on ? "border-teal bg-teal/15 text-teal" : "border-border text-muted-foreground"}`}
    >
      {label}
    </button>
  );
  const grade = bodyReadingGrade(body);
  const suggested = part2Suggested(typeId, body);
  const es = (body["es"] as { title?: string; body?: string } | undefined) ?? {};
  return (
    <div className="space-y-3 rounded-lg border border-border p-3" data-testid="meta-panel">
      <p className="text-xs font-medium uppercase tracking-wider text-teal">What this addresses</p>
      <p className="text-[11px] text-muted-foreground">{GOVERNANCE_DRAFT_LABEL}</p>
      <div className="space-y-1">
        <Label className="text-xs">Needs</Label>
        <div className="flex flex-wrap gap-1">
          {RESOURCE_CATEGORIES.map((c) =>
            chip((m.sdoh ?? []).includes(c.id), c.name, () => set({ sdoh: toggle(m.sdoh, c.id) }), `tag-sdoh-${c.id}`),
          )}
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Screener bands</Label>
        <div className="flex flex-wrap gap-1">
          {SCREENER_BANDS.map((b) => chip((m.bands ?? []).includes(b), b.replace(">=", " ≥ ").toUpperCase(), () => set({ bands: toggle(m.bands, b) })))}
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">ASAM dimensions</Label>
        <div className="flex flex-wrap gap-1">
          {[1, 2, 3, 4, 5, 6].map((d) => chip((m.asam ?? []).includes(d), `D${d}`, () => set({ asam: toggle(m.asam, d) })))}
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Reentry stage</Label>
        <div className="flex flex-wrap gap-1">
          {(["pre_release", "first_30", "days_30_90", "after_90"] as const).map((st) =>
            chip((m.stages ?? []).includes(st), STAGE_LABELS[st]!, () => set({ stages: toggle(m.stages, st) }), `tag-stage-${st}`),
          )}
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Population</Label>
        <div className="flex flex-wrap gap-1">
          {(["justice_involved", "general", "advocate"] as const).map((pp) =>
            chip((m.populations ?? []).includes(pp), pp.replace("_", "-"), () => set({ populations: toggle(m.populations, pp) })),
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {chip(isPart2Content(typeId, body), suggested ? "Part 2-sensitive (suggested)" : "Part 2-sensitive", () => set({ part2: !m.part2 }), "tag-part2")}
        {chip(m.clinical === true, "Clinical content", () => set({ clinical: !m.clinical }), "tag-clinical")}
      </div>
      {needsClinicalSignOff(typeId, body) && (
        <p className="text-[11px] text-gold-foreground" data-testid="needs-clinical-review">
          Needs approval from a clinical reviewer who isn&apos;t the author (PMHNP, physician or clinical coordinator).
        </p>
      )}
      {SPANISH_REQUIRED_TYPES.has(typeId) && (
        <div className="space-y-1">
          <Label className="text-xs">Spanish title</Label>
          <Input
            value={es.title ?? ""}
            data-testid="es-title"
            onChange={(e) => onChange({ ...body, es: { ...es, title: e.target.value }, meta: { ...m, esStatus: e.target.value ? (m.esStatus === "reviewed" ? "reviewed" : "draft") : "missing" } })}
          />
          <Label className="text-xs">Spanish text</Label>
          <Textarea
            rows={2}
            value={es.body ?? ""}
            data-testid="es-body"
            onChange={(e) => onChange({ ...body, es: { ...es, body: e.target.value } })}
          />
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            Spanish status: <strong>{spanishStatusOf(body)}</strong>
            {spanishStatusOf(body) === "draft" && (
              <Button type="button" size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => set({ esStatus: "reviewed" })}>
                Mark Spanish reviewed
              </Button>
            )}
          </div>
          {spanishStatusOf(body) === "missing" && (
            <Input
              placeholder="Reason to publish without Spanish (Spanish users see “Spanish coming soon”)"
              value={m.spanishOverrideReason ?? ""}
              onChange={(e) => set({ spanishOverrideReason: e.target.value })}
            />
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Owner</Label>
          <Input value={m.owner ?? ""} onChange={(e) => set({ owner: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Next review</Label>
          <Input type="date" value={m.nextReview ?? ""} onChange={(e) => set({ nextReview: e.target.value })} />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground" data-testid="reading-level">
        Reading level ≈ grade {grade} (Draft target: grade {READING_LEVEL_TARGET} for patient text)
      </p>
    </div>
  );
}

function StatusBadge({ entry }: { entry: ContentEntry }) {
  const live = isContentLive(entry);
  return (
    <div className="flex flex-wrap gap-1.5">
      {live ? (
        <Badge className="border-0 bg-teal/15 text-[10px] text-teal">
          Live · rev {entry.publishedRev}
        </Badge>
      ) : (
        <Badge variant="outline" className="text-[10px]">
          Not visible to patients
        </Badge>
      )}
      {entry.status === "pending_review" && (
        <Badge className="border-0 bg-gold/20 text-[10px] text-gold-foreground">In review</Badge>
      )}
      {entry.status === "draft" && live && hasUnpublishedChanges(entry) && (
        <Badge variant="outline" className="text-[10px]">
          Unpublished edits
        </Badge>
      )}
    </div>
  );
}

/**
 * §Referential integrity, at the surface. The button is disabled with the
 * store's OWN reason string — and the store re-checks on click, so this is a
 * readout of a real guard rather than the guard itself.
 */
function RemoveControl({
  entry,
  actor,
  mayAuthor,
  mayPublish,
}: {
  entry: ContentEntry;
  actor: { staffId?: string; name: string; role: ReturnType<typeof useActingStaff>["role"] };
  mayAuthor: boolean;
  mayPublish: boolean;
}) {
  const live = isContentLive(entry);
  const blocked = contentRemovalBlockReason(entry.typeId, entry.id);
  const label = live ? "Withdraw" : "Discard draft";
  const allowed = live ? mayPublish : mayAuthor;
  const run = () => {
    const note = window.prompt(
      live
        ? "Why is this being withdrawn from patients?"
        : "Why is this draft being discarded?",
    );
    if (!note?.trim()) return;
    const res = live
      ? contentAction("content_withdraw", { typeId: entry.typeId, id: entry.id, actor, note })
      : contentAction("content_discard", { typeId: entry.typeId, id: entry.id, actor, note });
    if (!res.ok) toast.error(res.reason);
    else
      toast.success(
        live
          ? "Withdrawn. Patients no longer see this; its history is kept."
          : "Draft discarded.",
      );
  };
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="text-destructive"
      title={blocked ?? undefined}
      disabled={!allowed || !!blocked || entry.status === "pending_review"}
      onClick={run}
      data-testid={`remove-${entry.id}`}
    >
      {label}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Manage / author
// ---------------------------------------------------------------------------

const CONTENT_GROUPS: { label: string; types: ContentTypeId[] }[] = [
  { label: "Education", types: ["library_lesson", "library_category"] },
  { label: "Recovery", types: ["recovery_lesson", "recovery_module"] },
  { label: "Directory", types: ["community_resource", "naloxone_access_point"] },
];

function ManageTab({ version }: { version: number }) {
  const { role, staffId, staffName } = useActingStaff();
  const mayAuthor = canAuthorContent(role);
  const mayPublish = canPublishContent(role);
  const [typeId, setTypeId] = useState<ContentTypeId>("library_lesson");
  const descriptor = contentType(typeId);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newId, setNewId] = useState("");
  const [body, setBody] = useState<ContentBody | null>(null);
  const [submitNote, setSubmitNote] = useState("");

  const managed = useMemo(() => listContent(typeId), [typeId, version]);
  const baselineOnly = useMemo(
    () => descriptor.baselineIds().filter((id) => !getContentEntry(typeId, id)),
    [descriptor, typeId, version],
  );

  const actor = { staffId: staffId ?? undefined, name: staffName, role };

  const open = (id: string, initial: ContentBody) => {
    setOpenId(id);
    setBody(initial);
    setSubmitNote("");
  };

  const openManaged = (id: string) => {
    const e = getContentEntry(typeId, id);
    if (e) open(id, e.body);
  };

  const openBaseline = (id: string) => {
    const b = descriptor.baselineBody(id);
    if (b) open(id, b);
  };

  const startNew = () => {
    const id = newId.trim();
    if (!id) return toast.error("Give the new entry an id first.");
    if (getContentEntry(typeId, id) || descriptor.baselineIds().includes(id))
      return toast.error("That id is already taken.");
    open(id, { ...descriptor.emptyBody(), id });
  };

  const save = () => {
    if (!openId || !body) return;
    const res = contentAction(getContentEntry(typeId, openId) ? "content_edit" : "content_create", {
      typeId,
      id: openId,
      body,
      actor,
      overridesBaseline: descriptor.baselineIds().includes(openId),
      validate: descriptor.validate,
    });
    if (!res.ok) toast.error(res.reason);
    else toast.success("Draft saved. Patients still see the published version, if any.");
  };

  const submit = () => {
    if (!openId || !body) return;
    const saved = contentAction(getContentEntry(typeId, openId) ? "content_edit" : "content_create", {
      typeId,
      id: openId,
      body,
      actor,
      overridesBaseline: descriptor.baselineIds().includes(openId),
    });
    if (!saved.ok) return toast.error(saved.reason);
    const res = contentAction("content_submit", {
      typeId,
      id: openId,
      actor,
      note: submitNote.trim() || undefined,
      validate: descriptor.validate,
    });
    if (!res.ok) return toast.error(res.reason);
    toast.success("Sent for a second look. It stays invisible to patients until published.");
    setOpenId(null);
    setBody(null);
  };

  /**
   * Direct publish — no second approver. The store still validates and still
   * checks the role; it just no longer demands a different person.
   */
  const publish = () => {
    if (!openId || !body) return;
    const saved = contentAction(getContentEntry(typeId, openId) ? "content_edit" : "content_create", {
      typeId,
      id: openId,
      body,
      actor,
      overridesBaseline: descriptor.baselineIds().includes(openId),
    });
    if (!saved.ok) return toast.error(saved.reason);
    if (needsClinicalSignOff(typeId, body)) {
      const sub = contentAction("content_submit", { typeId, id: openId, actor, validate: descriptor.validate, note: submitNote.trim() || undefined });
      if (!sub.ok) return toast.error(sub.reason);
      toast.success("Sent to clinical review — a clinical reviewer who isn't the author approves it.");
      setOpenId(null);
      setBody(null);
      return;
    }
    const res = contentAction("content_publish", { typeId, id: openId, actor, validate: descriptor.validate });
    if (!res.ok) return toast.error(res.reason);
    toast.success("Published — patients can see this now.");
    setOpenId(null);
    setBody(null);
  };

  const errors = body ? descriptor.validate(body) : [];
  const entry = openId ? getContentEntry(typeId, openId) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" data-testid="content-groups">
        {CONTENT_GROUPS.map((g) => (
          <Button
            key={g.label}
            type="button"
            size="sm"
            variant={g.types.includes(typeId) ? "default" : "outline"}
            onClick={() => {
              setTypeId(g.types[0]!);
              setOpenId(null);
              setBody(null);
            }}
          >
            {g.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Content type</Label>
          <Select
            value={typeId}
            onValueChange={(v) => {
              setTypeId(v as ContentTypeId);
              setOpenId(null);
              setBody(null);
            }}
          >
            <SelectTrigger className="w-64" data-testid="content-type-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTENT_TYPES.map((t) => (
                <SelectItem key={t.typeId} value={t.typeId}>
                  {t.labelPlural}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">New entry id</Label>
          <div className="flex gap-2">
            <Input
              className="w-56"
              placeholder="e.g. lib_sleep_reset / res_housing_x"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              data-testid="new-content-id"
            />
            <Button type="button" onClick={startNew} disabled={!mayAuthor}>
              New entry
            </Button>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{descriptor.publishEffect}</p>
      <p className="text-xs text-muted-foreground">
        Editorial content publishes immediately. Clinical or Part 2 content goes to a clinical
        reviewer who isn&apos;t the author. Lessons need Spanish, or a recorded reason.
      </p>
      {!mayAuthor && (
        <p className="text-xs text-destructive">
          Your role can read this workspace but cannot author or submit content.
        </p>
      )}

      {openId && body ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-teal">
                  Editing {descriptor.label}
                </p>
                <p className="text-xs text-muted-foreground">{displayTitle(descriptor, openId, body)}</p>
              </div>
              {entry && <StatusBadge entry={entry} />}
            </div>
            {entry?.returnedNote && (
              <p className="rounded-lg border border-gold/40 bg-gold/10 p-2 text-xs text-gold-foreground">
                Sent back for changes: {entry.returnedNote}
              </p>
            )}
            <ContentForm descriptor={descriptor} body={body} onChange={setBody} />
            {typeId !== "community_resource" && typeId !== "naloxone_access_point" && (
              <MetaPanel typeId={typeId} body={body} onChange={setBody} />
            )}
            {errors.length > 0 && (
              <ul className="space-y-1 text-xs text-destructive">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Note (optional)</Label>
              <Textarea
                rows={2}
                value={submitNote}
                onChange={(e) => setSubmitNote(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={save} disabled={!mayAuthor}>
                Save draft
              </Button>
              <Button
                type="button"
                onClick={publish}
                disabled={!mayPublish || errors.length > 0}
                data-testid="publish-now"
              >
                {needsClinicalSignOff(typeId, body) ? "Send to clinical review" : "Publish now"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={submit}
                disabled={!mayAuthor || errors.length > 0}
                data-testid="submit-for-review"
              >
                Send for a second look
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setOpenId(null);
                  setBody(null);
                }}
              >
                Close
              </Button>
            </div>
          </Card>
          <ContentPreview descriptor={descriptor} body={body} />
        </div>
      ) : typeId === "community_resource" ? (
        <ResourceVerificationQueue onEdit={(id) => {
          const existing = getContentEntry("community_resource", id);
          if (existing) open(id, existing.body);
          else openBaseline(id);
        }} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-teal">
              Managed {descriptor.labelPlural.toLowerCase()}
            </p>
            <ul className="mt-3 space-y-2">
              {managed.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground" data-testid="managed-title">
                      {displayTitle(descriptor, e.id, e.body)}
                    </p>
                    <GovernanceChips typeId={e.typeId} body={e.body} />
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge entry={e} />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openManaged(e.id)}
                      disabled={e.status === "pending_review"}
                    >
                      Edit
                    </Button>
                    <RemoveControl
                      entry={e}
                      actor={actor}
                      mayAuthor={mayAuthor}
                      mayPublish={mayPublish}
                    />
                  </div>
                </li>
              ))}
              {managed.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  Nothing under admin management yet.
                </li>
              )}
            </ul>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-teal">
              Shipped in code — bring under management to edit
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              These are still served from the shipped baseline. Editing one creates a managed draft;
              patients keep seeing the shipped version until you publish the edit.
            </p>
            <ul className="mt-3 space-y-1.5">
              {baselineOnly.map((id) => (
                <li key={id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-sm text-foreground">{displayTitle(descriptor, id)}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => openBaseline(id)}
                    disabled={!mayAuthor}
                  >
                    Edit
                  </Button>
                </li>
              ))}
              {baselineOnly.length === 0 && (
                <li className="text-sm text-muted-foreground">All shipped lessons are managed.</li>
              )}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review queue — the generalized ResourceVerificationQueue
// ---------------------------------------------------------------------------

function ReviewTab({ version }: { version: number }) {
  const { role, staffId, staffName } = useActingStaff();
  const mayPublish = canPublishContent(role);
  const queue = useMemo(() => contentReviewQueue(), [version]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const actor = { staffId: staffId ?? undefined, name: staffName, role };

  return (
    <Card className="p-5" data-testid="content-review-queue">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
        <ShieldCheck className="h-4 w-4" /> Content review queue
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        An OPTIONAL second pair of eyes — content does not have to pass through here to go live.
        Nothing in this queue is visible to patients until it is published.
        {!mayPublish && " Your role can read this queue but cannot publish."}
      </p>
      <ul className="mt-4 space-y-4">
        {queue.map((e) => {
          const d = contentType(e.typeId);
          const submitted = [...e.revisions].reverse().find((r) => r.action === "submitted");
          const noteKey = `${e.typeId}::${e.id}`;
          const note = notes[noteKey] ?? "";
          return (
            <li key={noteKey} className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">{displayTitle(d, e.id, e.body)}</span>
                <Badge variant="outline" className="text-[10px]">
                  {d.label}
                </Badge>
                <GovernanceChips typeId={e.typeId} body={e.body} />
              </div>
              {submitted && (
                <p className="text-xs text-muted-foreground">
                  Submitted by {submitted.by} ({submitted.byRole}) on{" "}
                  <ClientDate value={submitted.at} />
                  {submitted.note ? ` — "${submitted.note}"` : ""}
                </p>
              )}
              <ContentPreview descriptor={d} body={e.body} />
              <Textarea
                rows={2}
                placeholder="Reviewer note (required to send back)"
                value={note}
                onChange={(ev) => setNotes((p) => ({ ...p, [noteKey]: ev.target.value }))}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={!mayPublish}
                  data-testid={`approve-${e.id}`}
                  onClick={() => {
                    const res = contentAction("content_approve", {
                      typeId: e.typeId,
                      id: e.id,
                      actor,
                      note: note.trim() || undefined,
                      validate: d.validate,
                    });
                    if (!res.ok) toast.error(res.reason);
                    else toast.success(`Published — patients can see "${displayTitle(d, e.id, e.body)}" now.`);
                  }}
                >
                  Publish
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!mayPublish}
                  onClick={() => {
                    const res = contentAction("content_return", {
                      typeId: e.typeId,
                      id: e.id,
                      actor,
                      note,
                    });
                    if (!res.ok) toast.error(res.reason);
                    else toast.success("Sent back to the author.");
                  }}
                >
                  Send back for changes
                </Button>
              </div>
            </li>
          );
        })}
        {queue.length === 0 && (
          <li className="text-sm text-muted-foreground">Nothing is waiting for review.</li>
        )}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// History — which revision patients actually saw
// ---------------------------------------------------------------------------

function HistoryTab({ version }: { version: number }) {
  const all = useMemo(() => listContent(), [version]);
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
        <History className="h-4 w-4" /> Revision history
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Every revision is kept as a full snapshot, so the version a patient was served stays
        recoverable rather than being overwritten.
      </p>
      <ul className="mt-4 space-y-3">
        {all.map((e) => {
          const d = contentType(e.typeId);
          return (
            <li key={`${e.typeId}::${e.id}`} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">{displayTitle(d, e.id, e.body)}</span>
                <StatusBadge entry={e} />
              </div>
              <ol className="mt-2 space-y-1 text-xs text-muted-foreground">
                {[...e.revisions].reverse().map((r) => (
                  <li key={r.rev}>
                    <span className="font-mono">rev {r.rev}</span> · {r.action} · {r.by} ({r.byRole}
                    ) · <ClientDate value={r.at} />
                    {r.rev === e.publishedRev && (
                      <Badge className="ml-2 border-0 bg-teal/15 text-[10px] text-teal">
                        Served to patients
                      </Badge>
                    )}
                    {r.note ? ` — "${r.note}"` : ""}
                  </li>
                ))}
              </ol>
            </li>
          );
        })}
        {all.length === 0 && <li className="text-sm text-muted-foreground">No history yet.</li>}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// §C2 Home digest — the 10-second view
// ---------------------------------------------------------------------------
function HomeDigest({ version }: { version: number }) {
  const { role, staffId, staffName } = useActingStaff();
  const today = new Date().toISOString().slice(0, 10);
  const data = useMemo(() => {
    const all = listContent();
    const me = staffId ?? staffName;
    const awaiting = contentReviewQueue().filter((e) => {
      const author = [...e.revisions].reverse().find((r) => r.action === "created" || r.action === "edited");
      const authorKey = author ? (author.byStaffId ?? author.by) : undefined;
      return canPublishContent(role) && authorKey !== me;
    });
    const pastReview = all.filter((e) => {
      const n = metaOf(e.body).nextReview;
      return !!n && n < today;
    });
    const missingEs = all.filter(
      (e) => SPANISH_REQUIRED_TYPES.has(e.typeId) && isContentLive(e) && spanishStatusOf(e.publishedBody ?? e.body) === "missing",
    );
    const recent = all
      .filter((e) => e.publishedAt)
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
      .slice(0, 5);
    return { awaiting, pastReview, missingEs, recent, coverage: contentCoverage() };
  }, [version, role, staffId, staffName, today]);
  const tile = (label: string, n: number, testId: string) => (
    <Card className="p-4" data-testid={testId}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-2xl text-navy">{n}</p>
    </Card>
  );
  const c = data.coverage;
  return (
    <div className="space-y-4" data-testid="content-home">
      <div className="grid gap-3 sm:grid-cols-5">
        {tile("Awaiting my review", data.awaiting.length, "digest-awaiting")}
        {tile("Past review date", data.pastReview.length, "digest-past-review")}
        {tile("Live lessons missing Spanish", data.missingEs.length, "digest-missing-es")}
        {tile("Recently published", data.recent.length, "digest-recent")}
        {tile("Coverage gaps", c.gapCount, "digest-coverage")}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-teal">Recently published</p>
          <ul className="mt-2 space-y-1 text-sm">
            {data.recent.map((e) => (
              <li key={`${e.typeId}::${e.id}`}>
                {displayTitle(contentType(e.typeId), e.id, e.publishedBody ?? e.body)} ·{" "}
                <span className="text-xs text-muted-foreground">
                  {e.publishedBy} · <ClientDate value={e.publishedAt!} />
                </span>
              </li>
            ))}
            {data.recent.length === 0 && <li className="text-muted-foreground">Nothing yet.</li>}
          </ul>
        </Card>
        <Card className="p-5" data-testid="coverage-view">
          <p className="text-xs font-medium uppercase tracking-wider text-teal">Coverage gaps</p>
          <p className="text-[11px] text-muted-foreground">{GOVERNANCE_DRAFT_LABEL}</p>
          <ul className="mt-2 space-y-1 text-sm">
            <li>Needs with no lesson: {c.needsWithoutLesson.join(", ") || "none"}</li>
            <li>Needs with no verified resource: {c.needsWithoutResource.join(", ") || "none"}</li>
            <li>Screener bands with no lesson: {c.bandsWithoutLesson.join(", ") || "none"}</li>
            <li>Reentry stages with no lesson: {c.stagesWithoutLesson.map((x) => STAGE_LABELS[x] ?? x).join(", ") || "none"}</li>
            <li>Care plans pointing at retired or missing content: {c.plansPointingAtMissing.length}</li>
          </ul>
        </Card>
      </div>
      <Card className="p-5" data-testid="messages-placeholder">
        <p className="text-xs font-medium uppercase tracking-wider text-teal">Messages (read-only)</p>
        <p className="text-xs text-muted-foreground">
          Notification and text-message templates are still kept in code. Editing them here comes later.
        </p>
      </Card>
    </div>
  );
}

export function ContentAdminWorkspace() {
  const version = useContentStore();
  const queueCount = contentReviewQueue().length;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl text-navy">
          <FileEdit className="h-5 w-5 shrink-0 text-teal" /> Patient Content &amp; Resources Center
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage what patients see: education, recovery content, community resources and naloxone sites. Verify resources with the provider before they go live.
        </p>
      </div>
      <Tabs defaultValue="home">
        <TabsList>
          <TabsTrigger value="home">Home</TabsTrigger>
          <TabsTrigger value="manage">Manage</TabsTrigger>
          <TabsTrigger value="review">Review queue{queueCount ? ` (${queueCount})` : ""}</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="home" className="mt-4">
          <HomeDigest version={version} />
        </TabsContent>
        <TabsContent value="manage" className="mt-4">
          <ManageTab version={version} />
        </TabsContent>
        <TabsContent value="review" className="mt-4">
          <ReviewTab version={version} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <HistoryTab version={version} />
        </TabsContent>
      </Tabs>
    </div>
  );
}