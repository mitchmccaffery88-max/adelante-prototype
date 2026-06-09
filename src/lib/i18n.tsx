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
    crisisInCrisis: "In crisis?",
    crisisCallText: "Call or text",
    crisisAnytime: "anytime. Spanish-capable.",
    homeWelcomeBack: "Welcome back",
    homeHi: "Hi",
    homeDayOf: "You're on day",
    homeOfPlan: "of your 90-day care plan.",
    homeDaysRemain: "days remain — we're walking with you.",
    homeNextSession: "Next session",
    homeNoSessions: "No upcoming sessions yet.",
    homeJoin: "Join session",
    homeSchedule: "Schedule a session",
    homeBookAnother: "Book another time",
    homeCarePlan: "Care plan",
    homeYourGoals: "Your goals",
    homeGoalsHelp: "What you and your care team are working on together.",
    homeAllSessions: "All sessions",
    homeSmsFallback: "SMS fallback active",
    homeDay: "Day",
    homeMin: "min",
    homeVideo: "video",
    homeWelcomeTitle: "Welcome to Adelante",
    homeSetupCare: "let's set up your care, together.",
    homeIntakeBlurb:
      "Before your first session, we'll ask a few short questions about how you're doing and what support you need. It takes about 10–15 minutes, and you can pause anytime.",
    homePrivate: "Private",
    homePrivateDesc: "HIPAA + 42 CFR Part 2 protected.",
    homeYourPace: "Your pace",
    homeYourPaceDesc: "Pause and pick up where you left off.",
    homeRealHelp: "Real help",
    homeRealHelpDesc: "A case manager can do it with you by phone.",
    homeStartIntake: "Start my intake",
    homeConsentNote: "Nothing about substance use is collected unless you say yes.",
    needHousing: "Housing",
    needSubstanceUse: "Substance use",
    needEmployment: "Employment",
    needBenefits: "Benefits",
    needFamily: "Family",
    needTransportation: "Transportation",
    statusScheduled: "scheduled",
    statusCompleted: "completed",
    statusCancelled: "cancelled",
    statusNoShow: "no show",
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
    crisisInCrisis: "¿En crisis?",
    crisisCallText: "Llama o envía un mensaje al",
    crisisAnytime: "en cualquier momento. Hablamos español.",
    homeWelcomeBack: "Bienvenido de nuevo",
    homeHi: "Hola",
    homeDayOf: "Estás en el día",
    homeOfPlan: "de tu plan de 90 días.",
    homeDaysRemain: "días restantes — caminamos contigo.",
    homeNextSession: "Próxima sesión",
    homeNoSessions: "Aún no tienes sesiones programadas.",
    homeJoin: "Unirse a la sesión",
    homeSchedule: "Programar una sesión",
    homeBookAnother: "Reservar otro horario",
    homeCarePlan: "Plan de cuidado",
    homeYourGoals: "Tus metas",
    homeGoalsHelp: "Lo que tú y tu equipo de cuidado están trabajando juntos.",
    homeAllSessions: "Todas las sesiones",
    homeSmsFallback: "SMS de respaldo activo",
    homeDay: "Día",
    homeMin: "min",
    homeVideo: "video",
    homeWelcomeTitle: "Bienvenido a Adelante",
    homeSetupCare: "vamos a configurar tu atención, juntos.",
    homeIntakeBlurb:
      "Antes de tu primera sesión, te haremos algunas preguntas breves sobre cómo te sientes y qué apoyo necesitas. Toma unos 10–15 minutos, y puedes pausar cuando quieras.",
    homePrivate: "Privado",
    homePrivateDesc: "Protegido por HIPAA y 42 CFR Part 2.",
    homeYourPace: "Tu ritmo",
    homeYourPaceDesc: "Pausa y continúa donde lo dejaste.",
    homeRealHelp: "Ayuda real",
    homeRealHelpDesc: "Un administrador de casos puede hacerlo contigo por teléfono.",
    homeStartIntake: "Comenzar mi registro",
    homeConsentNote: "No se recopila nada sobre uso de sustancias a menos que tú digas que sí.",
    needHousing: "Vivienda",
    needSubstanceUse: "Uso de sustancias",
    needEmployment: "Empleo",
    needBenefits: "Beneficios",
    needFamily: "Familia",
    needTransportation: "Transporte",
    statusScheduled: "programada",
    statusCompleted: "completada",
    statusCancelled: "cancelada",
    statusNoShow: "no asistió",
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