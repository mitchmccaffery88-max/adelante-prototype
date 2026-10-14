// §Content backup — "Download my changes" / "Load my changes". English only
// (staff screen). Both actions go through runAction (one audit event each).
import { useEffect, useRef, useState } from "react";
import { CircleAlert, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { runAction } from "@/lib/actions/runAction";
import { useActingStaff } from "@/lib/roles";
import { canAuthorContent, contentChangesSince } from "@/lib/contentPublishing";
import {
  contentBackupFileName,
  planContentRestore,
  type ContentBackupFile,
  type RestorePlan,
  type RestoreResult,
} from "@/lib/contentBackup";

const LAST_KEY = "adelante.contentLastDownloadedAt";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function ContentBackupBar({ version }: { version: number }) {
  const { role, staffId, staffName } = useActingStaff();
  const actor = { staffId: staffId ?? undefined, name: staffName, role };
  const [last, setLast] = useState<string | null>(null);
  const [plan, setPlan] = useState<Extract<RestorePlan, { ok: true }> | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { setLast(sessionStorage.getItem(LAST_KEY)); }, []);
  const changes = contentChangesSince(last);
  void version;

  useEffect(() => {
    if (changes <= 0) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [changes]);

  if (!canAuthorContent(role)) return null;

  const download = () => {
    const r = runAction<ContentBackupFile>("content_export", { role, staffId: actor.staffId, staffName }, undefined, { args: [{ actor }] });
    if (!r.ok) { toast(r.reason, { icon: <CircleAlert className="h-4 w-4 text-attention" /> }); return; }
    downloadBlob(new Blob([JSON.stringify(r.value, null, 2)], { type: "application/json" }), contentBackupFileName());
    sessionStorage.setItem(LAST_KEY, r.value.exportedAt);
    setLast(r.value.exportedAt);
    toast(`Downloaded ${r.value.entries.length} content entries.`);
  };

  const pick = async (f: File | undefined) => {
    setError(null);
    if (!f) return;
    const text = await f.text();
    const p = planContentRestore(text, actor);
    if (input.current) input.current.value = "";
    if (!p.ok) { setError(p.error); return; }
    setFileText(text);
    setPlan(p);
  };

  const apply = () => {
    if (!fileText) return;
    const r = runAction<RestoreResult>("content_restore", { role, staffId: actor.staffId, staffName }, undefined, { args: [{ file: fileText, actor }] });
    setPlan(null);
    setFileText(null);
    if (!r.ok) { setError(r.reason); return; }
    const c = (r.value as Extract<RestoreResult, { ok: true }>).plan.counts;
    toast(`Loaded ${c.new + c.updated} changes.`);
  };

  const applyCount = plan ? plan.counts.new + plan.counts.updated + plan.verifications : 0;
  const lastLabel = last
    ? `Last downloaded ${new Date(last).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · ${changes} change${changes === 1 ? "" : "s"} since`
    : "Not downloaded yet";

  return (
    <div className="space-y-1" lang="en" data-testid="content-backup-bar">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={download}>
          <Download className="h-4 w-4" /> Download my changes
        </Button>
        <Button type="button" variant="outline" onClick={() => input.current?.click()}>
          <Upload className="h-4 w-4" /> Load my changes
        </Button>
        <input ref={input} type="file" accept="application/json,.json" className="hidden" aria-label="Choose a content file" onChange={(e) => void pick(e.target.files?.[0])} />
        <span className="text-sm text-muted-foreground" data-testid="content-backup-status">{lastLabel}</span>
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-attention">
          <CircleAlert className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      <Dialog open={!!plan} onOpenChange={(o) => { if (!o) { setPlan(null); setFileText(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Load my changes</DialogTitle>
            <DialogDescription>Nothing changes until you choose Load.</DialogDescription>
          </DialogHeader>
          {plan && (
            <div className="space-y-3 text-sm">
              <ul className="grid grid-cols-2 gap-2" data-testid="restore-counts">
                <li>{plan.counts.new} new</li>
                <li>{plan.counts.updated} updated</li>
                <li>{plan.counts.unchanged} unchanged</li>
                <li>{plan.counts.skipped} skipped</li>
              </ul>
              {plan.verifications > 0 && <p>{plan.verifications} resource verification{plan.verifications === 1 ? "" : "s"} to restore.</p>}
              {plan.counts.skipped > 0 && (
                <ul className="max-h-48 space-y-1 overflow-auto" data-testid="restore-skips">
                  {plan.items.filter((i) => i.outcome === "skipped").map((i) => (
                    <li key={`${i.typeId}::${i.id}`} className="flex items-start gap-1 text-attention">
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <span><span className="font-mono">{i.id || "(no id)"}</span> — {i.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => { setPlan(null); setFileText(null); }}>Not now</Button>
            <Button type="button" onClick={apply} disabled={applyCount === 0}>Load {applyCount} change{applyCount === 1 ? "" : "s"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
