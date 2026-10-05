// §Cleanup 3 — EN/ES copy for the patient booking / reschedule page and the
// appointments list. Spanish is draft wording pending bilingual review.
import type { ServiceType } from "./ehr";

export const SCHEDULE_ES_DRAFT = "Borrador — traducción pendiente de revisión bilingüe";

const EN = {
  eyebrowReschedule: "Reschedule",
  eyebrowBook: "Appointments",
  titleReschedule: "Pick a new time",
  titleBook: "My appointments",
  subReschedule: "These are your counselor's open times pulled from their live calendar.",
  subBook: "Everything you have booked, plus a place to book something new.",
  tabYours: "Your appointments",
  tabOne: "Book one-on-one",
  tabGroups: "Groups",
  alreadyBooked: "You already have an appointment booked",
  overlapWarn: "Booking a time that overlaps one of these won't go through. If you need to move a visit, reschedule it instead.",
  seeAppts: "See your appointments",
  whatKind: "What kind of visit?",
  pickType: "Pick a visit type",
  pickLocation: "Pick a location",
  pickCounselor: "Pick a counselor",
  taken: "Taken",
  open: "Open",
  sessionLength: (m: number) => `Session length is ${m} minutes. Your care team sets this — call your case manager if you need it changed.`,
  confirmNew: "Confirm new time",
  rescheduled: "Session rescheduled",
  rescheduledDesc: "Your care team and you have been notified.",
  pickService: "Pick a service to continue.",
  pickLocationErr: "Pick a location for the in-person visit.",
  pickTime: "Pick a time that works for you.",
  couldNotBook: "Could not book that slot.",
  inPersonAt: (n: string) => `In person at ${n}.`,
  upcoming: "Upcoming",
  scheduled: (n: number) => `${n} scheduled`,
  nothingYet: "Nothing scheduled yet",
  nothingYetDesc: "Use One-on-one visit or Groups above to book a time.",
  past: "Past visits",
  noPast: "No past visits yet",
  visit: "Visit",
  min: "min",
  directions: "Directions",
  reschedule: "Reschedule",
  joinEarly: "Join opens 15 min before",
  join: "Join video call",
  video: "Video",
  phone: "Phone",
  inPerson: "In person",
  prepInPerson: "Prep tip: give yourself extra time for the trip, and bring your ID if you have it.",
  prepPhone: "Prep tip: pick somewhere you won't be overheard, and keep your phone charged.",
  prepVideo: "Prep tip: test your camera a few minutes early and find a private spot.",
  status: {} as Record<string, string>,
};

type Copy = typeof EN;

const ES: Copy = {
  eyebrowReschedule: "Cambiar cita",
  eyebrowBook: "Citas",
  titleReschedule: "Elige una nueva hora",
  titleBook: "Mis citas",
  subReschedule: "Estos son los horarios libres de tu consejero, tomados de su calendario actual.",
  subBook: "Todo lo que has reservado, y un lugar para reservar algo nuevo.",
  tabYours: "Tus citas",
  tabOne: "Reservar cita individual",
  tabGroups: "Grupos",
  alreadyBooked: "Ya tienes una cita reservada",
  overlapWarn: "Si reservas una hora que se cruza con una de estas, no se hará. Si necesitas mover una cita, cámbiala.",
  seeAppts: "Ver tus citas",
  whatKind: "¿Qué tipo de cita?",
  pickType: "Elige un tipo de cita",
  pickLocation: "Elige un lugar",
  pickCounselor: "Elige un consejero",
  taken: "Ocupado",
  open: "Libre",
  sessionLength: (m) => `La sesión dura ${m} minutos. Tu equipo de atención lo decide — llama a tu administrador de casos si necesitas cambiarlo.`,
  confirmNew: "Confirmar nueva hora",
  rescheduled: "Cita cambiada",
  rescheduledDesc: "Tú y tu equipo de atención recibieron un aviso.",
  pickService: "Elige un servicio para continuar.",
  pickLocationErr: "Elige un lugar para la cita en persona.",
  pickTime: "Elige una hora que te funcione.",
  couldNotBook: "No se pudo reservar esa hora.",
  inPersonAt: (n) => `En persona en ${n}.`,
  upcoming: "Próximas",
  scheduled: (n) => `${n} programada(s)`,
  nothingYet: "Todavía no hay nada programado",
  nothingYetDesc: "Usa Cita individual o Grupos arriba para reservar una hora.",
  past: "Citas pasadas",
  noPast: "Todavía no hay citas pasadas",
  visit: "Cita",
  min: "min",
  directions: "Cómo llegar",
  reschedule: "Cambiar cita",
  joinEarly: "Se abre 15 min antes",
  join: "Unirse a la videollamada",
  video: "Video",
  phone: "Teléfono",
  inPerson: "En persona",
  prepInPerson: "Consejo: date tiempo extra para el viaje y trae tu identificación si la tienes.",
  prepPhone: "Consejo: busca un lugar donde no te escuchen y ten tu teléfono cargado.",
  prepVideo: "Consejo: prueba tu cámara unos minutos antes y busca un lugar privado.",
  status: { scheduled: "Programada", attended: "Asistió", no_show: "No asistió", cancelled: "Cancelada", late_cancel: "Cancelada tarde", check_in: "Llegó", rescheduled: "Cambiada" },
};

export function scheduleCopy(lang: string): Copy {
  return lang === "es" ? ES : EN;
}

const SERVICE_ES: Partial<Record<ServiceType, { label: string; helper: string }>> = {
  intake: { label: "Primera cita (admisión)", helper: "Prepárate con tu equipo de atención." },
  therapy_individual: { label: "Hablar con un consejero", helper: "Una sesión privada individual." },
  therapy_group: { label: "Sesión de grupo", helper: "Reúnete con otras personas en un grupo con apoyo." },
  med_management: { label: "Cita de medicamentos", helper: "Habla con un profesional que receta sobre tus medicamentos." },
  peer_support: { label: "Apoyo de pares", helper: "Conecta con alguien que ha pasado por lo mismo." },
  case_management: { label: "Reunión con tu administrador de casos", helper: "Recibe ayuda con recursos y próximos pasos." },
  care_coordination: { label: "Coordinación de atención", helper: "Organiza servicios externos y apoyo." },
  sud_counseling: { label: "Consejería individual (uso de sustancias)", helper: "Consejería individual sobre uso de sustancias." },
  sud_group_odf: { label: "Grupo ODF", helper: "Grupo ambulatorio sin drogas." },
  sud_group_iot: { label: "Grupo IOT", helper: "Grupo ambulatorio intensivo." },
};

export function serviceLabel(id: ServiceType | undefined, enLabel: string | undefined, lang: string): string {
  if (lang === "es" && id && SERVICE_ES[id]) return SERVICE_ES[id]!.label;
  return enLabel ?? scheduleCopy(lang).visit;
}
export function serviceHelper(id: ServiceType | undefined, enHelper: string | undefined, lang: string): string {
  if (lang === "es" && id && SERVICE_ES[id]) return SERVICE_ES[id]!.helper;
  return enHelper ?? "";
}
