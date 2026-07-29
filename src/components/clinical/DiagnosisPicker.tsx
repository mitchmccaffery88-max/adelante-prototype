import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Search } from "lucide-react";
import { searchIcd10, type Icd10Hit } from "@/lib/icd10Search";
import { searchConditions, type ConditionHit } from "@/lib/snomedSearch";

export interface DiagnosisPick {
  description: string;
  icd10Code?: string;
  snomedCode?: string;
  snomedDisplay?: string;
  category: "sud" | "mental_health" | "pregnancy" | "medical";
}

interface Props {
  onPick: (pick: DiagnosisPick) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

/**
 * Two-mode diagnosis search mirroring Dr. Bagga's DiagnosisPicker:
 *   - "By condition"  → NIH Clinical Tables conditions (SNOMED + ICD-10 xwalk)
 *   - "By ICD-10 code" → NIH Clinical Tables ICD-10-CM search
 * "42 CFR 2" badge on SUD-flagged rows, "MH" badge on mental-health rows.
 */
export function DiagnosisPicker({ onPick, placeholder, autoFocus }: Props) {
  const [mode, setMode] = useState<"condition" | "icd10">("condition");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conditionHits, setConditionHits] = useState<ConditionHit[]>([]);
  const [icdHits, setIcdHits] = useState<Icd10Hit[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const term = q.trim();
    if (term.length < 2) {
      setConditionHits([]);
      setIcdHits([]);
      setError(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    const t = setTimeout(async () => {
      try {
        if (mode === "condition") {
          const hits = await searchConditions(term, { signal: controller.signal, maxList: 15 });
          if (!controller.signal.aborted) setConditionHits(hits);
        } else {
          const hits = await searchIcd10(term, { signal: controller.signal, maxList: 15 });
          if (!controller.signal.aborted) setIcdHits(hits);
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "Search failed.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [q, mode]);

  return (
    <div className="space-y-2">
      <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
        <TabsList className="grid grid-cols-2 h-8">
          <TabsTrigger value="condition" className="text-xs">By condition</TabsTrigger>
          <TabsTrigger value="icd10" className="text-xs">By ICD-10 code</TabsTrigger>
        </TabsList>
        <div className="relative mt-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            autoFocus={autoFocus}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              placeholder ??
              (mode === "condition"
                ? "e.g. depression, hypertension, opioid use"
                : "e.g. F32.9, F11.20, O80")
            }
            className="pl-7 text-sm"
          />
          {loading && (
            <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>
        <TabsContent value="condition" className="mt-2">
          <ResultList
            empty={q.trim().length < 2 ? "Type at least 2 characters." : "No matches."}
            error={error}
            rows={conditionHits.map((h) => ({
              key: h.snomedCode + "-" + (h.primaryIcd10 ?? ""),
              title: h.primaryName,
              subtitle: [
                h.consumerName && h.consumerName !== h.primaryName ? h.consumerName : null,
                h.primaryIcd10 ? `ICD-10 ${h.primaryIcd10}` : null,
                `SNOMED ${h.snomedCode}`,
              ]
                .filter(Boolean)
                .join(" · "),
              isSud: h.isSud,
              isMh: h.isMentalHealth,
              isPregnancy: h.isPregnancy,
              onPick: () =>
                onPick({
                  description: h.primaryName,
                  icd10Code: h.primaryIcd10,
                  snomedCode: h.snomedCode,
                  snomedDisplay: h.primaryName,
                  category: h.category,
                }),
            }))}
          />
        </TabsContent>
        <TabsContent value="icd10" className="mt-2">
          <ResultList
            empty={q.trim().length < 2 ? "Type at least 2 characters." : "No matches."}
            error={error}
            rows={icdHits.map((h) => ({
              key: h.code,
              title: `${h.code} — ${h.name}`,
              subtitle: undefined,
              isSud: h.isSud,
              isMh: h.isMentalHealth,
              isPregnancy: h.isPregnancy,
              onPick: () =>
                onPick({
                  description: h.name,
                  icd10Code: h.code,
                  category: h.category,
                }),
            }))}
          />
        </TabsContent>
      </Tabs>
      <p className="text-[10px] text-muted-foreground">
        Live data · NIH NLM Clinical Tables. No local suppression catalog yet.
      </p>
    </div>
  );
}

interface Row {
  key: string;
  title: string;
  subtitle?: string;
  isSud: boolean;
  isMh: boolean;
  isPregnancy: boolean;
  onPick: () => void;
}

function ResultList({
  rows,
  empty,
  error,
}: {
  rows: Row[];
  empty: string;
  error?: string | null;
}) {
  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
        {error}
      </div>
    );
  }
  if (rows.length === 0) {
    return <div className="text-xs text-muted-foreground p-2">{empty}</div>;
  }
  return (
    <ul className="max-h-64 overflow-y-auto divide-y rounded-md border">
      {rows.map((r) => (
        <li key={r.key}>
          <button
            type="button"
            onClick={r.onPick}
            className="w-full text-left px-3 py-2 hover:bg-secondary/40 focus:outline-none focus-visible:bg-secondary/50"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm text-navy">{r.title}</span>
              {r.isSud && (
                <Badge className="bg-destructive/15 text-destructive border-0 text-[10px]">
                  42 CFR 2
                </Badge>
              )}
              {r.isMh && !r.isSud && (
                <Badge className="bg-teal/20 text-teal border-0 text-[10px]">MH</Badge>
              )}
              {r.isPregnancy && (
                <Badge className="bg-gold/30 text-navy border-0 text-[10px]">Pregnancy</Badge>
              )}
            </div>
            {r.subtitle && (
              <div className="text-[11px] text-muted-foreground mt-0.5">{r.subtitle}</div>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}