// "In crisis now" points patients to OUTSIDE crisis resources first (988 call/
// text, 911, county crisis line). Telling the Adelante care team is secondary.
// County lines verified on the county websites (product owner, Sep 2026).
// Spanish pending bilingual review.
export type CrisisCounty = "Kings" | "Tulare";
export interface CountyLine { label: { en: string; es: string }; number: string; display: string }
export const COUNTY_CRISIS_LINES: Record<CrisisCounty, CountyLine[]> = {
  Kings: [
    { label: { en: "Kings County Behavioral Health 24-hour crisis line", es: "Línea de crisis 24 horas de Salud del Comportamiento del Condado de Kings" }, number: "5595824481", display: "(559) 582-4481" },
    { label: { en: "Kings County crisis line (toll-free)", es: "Línea de crisis del Condado de Kings (gratis)" }, number: "18006552553", display: "1-800-655-2553" },
  ],
  Tulare: [
    { label: { en: "Tulare County Mental Health Access & Crisis Line", es: "Línea de Acceso y Crisis de Salud Mental del Condado de Tulare" }, number: "18003201616", display: "1-800-320-1616" },
    { label: { en: "Tulare County SUD Access Line", es: "Línea de Acceso por uso de sustancias del Condado de Tulare" }, number: "18667324114", display: "1-866-732-4114" },
  ],
};
/** Lines for the patient's county; both counties when unknown. */
export function countyCrisisLines(county?: string | null): CountyLine[] {
  const c = (county ?? "").toLowerCase();
  if (c.includes("kings")) return COUNTY_CRISIS_LINES.Kings;
  if (c.includes("tulare")) return COUNTY_CRISIS_LINES.Tulare;
  return [...COUNTY_CRISIS_LINES.Kings, ...COUNTY_CRISIS_LINES.Tulare];
}

export const OUTSIDE_CRISIS_COPY = {
  en: {
    button: "In crisis now",
    title: "In crisis now",
    lede: "These lines answer right away, any hour. They are outside Adelante.",
    call988: "Call 988",
    text988: "Text 988",
    call911: "Call 911 (emergency)",
    county: "County crisis line",
    countyPlaceholder: "Placeholder — number not yet verified",
    outsideNote: "988 and 911 are not Adelante. Your care team does not answer these lines.",
  },
  es: {
    button: "En crisis ahora",
    title: "En crisis ahora",
    lede: "Estas líneas contestan enseguida, a cualquier hora. Son fuera de Adelante.",
    call988: "Llamar al 988",
    text988: "Texto al 988",
    call911: "Llamar al 911 (emergencia)",
    county: "Línea de crisis del condado",
    countyPlaceholder: "Provisional — número aún no verificado",
    outsideNote: "El 988 y el 911 no son Adelante. Su equipo de cuidado no contesta estas líneas.",
  },
} as const;
