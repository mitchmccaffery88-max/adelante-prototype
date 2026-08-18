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
import { CONTENT_TYPES, contentType } from "@/lib/contentTypes";
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
      ? retireContent({ typeId: entry.typeId, id: entry.id, actor, note })
      : discardContentDraft({ typeId: entry.typeId, id: entry.id, actor, note });
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
    const res = saveContentDraft({
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
    const saved = saveContentDraft({
      typeId,
      id: openId,
      body,
      actor,
      overridesBaseline: descriptor.baselineIds().includes(openId),
    });
    if (!saved.ok) return toast.error(saved.reason);
    const res = submitContentForReview({
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
    const saved = saveContentDraft({
      typeId,
      id: openId,
      body,
      actor,
      overridesBaseline: descriptor.baselineIds().includes(openId),
    });
    if (!saved.ok) return toast.error(saved.reason);
    const res = publishContent({ typeId, id: openId, actor, validate: descriptor.validate });
    if (!res.ok) return toast.error(res.reason);
    toast.success("Published — patients can see this now.");
    setOpenId(null);
    setBody(null);
  };

  const errors = body ? descriptor.validate(body) : [];
  const entry = openId ? getContentEntry(typeId, openId) : undefined;

  return (
    <div className="space-y-4">
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
      {mayPublish && (
        <p className="text-xs text-muted-foreground">
          Your role may publish directly — no second approver is required for this content.
        </p>
      )}
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
                <p className="font-mono text-xs text-muted-foreground">{openId}</p>
              </div>
              {entry && <StatusBadge entry={entry} />}
            </div>
            {entry?.returnedNote && (
              <p className="rounded-lg border border-gold/40 bg-gold/10 p-2 text-xs text-gold-foreground">
                Sent back for changes: {entry.returnedNote}
              </p>
            )}
            <ContentForm descriptor={descriptor} body={body} onChange={setBody} />
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
                Publish now
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
                    <p className="text-sm font-medium text-foreground">
                      {descriptor.titleOf(e.body)}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">{e.id}</p>
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
                  <span className="font-mono text-xs text-muted-foreground">{id}</span>
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
                <span className="text-sm font-medium text-foreground">{d.titleOf(e.body)}</span>
                <Badge variant="outline" className="text-[10px]">
                  {d.label}
                </Badge>
                <span className="font-mono text-[11px] text-muted-foreground">{e.id}</span>
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
                    const res = publishContent({
                      typeId: e.typeId,
                      id: e.id,
                      actor,
                      note: note.trim() || undefined,
                      validate: d.validate,
                    });
                    if (!res.ok) toast.error(res.reason);
                    else toast.success(`Published — patients can see "${d.titleOf(e.body)}" now.`);
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
                    const res = returnContentForChanges({
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
                <span className="text-sm font-medium text-foreground">{d.titleOf(e.body)}</span>
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

export function ContentAdminWorkspace() {
  const version = useContentStore();
  const queueCount = contentReviewQueue().length;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl text-navy">
          <FileEdit className="h-5 w-5 text-teal" /> Patient content management
        </h1>
        <p className="text-sm text-muted-foreground">
          Author and publish what patients see — Library lessons, Recovery-module lessons, community
          resources and naloxone access points — without a code deployment. Full revision history,
          and no second approver required.
        </p>
      </div>
      <Tabs defaultValue="manage">
        <TabsList>
          <TabsTrigger value="manage">Manage</TabsTrigger>
          <TabsTrigger value="review">Review queue{queueCount ? ` (${queueCount})` : ""}</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
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