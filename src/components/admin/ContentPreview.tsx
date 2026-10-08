import { RealContentPreview } from "./RealContentPreview";
// §Content Management admin tooling — PREVIEW BEFORE PUBLISH.
//
// Renders the working body in the patient's step order, using the type
// descriptor's own field list. It deliberately does NOT mount the real
// patient lesson renderer: that component writes engagement rows and marks
// completions against a patient id, and a preview must not do either.
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { descriptorFields, readField, type ContentTypeDescriptor } from "@/lib/contentTypes";
import type { ContentBody } from "@/lib/contentPublishing";

function ActivityPreview({ activity }: { activity: unknown }) {
  if (!activity || typeof activity !== "object") return null;
  const a = activity as Record<string, unknown>;
  const kind = typeof a["kind"] === "string" ? (a["kind"] as string) : "unknown";
  const options = ["items", "cards", "steps"]
    .map((k) => a[k])
    .find((v): v is string[] => Array.isArray(v)) as string[] | undefined;
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px]">
          {kind}
        </Badge>
        <span className="text-xs text-muted-foreground">Interactive activity</span>
      </div>
      {typeof a["title"] === "string" && a["title"] && (
        <p className="mt-2 text-sm font-medium text-navy">{a["title"] as string}</p>
      )}
      {typeof a["prompt"] === "string" && (
        <p className="text-sm text-muted-foreground">{a["prompt"] as string}</p>
      )}
      {Array.isArray(a["buckets"]) && (
        <p className="mt-1 text-xs text-muted-foreground">
          Buckets: {(a["buckets"] as string[]).filter(Boolean).join(" · ")}
        </p>
      )}
      {options && options.length > 0 && (
        <ul className="mt-2 space-y-1">
          {options.filter(Boolean).map((o, i) => (
            <li key={i} className="rounded border border-border bg-background px-2 py-1 text-sm">
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ContentPreview({ descriptor, body }: { descriptor: ContentTypeDescriptor; body: ContentBody }) {
  return <RealContentPreview typeId={descriptor.typeId} id={String(body.id ?? "preview")} body={body} />;
}
