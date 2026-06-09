import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

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
    goalNotStarted: "not started",
    goalInProgress: "in progress",
    goalDone: "done",
    // Nav
    navMyCare: "My care",
    navIntake: "Intake",
    navReferrals: "Referrals",
    navCaseManager: "Case Manager",
    navClinician: "Clinician",
    navAdmin: "Admin",
    navStaff: "Staff",
    navStaffPortal: "Staff portal",
    navSignIn: "Sign in",
    // Auth
    authWelcome: "Welcome to Adelante",
    authSignInTitle: "Sign in",
    authSignUpTitle: "Create your account",
    authEmail: "Email or phone",
    authPassword: "Password",
    authContinue: "Continue",
    authSwitchToSignUp: "New here? Create an account",
    authSwitchToSignIn: "Already have an account? Sign in",
    authDemoNote: "Demo: pick the person you'd like to sign in as. Real authentication arrives in Build 2.",
    authPickPerson: "Sign in as",
    authSignOut: "Sign out",
    // Staff surfaces
    cmTitle: "My caseload",
    cmSubtitle: "Non-clinical view — no diagnoses, no clinical notes.",
    cmCaseload: "Caseload",
    cmCheckIn: "Weekly check-in",
    cmResource: "Resource referral",
    cmCoordination: "External coordination",
    cmCoverageActions: "Medi-Cal actions",
    cmEligibilityFlags: "Eligibility flags",
    clinTitle: "Clinician workspace",
    clinSchedule: "Schedule",
    clinCarePlan: "Care Plan",
    clinNotes: "Notes",
    clinTracking: "Tracking",
    clinAppointments: "Appointments",
    clinBookSession: "Book session",
    clinAvailability: "Availability",
    clinRescreensDue: "Re-screens due",
    adminTitle: "Pilot dashboard",
    adminSubtitle: "Kings County · 90-day reentry episode",
    adminCaseload: "Caseload",
    adminBilling: "Billing status",
    adminReferralStatus: "Referral status",
    adminAuditLog: "Consent audit log",
    adminExportCsv: "Export CSV",
    refTitle: "Help someone start care.",
    refSubtitle:
      "A short form — about 2 minutes. We only ask for the basics. Please do not include charges, diagnoses, or substance-use details here.",
    refYourReferrals: "Your referrals",
  },
  es: {
    appName: "Adelante",
    tagline: "Atención que te encuentra donde estás.",
    subtagline:
      "Apoyo de salud conductual y reintegración durante tus primeros 90 días en la comunidad.",
    rolePatient: "Paciente",
    roleClinician: "Profesional clínico",
    roleAdmin: "Administrador",
    roleReferrer: "Socio de referidos",
    demoBanner:
      "Demostración — cambia de rol abajo. Los datos son simulados; la integración con Healthie está pendiente.",
    crisisInCrisis: "¿En crisis?",
    crisisCallText: "Llama o envía un mensaje de texto al",
    crisisAnytime: "en cualquier momento. Hablamos español.",
    homeWelcomeBack: "Bienvenido de nuevo",
    homeHi: "Hola",
    homeDayOf: "Estás en el día",
    homeOfPlan: "de tu plan de 90 días.",
    homeDaysRemain: "días por delante — caminamos contigo.",
    homeNextSession: "Próxima sesión",
    homeNoSessions: "Aún no tienes sesiones programadas.",
    homeJoin: "Unirse a la sesión",
    homeSchedule: "Programar una sesión",
    homeBookAnother: "Reservar otro horario",
    homeCarePlan: "Plan de cuidado",
    homeYourGoals: "Tus metas",
    homeGoalsHelp: "En lo que tú y tu equipo de cuidado están trabajando juntos.",
    homeAllSessions: "Todas las sesiones",
    homeSmsFallback: "Recibes mensajes de texto",
    homeDay: "Día",
    homeMin: "min",
    homeVideo: "video",
    homeWelcomeTitle: "Bienvenido a Adelante",
    homeSetupCare: "preparemos tu atención, juntos.",
    homeIntakeBlurb:
      "Antes de tu primera sesión te haremos unas preguntas cortas sobre cómo te sientes y qué apoyo necesitas. Toma unos 10 a 15 minutos y puedes pausar cuando quieras.",
    homePrivate: "Privado",
    homePrivateDesc: "Tu información está protegida por la ley (HIPAA y 42 CFR Parte 2).",
    homeYourPace: "Tu ritmo",
    homeYourPaceDesc: "Pausa y continúa donde lo dejaste.",
    homeRealHelp: "Ayuda real",
    homeRealHelpDesc: "Un coordinador de casos puede ayudarte por teléfono, paso a paso.",
    homeStartIntake: "Comenzar mis preguntas",
    homeConsentNote: "No te preguntamos sobre uso de sustancias a menos que tú lo permitas.",
    needHousing: "Vivienda",
    needSubstanceUse: "Uso de sustancias",
    needEmployment: "Empleo",
    needBenefits: "Beneficios",
    needFamily: "Familia",
    needTransportation: "Transporte",
    statusScheduled: "programada",
    statusCompleted: "completada",
    statusCancelled: "cancelada",
    statusNoShow: "sin asistencia",
    goalNotStarted: "sin empezar",
    goalInProgress: "en progreso",
    goalDone: "completada",
    // Nav
    navMyCare: "Mi cuidado",
    navIntake: "Preguntas iniciales",
    navReferrals: "Referidos",
    navCaseManager: "Coordinador",
    navClinician: "Profesional clínico",
    navAdmin: "Administración",
    navStaff: "Equipo",
    navStaffPortal: "Portal del equipo",
    navSignIn: "Iniciar sesión",
    // Auth
    authWelcome: "Bienvenido a Adelante",
    authSignInTitle: "Iniciar sesión",
    authSignUpTitle: "Crear tu cuenta",
    authEmail: "Correo o teléfono",
    authPassword: "Contraseña",
    authContinue: "Continuar",
    authSwitchToSignUp: "¿Nuevo aquí? Crea una cuenta",
    authSwitchToSignIn: "¿Ya tienes cuenta? Inicia sesión",
    authDemoNote: "Demostración: elige la persona con la que quieres entrar. La autenticación real llega en la Versión 2.",
    authPickPerson: "Entrar como",
    authSignOut: "Cerrar sesión",
    // Staff surfaces
    cmTitle: "Mis clientes",
    cmSubtitle: "Vista no clínica — sin diagnósticos ni notas clínicas.",
    cmCaseload: "Clientes",
    cmCheckIn: "Contacto semanal",
    cmResource: "Referido de recursos",
    cmCoordination: "Coordinación externa",
    cmCoverageActions: "Acciones de Medi-Cal",
    cmEligibilityFlags: "Indicadores de elegibilidad",
    clinTitle: "Espacio del profesional",
    clinSchedule: "Agenda",
    clinCarePlan: "Plan de cuidado",
    clinNotes: "Notas",
    clinTracking: "Seguimiento",
    clinAppointments: "Citas",
    clinBookSession: "Reservar sesión",
    clinAvailability: "Disponibilidad",
    clinRescreensDue: "Reevaluaciones pendientes",
    adminTitle: "Panel del piloto",
    adminSubtitle: "Condado de Kings · episodio de 90 días",
    adminCaseload: "Caseload",
    adminBilling: "Estado de facturación",
    adminReferralStatus: "Estado de referidos",
    adminAuditLog: "Registro de consentimiento",
    adminExportCsv: "Exportar CSV",
    refTitle: "Ayuda a alguien a empezar su cuidado.",
    refSubtitle:
      "Un formulario corto, unos 2 minutos. Pedimos solo lo básico. Por favor no incluyas cargos, diagnósticos ni detalles sobre uso de sustancias.",
    refYourReferrals: "Tus referidos",
  },
} as const;

type Key = keyof typeof dict.en;

const I18nCtx = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key) => string;
}>({ lang: "en", setLang: () => {}, t: (k) => dict.en[k] });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("adelante.lang");
      if (saved === "en" || saved === "es") setLangState(saved);
    } catch { /* no-op */ }
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("adelante.lang", l); } catch { /* no-op */ }
  };
  const t = (k: Key) => dict[lang][k] ?? dict.en[k];
  return (
    <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>
  );
}

export const useI18n = () => useContext(I18nCtx);