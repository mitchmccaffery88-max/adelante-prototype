// §Orders — RxNav-backed catalog picker with off-catalog governance.
//
// DEV HANDOFF: port of the reference EMR's CatalogPicker. The governance model
// is the point of this component and must not be weakened:
//   1. On-catalog selection carries rxcui + strength + dose form + route, which
//      is what doseReconcile.ts needs to do real arithmetic.
//   2. Off-catalog entry is allowed (formulary gaps are real) but requires a
//      non-empty clinical justification BEFORE the product can be used, and is
//      badge-flagged everywhere the order is displayed afterwards.
//   3. DEA schedule is NOT looked up — RxNav does not expose it reliably.
//      Controlled status stays a manual clinician toggle on the order.

import { useEffect, useRef, useState } from "react";
import { searchProducts, loadProductDetail, type CatalogProduct } from "@/lib/rxnav";
import { getDailyMedStrength } from "@/lib/dailymed.functions";
import { needsDailyMedFallback } from "@/lib/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, Search, TriangleAlert } from "lucide-react";

export interface CatalogSelection {
  rxcui?: string;
  productName: string;
  strengthText?: string;
  strengthSource?: "rxnav" | "dailymed";
  doseForm?: string;
  ingredientNames?: string[];
  offCatalog: boolean;
  offCatalogJustification?: string;
}

export function CatalogPicker({
  onSelect,
  autoFocus,
}: {
  onSelect: (sel: CatalogSelection) => void;
  autoFocus?: boolean;
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [offName, setOffName] = useState("");
  const [offJustification, setOffJustification] = useState("");
  const [resolving, setResolving] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced live search — RxNav is public and rate-friendly, but we still
  // avoid a request per keystroke.
  useEffect(() => {
    const q = term.trim();
    if (q.length < 3) {
      setResults([]);
      setSearched(false);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      const rows = await searchProducts(q, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setResults(rows);
      setSearched(true);
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [term]);

  const choose = async (p: CatalogProduct) => {
    setResolving(p.rxcui);
    const detail = await loadProductDetail(p);
    let strength = detail.strength;
    let strengthSource: "rxnav" | "dailymed" = "rxnav";

    // DailyMed fallback: only for products that are neither unit-dosed nor
    // topical, where RxNav genuinely yields no parseable strength. Unit-dosed
    // and topical products are NOT data gaps — they use their own axis.
    if (
      needsDailyMedFallback({
        name: detail.name,
        strength,
        doseForm: detail.doseForm,
        ingredientNames: detail.ingredientNames,
      })
    ) {
      const hit = await getDailyMedStrength({
        data: {
          rxcui: detail.rxcui,
          name: detail.name,
          expectedIngredients: detail.ingredientNames?.length || undefined,
        },
      }).catch(() => null);
      if (hit?.strength) {
        strength = hit.strength;
        strengthSource = "dailymed";
      }
    }

    setResolving(null);
    onSelect({
      rxcui: detail.rxcui,
      productName: detail.name,
      strengthText: strength,
      strengthSource,
      doseForm: detail.doseForm,
      ingredientNames: detail.ingredientNames,
      offCatalog: false,
    });
  };

  const offCatalogReady = offName.trim().length > 0 && offJustification.trim().length > 0;

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Medication (RxNorm catalog)</Label>
        <div className="relative mt-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus={autoFocus}
            className="pl-8"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search a medication, e.g. sertraline"
            aria-label="Search medication catalog"
          />
          {loading && (
            <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {results.length > 0 && (
        <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-border p-1.5">
          {results.map((p) => (
            <button
              key={p.rxcui}
              type="button"
              onClick={() => choose(p)}
              className="flex w-full items-start justify-between gap-2 rounded-md p-2 text-left text-sm hover:bg-muted"
            >
              <span>
                <span className="font-medium">{p.name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {[p.strength, p.doseForm].filter(Boolean).join(" · ") || "Strength unavailable"}
                </span>
              </span>
              {resolving === p.rxcui ? (
                <Loader2 className="mt-0.5 h-4 w-4 animate-spin" />
              ) : (
                <Badge variant="outline" className="shrink-0">
                  {p.tty}
                </Badge>
              )}
            </button>
          ))}
        </div>
      )}

      {searched && !loading && results.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No catalog match. Use the off-catalog path below if this product is genuinely needed.
        </p>
      )}

      {/* Off-catalog governance path — justification is mandatory. */}
      <Card className="space-y-2 border-dashed p-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <TriangleAlert className="h-4 w-4 text-amber-600" />
          Off-catalog medication
        </div>
        <p className="text-xs text-muted-foreground">
          Only for products RxNorm does not carry. Dose math cannot be verified for off-catalog
          entries, so a clinical justification is required and the order is flagged for review.
        </p>
        <Input
          value={offName}
          onChange={(e) => setOffName(e.target.value)}
          placeholder="Product name as it should appear on the order"
          aria-label="Off-catalog medication name"
        />
        <Textarea
          value={offJustification}
          onChange={(e) => setOffJustification(e.target.value)}
          placeholder="Clinical justification (required)"
          aria-label="Off-catalog clinical justification"
          rows={2}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={!offCatalogReady}
          onClick={() =>
            onSelect({
              productName: offName.trim(),
              offCatalog: true,
              offCatalogJustification: offJustification.trim(),
            })
          }
        >
          Use off-catalog medication
        </Button>
      </Card>
    </div>
  );
}
