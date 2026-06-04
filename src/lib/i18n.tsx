import { createContext, useContext, useState, type ReactNode } from "react";

type Lang = "en" | "es";

const dict = {
  en: {
    appName: "Adelante",
    tagline: "Care that meets you where you are.",
    subtagline:
      "Behavioral health and reentry support for your first 90 days back in the community.",
    rolePatient: "Patient",
    roleClinician: "Clinician",
    roleAdmin: "Administrator",
    roleReferrer: "Referral Partner",
    demoBanner:
      "Prototype demo — switch roles below. All data is mocked; Healthie integration points are stubbed.",
  },
  es: {
    appName: "Adelante",
    tagline: "Atención que te encuentra donde estás.",
    subtagline:
      "Apoyo de salud conductual y reintegración durante tus primeros 90 días en la comunidad.",
    rolePatient: "Paciente",
    roleClinician: "Clínico",
    roleAdmin: "Administrador",
    roleReferrer: "Socio de Referencia",
    demoBanner:
      "Demostración — cambia de rol abajo. Los datos son simulados; la integración con Healthie está pendiente.",
  },
} as const;

type Key = keyof typeof dict.en;

const I18nCtx = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key) => string;
}>({ lang: "en", setLang: () => {}, t: (k) => dict.en[k] });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");
  const t = (k: Key) => dict[lang][k] ?? dict.en[k];
  return (
    <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>
  );
}

export const useI18n = () => useContext(I18nCtx);