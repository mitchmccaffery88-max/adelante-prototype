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

export function ContentPreview({
  descriptor,
  body,
}: {
  descriptor: ContentTypeDescriptor;
  body: ContentBody;
}) {
  // Lessons carry a numbered instructional sequence; a community resource or a
  // naloxone access point does not. Preview whichever shape this type is,
  // rather than pretending every managed type is a lesson.
  const allFields = descriptorFields(descriptor);
  const stepped = allFields.filter((f) => f.step);
  const shown = stepped.length > 0 ? stepped : allFields;
  const minutes = readField(body, "minutes");
  return (
    <Card className="space-y-4 p-5" data-testid="content-preview">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-teal">
          Preview — what a patient would see
        </p>
        <h3 className="font-display text-2xl text-navy">{descriptor.titleOf(body)}</h3>
        {typeof minutes === "number" && (
          <p className="text-xs text-muted-foreground">About {minutes} minutes</p>
        )}
      </div>
      {shown.map((f) => {
          const value = readField(body, f.key);
          if (f.kind === "activity") return <ActivityPreview key={f.key} activity={value} />;
          // §Phase D — optional structures. An unauthored one is skipped
          // entirely rather than shown as "— empty —" on every lesson.
          if (f.kind === "stages") {
            const stages = Array.isArray(value)
              ? (value as { title?: string; body?: string }[])
              : [];
            if (stages.length === 0) return null;
            return (
              <div key={f.key} className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {f.step ? `${f.step}. ` : ""}
                  {f.label}
                </p>
                {stages.map((s, n) => (
                  <div key={n} className="rounded-lg border border-border p-2">
                    <p className="text-sm font-medium text-navy">{s.title}</p>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{s.body}</p>
                  </div>
                ))}
              </div>
            );
          }
          if (f.kind === "toggle") {
            if (value !== true) return null;
            return (
              <p key={f.key} className="text-xs text-muted-foreground">
                {f.label}: yes
              </p>
            );
          }
          if (f.kind === "list") {
            const items = Array.isArray(value) ? (value as string[]) : [];
            return (
              <div key={f.key}>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {f.step ? `${f.step}. ` : ""}
                  {f.label}
                </p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {items.filter(Boolean).map((i, n) => (
                    <li key={n} className="rounded-full border border-border px-2 py-0.5 text-xs">
                      {i}
                    </li>
                  ))}
                  {items.length === 0 && (
                    <li className="text-xs text-muted-foreground">Nothing to choose from yet.</li>
                  )}
                </ul>
              </div>
            );
          }
          // A number field (order, minutes) is a real authored value; rendering
          // it as "empty" made a filled-in form look unsaved.
          const text =
            typeof value === "string"
              ? value
              : typeof value === "number"
                ? String(value)
                : "";
          return (
            <div key={f.key}>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {f.step ? `${f.step}. ` : ""}
                {f.label}
              </p>
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {text || <span className="text-muted-foreground">— empty —</span>}
              </p>
            </div>
          );
        })}
    </Card>
  );
}