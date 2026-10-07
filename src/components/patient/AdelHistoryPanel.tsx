// Messages → Adel: the patient's OWN saved Adel chats. Continue, share a
// summary with the care team, delete one, or clear all (each confirmed).
import { useState, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { MessageSquare, Share2, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";
import {
  ADEL_HISTORY_COPY, ADEL_HISTORY_ES_DRAFT_LABEL, ADEL_RETENTION_DRAFT_LABEL,
  clearAdelHistory, deleteAdelThread, listAdelThreads, shareAdelThread, subscribeAdelHistory,
} from "@/lib/adelHistory";

let version = 0;
const subscribe = (fn: () => void) => subscribeAdelHistory(() => { version++; fn(); });

type Pending = { kind: "share" | "delete"; id: string } | { kind: "clear" } | null;

export function AdelHistoryPanel({ patientId }: { patientId: string }) {
  const { lang } = useI18n();
  const l = lang === "es" ? "es" : "en";
  const c = ADEL_HISTORY_COPY[l];
  useSyncExternalStore(subscribe, () => version, () => 0);
  const owner = { kind: "patient", patientId } as const;
  const threads = listAdelThreads(owner);
  const [pending, setPending] = useState<Pending>(null);
  const latest = threads[0];

  function confirm() {
    if (!pending) return;
    if (pending.kind === "share") {
      const r = shareAdelThread(patientId, pending.id);
      r.ok ? toast.success(c.shared) : toast.error(r.reason);
    } else if (pending.kind === "delete") {
      deleteAdelThread(owner, pending.id);
      toast.success(c.deleted);
    } else {
      clearAdelHistory(owner);
      toast.success(c.deleted);
    }
    setPending(null);
  }

  return (
    <Card className="space-y-4 p-5" data-testid="adel-history">
      <div className="space-y-1">
        <h2 className="font-display text-xl text-foreground">{c.heading}</h2>
        <p className="text-sm text-muted-foreground" data-testid="adel-history-privacy">{c.privacy}</p>
        <p className="text-xs text-muted-foreground">{c.retention} <span className="italic">({ADEL_RETENTION_DRAFT_LABEL})</span></p>
        {l === "es" && <p className="text-[11px] italic text-muted-foreground">{ADEL_HISTORY_ES_DRAFT_LABEL}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        {latest && (
          <Button asChild className="min-h-11 rounded-2xl" data-testid="adel-continue">
            <Link to="/adel" search={{ thread: latest.id }}>
              <MessageSquare className="mr-1.5 h-4 w-4" aria-hidden="true" /> {c.continueLatest}: {latest.title[l]}
            </Link>
          </Button>
        )}
        <Button asChild variant="outline" className="min-h-11 rounded-2xl">
          <Link to="/adel">{c.newChat}</Link>
        </Button>
      </div>

      {threads.length === 0 ? (
        <p className="text-sm text-muted-foreground">{c.none}</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {threads.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-2" data-testid="adel-history-row">
              <Link to="/adel" search={{ thread: t.id }} className="min-w-0 flex-1 py-1">
                <span className="block truncate font-medium text-foreground">{t.title[l]}</span>
                <span className="block text-xs text-muted-foreground">
                  {new Date(t.updatedAt).toLocaleDateString(l === "es" ? "es-US" : "en-US", { month: "short", day: "numeric" })}
                </span>
              </Link>
              {t.sharedAt && <Badge variant="outline" className="text-[10px]">{c.sharedBadge}</Badge>}
              <Button size="sm" variant="ghost" className="h-10" onClick={() => setPending({ kind: "share", id: t.id })} aria-label={`${c.share}: ${t.title[l]}`} data-testid="adel-share">
                <Share2 className="h-4 w-4" aria-hidden="true" /><span className="ml-1 hidden sm:inline">{c.share}</span>
              </Button>
              <Button size="sm" variant="ghost" className="h-10 text-destructive" onClick={() => setPending({ kind: "delete", id: t.id })} aria-label={`${c.delete}: ${t.title[l]}`} data-testid="adel-delete">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {threads.length > 0 && (
        <Button variant="outline" className="min-h-11 rounded-2xl text-destructive" onClick={() => setPending({ kind: "clear" })} data-testid="adel-clear-all">
          {c.clearAll}
        </Button>
      )}

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.kind === "share" ? c.share : pending?.kind === "clear" ? c.clearAll : c.delete}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === "share" ? c.shareConfirm : pending?.kind === "clear" ? c.clearAllConfirm : c.deleteConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{c.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={confirm} data-testid="adel-confirm">{c.confirm}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
