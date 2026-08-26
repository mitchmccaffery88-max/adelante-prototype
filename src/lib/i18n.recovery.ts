// §Adelante Journey Phase 5b — Spanish scaffolding for the Recovery modules.
//
// SAME MECHANISM, NOT A SECOND ONE. Everything here is flat `key: string`
// entries that get merged into the ONE dictionary in `src/lib/i18n.tsx` and
// read through the ONE `t()` from `useI18n()` — exactly like the nav labels.
// This file exists only so 150 content strings don't bloat that dictionary.
//
// Two tiers, deliberately separated because they carry different risk:
//
//   1. `recoveryUiEn` / `recoveryUiEs` — module names, missions, subtitles,
//      short UI strings and the pending-content messaging. Short, low-risk,
//      DIRECTLY USABLE. They live in both languages because English is the
//      source of truth for a UI string.
//
//   2. `recoveryContentEs` — a first-pass Spanish rendering of Module 1's real
//      lesson bodies. ES-ONLY on purpose: the English is already the single
//      source of truth in `src/lib/recovery.ts`, so this is an override layer,
//      never a duplicate. Recovery/clinical framing does not survive literal
//      translation, so every one of these strings is treated as PENDING
//      HUMAN REVIEW (`RECOVERY_ES_REVIEW`) and the UI says so on the page —
//      the same discipline as `verified: false` content elsewhere.
//
// Content keys are `rec.<lessonId>.<field>`; the reader is `useRecoveryText()`,
// which falls back to the real English content whenever no override exists.

/** UI strings — short, low-risk, treated as directly usable. */
export const recoveryUiEn = {
  recJourneyTitle: "My recovery journey",
  recJourneyIntro:
    "Nine modules, each with its own mission. Work them in order or start where you are.",
  recModuleLabel: "Module",
  recMissionLabel: "Mission",
  recReentrySpecific: "Written for reentry — open to everyone",
  recPendingBadge: "Lesson content pending transcription",
  recPendingBody:
    "This module is real and confirmed, but its lessons haven't been transcribed yet. Nothing has been made up to fill the gap — it will open when the real content lands.",
  recPendingProgress: "No lessons yet — content pending",
  recGatedBody:
    "This module is written for people coming out of custody. It isn't part of your track.",
  recProgressOf: "of",
  recProgressLessons: "lessons complete",
  recMinutesShort: "min",
  recStart: "Start",
  recRevisit: "Revisit",
  recBackToModules: "Back to my modules",
  recLessonDone: "You finished this lesson.",
  recLessonSelectionsRestored:
    "Your saved warning signs, support people and action are filled in below. Change anything and finish again to update them.",
  recLessonNotDone: "Not finished yet — nothing is saved until you finish.",
  recLivingName: "Living Recovery",
  recLivingMission: "Protect My Recovery for Life",
  recLivingBody:
    "Everything you have built, kept going — the closing section over all eight modules. We've kept this as a closing section rather than building it as a ninth module; that needs a human decision before any lessons are written for it.",
  recLivingBadge: "Not yet confirmed as a module",
  recEsReviewFlag:
    "Spanish translation is a first pass and is pending review by a native or professional translator. The English version is the reviewed source.",
  recEsReviewBadge: "Translation pending review",
  // Module 9 — un-authored content. Honest fallbacks, not invented copy.
  recContentPendingNote:
    "This lesson's check-in and reflection questions haven't been written yet. A clinical content reviewer is authoring them. Everything else on this page is real, and what you save still counts.",
  recContentPendingBadge: "Questions pending authoring",
  recAdelFallbackReflection:
    "Adel can talk this through with you. Nothing you say here gets you in trouble.",
  recAdelFallbackQuestion: "What's on your mind after reading this?",
  modCompleted: "Completed",
  modPlaceholderBadge: "Placeholder content",
  modAbout: "About",
  modMinutes: "minutes",
  modPickOne: "Pick one.",
  modPickUpTo: "Pick up to",
  modSelectedOf: "of",
  modSelectedSuffix: "selected.",
  modStepLabel: "Step",
  modStepOf: "of",
  modStepsWord: "steps",
  modBack: "Back",
  modContinue: "Continue",
  modSavedNote: "Saved as you go.",
  modVisitedCount: "visited",
  modRestart: "Start this lesson over",
  modRestarted: "Back to step 1 — your answers are still saved.",
  modGoToStep: "Go to step",
  modStepNotVisited: "not visited yet",
  modPartA: "Part A · Practice",
  modPartB: "Part B · Build my plan",
  modPartAMatched: "This tool was matched to what this lesson is about.",
  modPartAGeneral: "A general tool for this module — useful here even though it wasn't written for this lesson.",
  modPartANote: "Nothing here is saved or shared. Use it as long as you need.",
  modToolkitTitle: "Create My Toolkit",
  modToolkitEmpty: "Nothing picked yet — go back a step and choose at least one.",
  modToolkitNonePicked: "Nothing picked.",
  modToolkitSaveNote: "Finishing the lesson saves these picks to your toolkit.",
  modNeedOnePick: "Pick at least one to continue.",
  modFinishToolsHint: "Work through Part B to continue.",
  modPracticeScenario: "Scenario",
  modPracticeChoose: "What would you do?",
  modPracticeGood: "That works",
  modPracticeRethink: "Worth rethinking",
  modPracticeTryAnother: "Try another answer — there's no score here.",
  modRateBeforeLabel: "How I'm doing now",
  modRateAfterLabel: "How I'm doing after",
  modRateBeforeIntro: "Before we start, mark where you are. There are no wrong answers.",
  modRateAfterIntro: "Mark where you are now. We'll show you what changed.",
  modRateSkipNote: "You can skip any of these.",
  modRateNoBefore: "You didn't rate this at the start, so there's nothing to compare yet.",
  modRateChange: "What changed",
  modRateBetter: "Moved the right way",
  modRateWorse: "Moved the other way",
  modRateSame: "No change",
  modRateHonest: "Either way, rating it honestly is the useful part.",
  modAdelIntro:
    "Adel is the guide who walks these lessons with you. Here's what she'd ask about this one.",
  modAdelAnswerLabel: "My answer",
  modAdelRecommends: "Adel also suggests",
  // §Lesson-player Phase D — UI labels only. No lesson content lives here.
  modLearnPart: "Part",
  modLearnNextPart: "Next part",
  modLearnHappening: "What's happening",
  modLearnWhy: "Why it happens",
  modLearnCanChange: "What can change",
  modLearnBeforeMovingOn: "Before moving on",
  modIfThenStep: "My if–then plan",
  modIfThenTitle: "Build your if–then plan",
  modIfThenIf: "IF this happens…",
  modIfThenThen: "THEN I will…",
  modIfThenIfWord: "If",
  modIfThenThenWord: "then",
  modIfThenHint: "Pick at least one on each side. Your picks save as you go.",
  recToolsStep: "My tools",

  libStepProblem: "Understand my challenge",
  libStepCheckIn: "Check in",
  libStepLearn: "Learn",
  libStepActivity: "Build skills",
  libStepReflect: "Talk with Adel",
  libStepInsight: "Insight",
  libStepAction: "Next step",
  libStepToolkit: "Save to my toolkit",
  libCheckInFallback:
    "Take a breath before you start. Nothing you write here is graded.",
  libCheckInPrompt: "Which of these sound like you right now?",
  recStepProblem: "The problem",
  recStepCheckIn: "Check in",
  recStepLearn: "Learn",
  recStepTryIt: "Try it",
  recStepReflect: "Reflect",
  recStepInsight: "Insight",
  recStepWarnings: "My warning signs",
  recStepSupport: "Who I can reach out to",
  recStepAction: "One action for today",
  recStepToolkit: "Toolkit",
  recPromptWarnings: "Which of these are showing up for you right now?",
  recPromptSupport: "Pick the people you would actually contact.",
  recPromptAction: "Just one. Today only.",
  recFinishSave: "Finish and save to my toolkit",
  recUpdatePlan: "Update my plan",
} as const;

export const recoveryUiEs: Record<keyof typeof recoveryUiEn, string> = {
  recJourneyTitle: "Mi camino de recuperación",
  recJourneyIntro:
    "Nueve módulos, cada uno con su propia misión. Hazlos en orden o empieza donde estés.",
  recModuleLabel: "Módulo",
  recMissionLabel: "Misión",
  recReentrySpecific: "Escrito para la reintegración — abierto a todos",
  recPendingBadge: "Contenido de las lecciones pendiente de transcripción",
  recPendingBody:
    "Este módulo es real y está confirmado, pero sus lecciones todavía no se han transcrito. No se inventó nada para llenar el vacío — se abrirá cuando llegue el contenido real.",
  recPendingProgress: "Todavía no hay lecciones — contenido pendiente",
  recGatedBody:
    "Este módulo está escrito para personas que están saliendo de custodia. No forma parte de tu camino.",
  recProgressOf: "de",
  recProgressLessons: "lecciones completadas",
  recMinutesShort: "min",
  recStart: "Empezar",
  recRevisit: "Repasar",
  recBackToModules: "Volver a mis módulos",
  recLessonDone: "Terminaste esta lección.",
  recLessonSelectionsRestored:
    "Abajo aparecen las señales de alerta, las personas de apoyo y la acción que guardaste. Cambia lo que quieras y termina de nuevo para actualizarlas.",
  recLessonNotDone: "Todavía sin terminar — no se guarda nada hasta que termines.",
  recLivingName: "Vivir en Recuperación",
  recLivingMission: "Proteger Mi Recuperación de por Vida",
  recLivingBody:
    "Todo lo que has construido, en marcha — la sección de cierre sobre los ocho módulos. Lo mantuvimos como sección de cierre en vez de construirlo como un noveno módulo; eso necesita una decisión humana antes de escribir cualquier lección.",
  recLivingBadge: "Aún no confirmado como módulo",
  recEsReviewFlag:
    "La traducción al español es un primer borrador y está pendiente de revisión por una persona traductora nativa o profesional. La versión en inglés es la fuente revisada.",
  recEsReviewBadge: "Traducción pendiente de revisión",
  modCompleted: "Completada",
  modPlaceholderBadge: "Contenido de ejemplo",
  modAbout: "Unos",
  modMinutes: "minutos",
  modPickOne: "Elige una.",
  modPickUpTo: "Elige hasta",
  modSelectedOf: "de",
  modSelectedSuffix: "seleccionadas.",
  modStepLabel: "Paso",
  modStepOf: "de",
  modStepsWord: "pasos",
  modBack: "Atrás",
  modContinue: "Continuar",
  modSavedNote: "Se guarda mientras avanzas.",
  modVisitedCount: "visitados",
  modRestart: "Empezar esta lección de nuevo",
  modRestarted: "Volviste al paso 1 — tus respuestas siguen guardadas.",
  modGoToStep: "Ir al paso",
  modStepNotVisited: "todavía sin visitar",
  modPartA: "Parte A · Practica",
  modPartB: "Parte B · Arma mi plan",
  modPartAMatched: "Esta herramienta corresponde al tema de esta lección.",
  modPartAGeneral: "Una herramienta general de este módulo — útil aquí aunque no se escribió para esta lección.",
  modPartANote: "Nada de esto se guarda ni se comparte. Úsala el tiempo que necesites.",
  modToolkitTitle: "Crear mis herramientas",
  modToolkitEmpty: "Todavía no elegiste nada — regresa un paso y elige al menos una.",
  modToolkitNonePicked: "Nada elegido.",
  modToolkitSaveNote: "Al terminar la lección se guardan estas elecciones en tus herramientas.",
  modNeedOnePick: "Elige al menos una para continuar.",
  modFinishToolsHint: "Completa la Parte B para continuar.",
  modPracticeScenario: "Situación",
  modPracticeChoose: "¿Qué harías?",
  modPracticeGood: "Eso funciona",
  modPracticeRethink: "Vale la pena repensarlo",
  modPracticeTryAnother: "Prueba otra respuesta — aquí no hay calificación.",
  modRateBeforeLabel: "Cómo estoy ahora",
  modRateAfterLabel: "Cómo estoy después",
  modRateBeforeIntro: "Antes de empezar, marca dónde estás. No hay respuestas incorrectas.",
  modRateAfterIntro: "Marca dónde estás ahora. Te mostramos qué cambió.",
  modRateSkipNote: "Puedes saltarte cualquiera.",
  modRateNoBefore: "No calificaste esto al empezar, así que todavía no hay comparación.",
  modRateChange: "Qué cambió",
  modRateBetter: "Se movió en la dirección buena",
  modRateWorse: "Se movió en la otra dirección",
  modRateSame: "Sin cambio",
  modRateHonest: "De cualquier forma, lo útil es calificarlo con honestidad.",
  modAdelIntro:
    "Adel es la guía que recorre estas lecciones contigo. Esto es lo que te preguntaría aquí.",
  modAdelAnswerLabel: "Mi respuesta",
  modAdelRecommends: "Adel también sugiere",
  // §Lesson-player Phase D — solo etiquetas de interfaz.
  modLearnPart: "Parte",
  modLearnNextPart: "Siguiente parte",
  modLearnHappening: "Qué está pasando",
  modLearnWhy: "Por qué pasa",
  modLearnCanChange: "Qué puede cambiar",
  modLearnBeforeMovingOn: "Antes de seguir",
  modIfThenStep: "Mi plan si–entonces",
  modIfThenTitle: "Arma tu plan si–entonces",
  modIfThenIf: "SI pasa esto…",
  modIfThenThen: "ENTONCES voy a…",
  modIfThenIfWord: "Si",
  modIfThenThenWord: "entonces",
  modIfThenHint: "Elige al menos una de cada lado. Se guarda mientras avanzas.",
  recToolsStep: "Mis herramientas",

  libStepProblem: "Entender mi reto",
  libStepCheckIn: "Cómo estás",
  libStepLearn: "Aprende",
  libStepActivity: "Practica",
  libStepReflect: "Habla con Adel",
  libStepInsight: "La idea clave",
  libStepAction: "Siguiente paso",
  libStepToolkit: "Guardar en mis herramientas",
  libCheckInFallback:
    "Respira antes de empezar. Nada de lo que escribas aquí se califica.",
  libCheckInPrompt: "¿Cuáles de estas te suenan ahora mismo?",
  recStepProblem: "El problema",
  recStepCheckIn: "Cómo estás",
  recStepLearn: "Aprende",
  recStepTryIt: "Pruébalo",
  recStepReflect: "Reflexiona",
  recStepInsight: "La idea clave",
  recStepWarnings: "Mis señales de alerta",
  recStepSupport: "A quién puedo acudir",
  recStepAction: "Una acción para hoy",
  recStepToolkit: "Mis herramientas",
  recPromptWarnings: "¿Cuáles de estas están apareciendo ahora mismo?",
  recPromptSupport: "Elige a las personas a las que de verdad contactarías.",
  recPromptAction: "Solo una. Solo por hoy.",
  recFinishSave: "Terminar y guardar en mis herramientas",
  recUpdatePlan: "Actualizar mi plan",
};

/** Module names / missions / subtitles — keyed `rec.mod.<moduleId>.<field>`. */
export const recoveryModuleEn = {
  "rec.mod.first-days-out.name": "My First Days Out",
  "rec.mod.first-days-out.mission": "Survive and Stabilize",
  "rec.mod.first-days-out.subtitle":
    "The first stretch: staying alive, staying safe, getting a floor under you.",
  "rec.mod.finding-my-people.name": "Finding My People",
  "rec.mod.finding-my-people.mission": "Build My Support System",
  "rec.mod.finding-my-people.subtitle": "Who you can call, who you can trust, and how to ask.",
  "rec.mod.understanding-my-addiction.name": "Understanding My Addiction",
  "rec.mod.understanding-my-addiction.mission": "Know My Patterns",
  "rec.mod.understanding-my-addiction.subtitle":
    "Triggers, cycles, and what your use has been doing for you.",
  "rec.mod.changing-my-everyday-life.name": "Changing My Everyday Life",
  "rec.mod.changing-my-everyday-life.mission": "Create Healthy Routines",
  "rec.mod.changing-my-everyday-life.subtitle":
    "Sleep, food, movement, money, and the shape of a day.",
  "rec.mod.healing-my-relationships.name": "Healing My Relationships",
  "rec.mod.healing-my-relationships.mission": "Repair and Protect",
  "rec.mod.healing-my-relationships.subtitle":
    "Making amends where you can, setting limits where you must.",
  "rec.mod.building-a-life-that-works.name": "Building a Life That Works",
  "rec.mod.building-a-life-that-works.mission": "Get Stable",
  "rec.mod.building-a-life-that-works.subtitle": "Housing, work, documents, and income that hold.",
  "rec.mod.when-recovery-gets-hard.name": "When Recovery Gets Hard",
  "rec.mod.when-recovery-gets-hard.mission": "Strengthen My Recovery",
  "rec.mod.when-recovery-gets-hard.subtitle":
    "Cravings, setbacks, grief, and the days you want to quit.",
  "rec.mod.becoming-someone-new.name": "Becoming Someone New",
  "rec.mod.becoming-someone-new.mission": "Grow Into Who I'm Becoming",
  "rec.mod.becoming-someone-new.subtitle":
    "Identity, purpose, and a version of you that isn't the old one.",
  "rec.mod.living-recovery.name": "Living Recovery",
  "rec.mod.living-recovery.mission": "Protect My Recovery for Life",
  "rec.mod.living-recovery.subtitle":
    "Everything you have built, kept going — maintenance for the long haul.",
} as const;

export const recoveryModuleEs: Record<keyof typeof recoveryModuleEn, string> = {
  "rec.mod.first-days-out.name": "Mis Primeros Días Afuera",
  "rec.mod.first-days-out.mission": "Sobrevivir y Estabilizarme",
  "rec.mod.first-days-out.subtitle":
    "El primer tramo: seguir con vida, estar a salvo y poner un piso bajo tus pies.",
  "rec.mod.finding-my-people.name": "Encontrar a Mi Gente",
  "rec.mod.finding-my-people.mission": "Construir Mi Red de Apoyo",
  "rec.mod.finding-my-people.subtitle":
    "A quién puedes llamar, en quién puedes confiar y cómo pedir ayuda.",
  "rec.mod.understanding-my-addiction.name": "Entender Mi Adicción",
  "rec.mod.understanding-my-addiction.mission": "Conocer Mis Patrones",
  "rec.mod.understanding-my-addiction.subtitle":
    "Detonantes, ciclos y lo que el consumo ha estado haciendo por ti.",
  "rec.mod.changing-my-everyday-life.name": "Cambiar Mi Vida Diaria",
  "rec.mod.changing-my-everyday-life.mission": "Crear Rutinas Saludables",
  "rec.mod.changing-my-everyday-life.subtitle":
    "Sueño, comida, movimiento, dinero y la forma de tu día.",
  "rec.mod.healing-my-relationships.name": "Sanar Mis Relaciones",
  "rec.mod.healing-my-relationships.mission": "Reparar y Proteger",
  "rec.mod.healing-my-relationships.subtitle":
    "Reparar donde se pueda y poner límites donde haga falta.",
  "rec.mod.building-a-life-that-works.name": "Construir una Vida que Funcione",
  "rec.mod.building-a-life-that-works.mission": "Lograr Estabilidad",
  "rec.mod.building-a-life-that-works.subtitle":
    "Vivienda, trabajo, documentos e ingresos que se sostengan.",
  "rec.mod.when-recovery-gets-hard.name": "Cuando la Recuperación se Pone Difícil",
  "rec.mod.when-recovery-gets-hard.mission": "Fortalecer Mi Recuperación",
  "rec.mod.when-recovery-gets-hard.subtitle":
    "Ansias, recaídas, duelo y los días en que quieres rendirte.",
  "rec.mod.becoming-someone-new.name": "Convertirme en Alguien Nuevo",
  "rec.mod.becoming-someone-new.mission": "Crecer Hacia Quien Estoy Siendo",
  "rec.mod.becoming-someone-new.subtitle":
    "Identidad, propósito y una versión tuya que no es la de antes.",
  "rec.mod.living-recovery.name": "Vivir en Recuperación",
  "rec.mod.living-recovery.mission": "Proteger Mi Recuperación de por Vida",
  "rec.mod.living-recovery.subtitle":
    "Todo lo que has construido, en marcha — mantenimiento para el largo plazo.",
};

/**
 * FIRST-PASS Spanish for Module 1's real lesson bodies. ES-ONLY overrides.
 *
 * PENDING HUMAN REVIEW — see `RECOVERY_ES_REVIEW`. Recovery framing ("stay
 * here to build one", "show up even when you show up badly") is idiomatic and
 * carries clinical weight; a literal rendering can change the message. Nothing
 * here should be treated as final until a native/professional pass signs off.
 */
export const recoveryContentEs: Record<string, string> = {
  // --- fdo-first-72-hours ---------------------------------------------------
  "rec.fdo-first-72-hours.title": "Las Primeras 72 Horas",
  "rec.fdo-first-72-hours.problem":
    "Ya saliste, y los primeros días se sienten más fuertes y más rápidos de lo que esperabas.",
  "rec.fdo-first-72-hours.checkIn":
    "Antes que nada: ¿has comido hoy y dormiste anoche?",
  "rec.fdo-first-72-hours.learnTitle":
    "Los primeros tres días son para sobrevivir, no para avanzar",
  "rec.fdo-first-72-hours.learnBody":
    "Tu tolerancia bajó, tu sistema nervioso está en alerta y todos quieren algo de ti. Esta es la ventana de mayor riesgo que existe: el riesgo de sobredosis después de salir llega a su punto más alto en las primeras dos semanas. Por eso la meta de estas 72 horas es pequeña a propósito: seguir con vida, comer, dormir en un lugar seguro y tener naloxona a la mano. Avanzar puede empezar el día cuatro.",
  "rec.fdo-first-72-hours.act.prompt":
    "Marca lo que ya está resuelto. Lo que quede sin marcar es el trabajo de hoy.",
  "rec.fdo-first-72-hours.act.i.0": "Sé dónde voy a dormir esta noche",
  "rec.fdo-first-72-hours.act.i.1": "Tengo naloxona, o sé dónde conseguirla gratis",
  "rec.fdo-first-72-hours.act.i.2": "He comido algo hoy",
  "rec.fdo-first-72-hours.act.i.3": "Una persona sabe dónde estoy",
  "rec.fdo-first-72-hours.act.i.4": "Sé cuál es mi primera cita y cuándo es",
  "rec.fdo-first-72-hours.act.i.5": "Tengo mi teléfono o una forma de que me localicen",
  "rec.fdo-first-72-hours.adelReflection":
    "Nadie estabiliza todo en tres días. Las personas que lo logran son las que cubren lo básico primero.",
  "rec.fdo-first-72-hours.adelQuestion":
    "¿Cuál punto sin marcar cambiaría más las cosas si lo resolvieras hoy?",
  "rec.fdo-first-72-hours.insight":
    "Las primeras 72 horas no son para construir una vida. Son para seguir aquí y poder construirla.",
  "rec.fdo-first-72-hours.warn.0": "Ansias que no se calman",
  "rec.fdo-first-72-hours.warn.1": "No tengo confirmado dónde dormir esta noche",
  "rec.fdo-first-72-hours.warn.2": "Estoy de vuelta con gente con la que consumía",
  "rec.fdo-first-72-hours.warn.3": "Sin comida y sin dinero",
  "rec.fdo-first-72-hours.warn.4": "No he dormido en más de 24 horas",
  "rec.fdo-first-72-hours.warn.5": "Siento que nadie notaría si yo desapareciera",
  "rec.fdo-first-72-hours.sup.0": "Mi coordinador o coordinadora de cuidado CF",
  "rec.fdo-first-72-hours.sup.1": "Mi oficial de libertad condicional o supervisada",
  "rec.fdo-first-72-hours.sup.2": "Un familiar con quien estoy a salvo",
  "rec.fdo-first-72-hours.sup.3": "Mi padrino/madrina o un compañero de apoyo",
  "rec.fdo-first-72-hours.sup.4": "Línea 988 de Suicidio y Crisis",
  "rec.fdo-first-72-hours.sup.5": "El equipo de cuidado de Adelante",
  "rec.fdo-first-72-hours.todo.0": "Traer naloxona en el bolsillo",
  "rec.fdo-first-72-hours.todo.1": "Confirmar dónde voy a dormir esta noche",
  "rec.fdo-first-72-hours.todo.2": "Comer una comida de verdad",
  "rec.fdo-first-72-hours.todo.3": "Llamar a una persona segura",
  "rec.fdo-first-72-hours.todo.4": "Confirmar mi primera cita",
  "rec.fdo-first-72-hours.toolkitLabel": "Mi plan para las primeras 72 horas",

  // --- fdo-tolerance-and-overdose ------------------------------------------
  "rec.fdo-tolerance-and-overdose.title": "Mi Tolerancia Ya No Es la Misma",
  "rec.fdo-tolerance-and-overdose.problem":
    "Una parte de ti cree que puedes consumir la misma cantidad que antes.",
  "rec.fdo-tolerance-and-overdose.checkIn":
    "¿Has pensado en consumir desde que saliste? Respuesta honesta, sin consecuencias.",
  "rec.fdo-tolerance-and-overdose.learnTitle":
    "La tolerancia baja rápido, y no te avisa",
  "rec.fdo-tolerance-and-overdose.learnBody":
    "Después de semanas o meses sin consumir, tu cuerpo aguanta mucho menos que antes. La cantidad que era normal ahora puede detener tu respiración. Por eso las muertes por sobredosis suben justo después de salir: no porque la gente recaiga más fuerte, sino porque su cuerpo cambió y sus hábitos no. Saber esto te protege. La naloxona también, y nunca consumir a solas.",
  "rec.fdo-tolerance-and-overdose.act.title": "Si fueras a consumir esta noche",
  "rec.fdo-tolerance-and-overdose.act.prompt":
    "Aquí no hay respuesta incorrecta. Elige la más cercana a la verdad.",
  "rec.fdo-tolerance-and-overdose.act.c.0.l": "Consumiría la misma cantidad que antes",
  "rec.fdo-tolerance-and-overdose.act.c.0.f":
    "Esa es la cantidad con más riesgo de ser mortal ahora. Si pasa, usa mucho menos y nunca a solas.",
  "rec.fdo-tolerance-and-overdose.act.c.1.l":
    "Consumiría menos porque sé que mi tolerancia bajó",
  "rec.fdo-tolerance-and-overdose.act.c.1.f":
    "Eso es reducción de daños de verdad. Aun así carga naloxona — la sustancia es impredecible.",
  "rec.fdo-tolerance-and-overdose.act.c.2.l": "Llamaría a alguien primero",
  "rec.fdo-tolerance-and-overdose.act.c.2.f":
    "Esa llamada es el paso de protección más fuerte que existe.",
  "rec.fdo-tolerance-and-overdose.act.c.3.l": "No pienso consumir",
  "rec.fdo-tolerance-and-overdose.act.c.3.f":
    "Bien. Carga naloxona de todos modos — puede ser la vida de otra persona la que salves.",
  "rec.fdo-tolerance-and-overdose.adelReflection":
    "Ser honesto sobre esto no significa que vas a consumir. Significa que estás planeando para un cuerpo que cambió.",
  "rec.fdo-tolerance-and-overdose.adelQuestion":
    "¿A quién podrías contarle que tu tolerancia bajó, para que alguien más esté pendiente?",
  "rec.fdo-tolerance-and-overdose.insight":
    "Tu tolerancia se reinició. Tu plan tiene que reiniciarse con ella.",
  "rec.fdo-tolerance-and-overdose.warn.0": "Decirme que aguanto mi cantidad de antes",
  "rec.fdo-tolerance-and-overdose.warn.1": "Planear consumir a solas",
  "rec.fdo-tolerance-and-overdose.warn.2": "No cargar naloxona",
  "rec.fdo-tolerance-and-overdose.warn.3": "Conseguir de alguien que no conozco",
  "rec.fdo-tolerance-and-overdose.warn.4": "Esconderlo de todo el mundo",
  "rec.fdo-tolerance-and-overdose.sup.0": "Alguien que cargue naloxona",
  "rec.fdo-tolerance-and-overdose.sup.1": "Mi padrino/madrina o un compañero de apoyo",
  "rec.fdo-tolerance-and-overdose.sup.2": "Mi coordinador o coordinadora de cuidado CF",
  "rec.fdo-tolerance-and-overdose.sup.3": "Un programa de reducción de daños",
  "rec.fdo-tolerance-and-overdose.sup.4": "El equipo de cuidado de Adelante",
  "rec.fdo-tolerance-and-overdose.todo.0": "Recoger naloxona hoy",
  "rec.fdo-tolerance-and-overdose.todo.1": "Decirle a una persona que mi tolerancia bajó",
  "rec.fdo-tolerance-and-overdose.todo.2": "Guardar un número al que de verdad llamaría primero",
  "rec.fdo-tolerance-and-overdose.todo.3": "Leer los pasos de respuesta ante una sobredosis",
  "rec.fdo-tolerance-and-overdose.toolkitLabel":
    "Tolerancia reiniciada — mi plan de seguridad ante sobredosis",

  // --- fdo-where-i-sleep ----------------------------------------------------
  "rec.fdo-where-i-sleep.title": "Un Lugar Seguro Donde Dormir",
  "rec.fdo-where-i-sleep.problem":
    "Dónde te estás quedando no está resuelto, o es un lugar que sabes que no te hace bien.",
  "rec.fdo-where-i-sleep.checkIn": "¿Dónde dormiste anoche, y te sentiste seguro ahí?",
  "rec.fdo-where-i-sleep.learnTitle": "Dónde duermes decide casi todo lo demás",
  "rec.fdo-where-i-sleep.learnBody":
    "La vivienda no es solo techo: decide quién está a tu alrededor, si puedes guardar tus medicamentos, si puedes descansar y si puedes cumplir tus citas. Una cama en un lugar donde la gente consume no es neutral; es una exposición diaria. No siempre se puede arreglar esto en la primera semana, pero nombrar lo que tienes es como empiezas a moverte.",
  "rec.fdo-where-i-sleep.act.prompt":
    "Clasifica cada opción según si te sirve ahora mismo.",
  "rec.fdo-where-i-sleep.act.b.0": "Me sirve",
  "rec.fdo-where-i-sleep.act.b.1": "No es seguro para mí",
  "rec.fdo-where-i-sleep.act.i.0": "Quedarme con familia",
  "rec.fdo-where-i-sleep.act.i.1": "Quedarme con alguien con quien consumía",
  "rec.fdo-where-i-sleep.act.i.2": "Una cama en un albergue",
  "rec.fdo-where-i-sleep.act.i.3": "Vivienda sobria / casa de recuperación",
  "rec.fdo-where-i-sleep.act.i.4": "Mi propio lugar",
  "rec.fdo-where-i-sleep.act.i.5": "De sofá en sofá",
  "rec.fdo-where-i-sleep.adelReflection":
    "Decir que un lugar no es seguro no es ser malagradecido. Es información con la que tu equipo de cuidado sí puede actuar.",
  "rec.fdo-where-i-sleep.adelQuestion": "Si lo de esta noche se cae, ¿cuál es la segunda opción?",
  "rec.fdo-where-i-sleep.insight":
    "Una cama segura no es un lujo. Es el escalón sobre el que se para todo lo demás.",
  "rec.fdo-where-i-sleep.warn.0": "Nada confirmado para esta noche",
  "rec.fdo-where-i-sleep.warn.1": "Quedarme donde la gente consume",
  "rec.fdo-where-i-sleep.warn.2": "No puedo guardar mi medicamento seguro ahí",
  "rec.fdo-where-i-sleep.warn.3": "No puedo dormir más de unas horas",
  "rec.fdo-where-i-sleep.warn.4": "Me van a pedir que me vaya pronto",
  "rec.fdo-where-i-sleep.sup.0": "Mi coordinador o coordinadora de cuidado CF",
  "rec.fdo-where-i-sleep.sup.1": "Un navegador de vivienda",
  "rec.fdo-where-i-sleep.sup.2": "Familia que podría recibirme por poco tiempo",
  "rec.fdo-where-i-sleep.sup.3": "La línea de admisión de un albergue",
  "rec.fdo-where-i-sleep.sup.4": "El equipo de cuidado de Adelante",
  "rec.fdo-where-i-sleep.todo.0": "Confirmar la cama de esta noche",
  "rec.fdo-where-i-sleep.todo.1": "Preguntarle a mi coordinador sobre opciones de vivienda",
  "rec.fdo-where-i-sleep.todo.2": "Llamar a la línea de admisión de un albergue",
  "rec.fdo-where-i-sleep.todo.3": "Guardar mi medicamento en un lugar seguro",
  "rec.fdo-where-i-sleep.toolkitLabel": "Mi plan para dormir seguro y mi respaldo",

  // --- fdo-paperwork-and-appointments --------------------------------------
  "rec.fdo-paperwork-and-appointments.title":
    "Papeles, Identificación y las Citas que Importan",
  "rec.fdo-paperwork-and-appointments.problem":
    "Hay un montón de cosas que se supone que debes hacer y ningún orden para nada de eso.",
  "rec.fdo-paperwork-and-appointments.checkIn":
    "¿Cuál es lo próximo a lo que tienes que presentarte, y sabes cuándo es?",
  "rec.fdo-paperwork-and-appointments.learnTitle":
    "Tres documentos abren casi todas las puertas",
  "rec.fdo-paperwork-and-appointments.learnBody":
    "La identificación, la cobertura de Medi-Cal y la tarjeta del Seguro Social son las llaves que piden casi todas las demás puertas: vivienda, trabajo, beneficios, recetas. Todo lo demás puede esperar detrás de esas tres. Y de todas las citas que tienes enfrente, las que traen consecuencias (libertad condicional o supervisada, fechas en la corte) y las que mantienen tu medicamento son las que van primero.",
  "rec.fdo-paperwork-and-appointments.act.title": "Ordena tu semana",
  "rec.fdo-paperwork-and-appointments.act.prompt":
    "Este es el orden que suele funcionar. Compara tu semana con él.",
  "rec.fdo-paperwork-and-appointments.act.i.0":
    "Presentarme con libertad condicional o supervisada si es obligatorio",
  "rec.fdo-paperwork-and-appointments.act.i.1": "Confirmar que Medi-Cal está activo",
  "rec.fdo-paperwork-and-appointments.act.i.2": "No faltar a la cita del medicamento",
  "rec.fdo-paperwork-and-appointments.act.i.3": "Empezar el trámite de la identificación",
  "rec.fdo-paperwork-and-appointments.act.i.4": "Solicitar beneficios (CalFresh, GA)",
  "rec.fdo-paperwork-and-appointments.act.i.5": "Seguimiento de vivienda o trabajo",
  "rec.fdo-paperwork-and-appointments.adelReflection":
    "No tienes que hacer las seis esta semana. Tienes que no faltar a las que traen consecuencia.",
  "rec.fdo-paperwork-and-appointments.adelQuestion":
    "¿Cuál has estado evitando, y cuál es la razón de fondo?",
  "rec.fdo-paperwork-and-appointments.insight":
    "Faltar a una cita cuesta más que la cita. Preséntate aunque te presentes mal.",
  "rec.fdo-paperwork-and-appointments.warn.0": "Ya falté a una cita obligatoria",
  "rec.fdo-paperwork-and-appointments.warn.1": "Sin identificación y sin plan para sacarla",
  "rec.fdo-paperwork-and-appointments.warn.2": "No sé si mi Medi-Cal está activo",
  "rec.fdo-paperwork-and-appointments.warn.3": "Estoy evitando una llamada que tengo que hacer",
  "rec.fdo-paperwork-and-appointments.warn.4": "Estoy perdiendo la cuenta de las fechas",
  "rec.fdo-paperwork-and-appointments.sup.0": "Mi coordinador o coordinadora de cuidado CF",
  "rec.fdo-paperwork-and-appointments.sup.1": "Mi oficial de libertad condicional o supervisada",
  "rec.fdo-paperwork-and-appointments.sup.2": "Un trabajador de beneficios o elegibilidad",
  "rec.fdo-paperwork-and-appointments.sup.3": "Alguien que pueda llevarme",
  "rec.fdo-paperwork-and-appointments.sup.4": "El equipo de cuidado de Adelante",
  "rec.fdo-paperwork-and-appointments.todo.0": "Anotar todas las fechas en un solo lugar",
  "rec.fdo-paperwork-and-appointments.todo.1": "Confirmar el estado de mi Medi-Cal",
  "rec.fdo-paperwork-and-appointments.todo.2": "Empezar el trámite de la identificación",
  "rec.fdo-paperwork-and-appointments.todo.3": "Hacer la llamada que he estado evitando",
  "rec.fdo-paperwork-and-appointments.todo.4": "Conseguir cómo llegar a mi próxima cita",
  "rec.fdo-paperwork-and-appointments.toolkitLabel":
    "El orden de mis citas de la primera semana",

  // --- fdo-people-places-things --------------------------------------------
  "rec.fdo-people-places-things.title": "La Gente y los Lugares a los que Regreso",
  "rec.fdo-people-places-things.problem":
    "La misma calle, los mismos números en tu teléfono, la misma gente en la puerta.",
  "rec.fdo-people-places-things.checkIn":
    "¿Alguien de antes ya te buscó desde que saliste?",
  "rec.fdo-people-places-things.learnTitle":
    "Las señales de antes se activan antes de que decidas nada",
  "rec.fdo-people-places-things.learnBody":
    "Las ansias no son solo ganas. Una esquina, un tono de llamada, la voz de cierta persona: tu cerebro aprendió eso como el inicio de una secuencia, y la echa a andar antes de que la parte que piensa alcance. No puedes borrar esas señales, pero sí puedes decidir de antemano qué pasa después: un número bloqueado, una ruta cambiada, una persona a la que llamas en su lugar.",
  "rec.fdo-people-places-things.act.title": "¿Qué ya volvió a aparecer?",
  "rec.fdo-people-places-things.act.prompt": "Toca lo que haya pasado desde que saliste.",
  "rec.fdo-people-places-things.act.i.0": "Alguien con quien consumía me contactó",
  "rec.fdo-people-places-things.act.i.1": "Pasé por un lugar donde consumía",
  "rec.fdo-people-places-things.act.i.2": "Todavía tengo números en mi teléfono",
  "rec.fdo-people-places-things.act.i.3": "Alguien me ofreció",
  "rec.fdo-people-places-things.act.i.4": "Manejé o caminé por una ruta conocida",
  "rec.fdo-people-places-things.act.i.5": "Nada de esto todavía",
  "rec.fdo-people-places-things.adelReflection":
    "Todo eso es normal y nada de eso significa que fracasaste. Significa que el plan tiene que ser específico.",
  "rec.fdo-people-places-things.adelQuestion":
    "¿Cuál contacto o lugar es para el que más necesitas un plan esta semana?",
  "rec.fdo-people-places-things.insight":
    "Decide qué vas a hacer antes de que el momento lo decida por ti.",
  "rec.fdo-people-places-things.warn.0": "Contactos de antes buscándome",
  "rec.fdo-people-places-things.warn.1": "Guardar números que dije que iba a borrar",
  "rec.fdo-people-places-things.warn.2": "Volver a la misma calle",
  "rec.fdo-people-places-things.warn.3": "Contestar cuando dije que no lo haría",
  "rec.fdo-people-places-things.warn.4": "Decirme que una sola visita no pasa nada",
  "rec.fdo-people-places-things.sup.0": "Mi padrino/madrina o un compañero de apoyo",
  "rec.fdo-people-places-things.sup.1": "Un familiar con quien estoy a salvo",
  "rec.fdo-people-places-things.sup.2": "Mi coordinador o coordinadora de cuidado CF",
  "rec.fdo-people-places-things.sup.3": "Alguien de una reunión",
  "rec.fdo-people-places-things.sup.4": "El equipo de cuidado de Adelante",
  "rec.fdo-people-places-things.todo.0": "Borrar o bloquear un número",
  "rec.fdo-people-places-things.todo.1": "Cambiar una ruta que tomo",
  "rec.fdo-people-places-things.todo.2": "Decirle a alguien qué estoy evitando",
  "rec.fdo-people-places-things.todo.3": "Poner una reunión en mi calendario",
  "rec.fdo-people-places-things.todo.4": "Guardar el número al que llamaría en su lugar",
  "rec.fdo-people-places-things.toolkitLabel": "Mi plan de gente y lugares",
};

/**
 * The review record for the Spanish lesson bodies — same discipline as the
 * `verified: false` content flags used elsewhere in this build.
 */
export const RECOVERY_ES_REVIEW = {
  scope: "Module 1 (My First Days Out) — Spanish lesson body content",
  /** First-pass translation. NOT reviewed by a native/professional translator. */
  reviewed: false,
  reviewedBy: undefined as string | undefined,
  note: "Module names, missions, subtitles and short UI strings are treated as directly usable. Lesson prose, activity copy and tool-flow option labels are a first pass pending review.",
} as const;
