// "In crisis now" points patients to OUTSIDE crisis resources first (988 call/
// text, 911, county crisis line). Telling the Adelante care team is secondary.
// County line is a labelled placeholder until a real number is verified.
// Spanish pending bilingual review.
export const COUNTY_CRISIS_LINE = { number: "0000000000", verified: false } as const;

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
