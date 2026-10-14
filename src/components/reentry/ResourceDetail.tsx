// §Adelante Journey sync Build B — the org detail screen.
//
// DIRECTIONS ARE HONEST. Nobody has geocoded this directory, so
// `lat`/`lng` are empty on every entry and we refuse to invent a point. The
// button opens a maps SEARCH for the address string we actually confirmed,
// and it disappears entirely for countywide / confidential-location entries
// where there is no address to search.
import { useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bookmark,
  BookmarkCheck,
  Clock,
  Globe,
  MapPin,
  Navigation,
  Phone,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PatientPage, PatientPageHeader } from "@/components/patient/PatientPage";
import { EmptyState } from "@/components/EmptyState";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import {
  RESOURCE_CATEGORIES,
  directionsUrl,
  patientBrowsableResource,
  subscribeResources,
} from "@/lib/communityResources";
import { isResourceSaved, subscribeSelfTracking, toggleSavedResource } from "@/lib/selfTracking";
import type { ResourceSurface } from "@/components/reentry/ResourceCard";
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.516d895bf73c": {
    "en": "This listing isn't available",
    "es": "Este lugar no está disponible"
  },
  "ui.9bf8b7e6c623": {
    "en": "Back to resources",
    "es": "Volver a recursos"
  },
  "ui.be79cc83f91c": {
    "en": "All resources",
    "es": "Todos los recursos"
  },
  "ui.291a0a58dfa6": {
    "en": "Call",
    "es": "Llamar"
  },
  "ui.2e8a57cc5c47": {
    "en": "Website",
    "es": "Sitio web"
  },
  "ui.f814a9fb4687": {
    "en": "Directions",
    "es": "Direcciones"
  },
  "ui.c0ae8f6ea841": {
    "en": "Saved",
    "es": "Guardado"
  },
  "ui.efc007a393f6": {
    "en": "Save",
    "es": "Guardar"
  },
  "ui.d6f519fc0c3f": {
    "en": "No street address to map — this one is reached by phone or online.",
    "es": "No hay una dirección para mostrar en el mapa. Puedes comunicarte por teléfono o en línea."
  },
  "ui.48a6796b6c25": {
    "en": "Ask Adel about",
    "es": "Pregúntale a Adel sobre"
  },
  "ui.126646707f74": {
    "en": "Someone on our team called this organisation and confirmed the address, phone and hours above. Details can still change after a call — and listings that are still waiting on that confirmation aren't shown here yet, so this isn't the whole list of help nearby. Ask your care team if you can't find what you need.",
    "es": "Nuestro equipo llamó a este lugar y confirmó la dirección, el teléfono y los horarios. Los datos pueden cambiar. Solo mostramos lugares confirmados, así que esta no es toda la ayuda cercana. Pregunta a tu equipo si no encuentras lo que necesitas."
  }
} as const;


export function ResourceDetail({
  orgId,
  surface = "patient",
}: {
  orgId: string;
  surface?: ResourceSurface;
}) {
  const { lang: screenLang } = useI18n();

  const patientId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const snapshot = useSyncExternalStore(
    subscribeResources,
    () => JSON.stringify(patientBrowsableResource(orgId) ?? null),
    () => "null",
  );
  const savedKey = useSyncExternalStore(
    subscribeSelfTracking,
    () => String(isResourceSaved(patientId, orgId)),
    () => "false",
  );
  const r = JSON.parse(snapshot) as ReturnType<typeof patientBrowsableResource>;
  const saved = savedKey === "true";

  if (!r) {
    return (
      <PatientPage width="reading" data-testid="resource-detail-missing">
        <EmptyState
          icon={MapPinFallback}
          title={SCREEN_COPY["ui.516d895bf73c"][screenLang]}
          description="It may have been taken down. Your care team can connect you directly."
        />
        <Button asChild variant="outline" size="patient">
          {surface === "advocate" ? (
            <Link to="/advocate/resources">{SCREEN_COPY["ui.9bf8b7e6c623"][screenLang]}</Link>
          ) : (
            <Link to="/resources">{SCREEN_COPY["ui.9bf8b7e6c623"][screenLang]}</Link>
          )}
        </Button>
      </PatientPage>
    );
  }

  const category = RESOURCE_CATEGORIES.find((c) => c.id === r.categoryId);
  const directions = directionsUrl(r);
  const tel = r.phone.replace(/[^\d+]/g, "");

  return (
    <PatientPage width="reading" data-testid="resource-detail">
      <PatientPageHeader icon={MapPin} title={r.name} lede={r.description} />

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {category && <span className="rounded-full bg-secondary px-3 py-1">{category.name}</span>}
        {surface === "advocate" ? (
          <Link to="/advocate/resources" className="underline">
            {SCREEN_COPY["ui.be79cc83f91c"][screenLang]} </Link>
        ) : (
          <Link to="/resources" className="underline">
            {SCREEN_COPY["ui.be79cc83f91c"][screenLang]} </Link>
        )}
      </div>

      <Card className="space-y-3 p-5">
        <Fact icon={MapPin} label="Address" value={r.address} />
        <Fact icon={Phone} label="Phone" value={r.phone} />
        <Fact icon={Clock} label="Hours" value={r.hours} />
        {r.website && <Fact icon={Globe} label="Website" value={r.website} />}

        <div className="flex flex-wrap gap-2 pt-1">
          {tel && (
            <Button asChild size="patient" data-testid="detail-call">
              <a href={`tel:${tel}`}>
                <Phone className="mr-1 h-4 w-4" aria-hidden="true" /> {SCREEN_COPY["ui.291a0a58dfa6"][screenLang]} </a>
            </Button>
          )}
          {r.website && (
            <Button asChild size="patient" variant="outline" data-testid="detail-website">
              <a href={r.website} target="_blank" rel="noreferrer noopener">
                <Globe className="mr-1 h-4 w-4" aria-hidden="true" /> {SCREEN_COPY["ui.2e8a57cc5c47"][screenLang]} </a>
            </Button>
          )}
          {directions && (
            <Button asChild size="patient" variant="outline" data-testid="detail-directions">
              <a href={directions} target="_blank" rel="noreferrer noopener">
                <Navigation className="mr-1 h-4 w-4" aria-hidden="true" /> {SCREEN_COPY["ui.f814a9fb4687"][screenLang]} </a>
            </Button>
          )}
          {/* Saving is patient-scoped (`savedResourceIds(patientId)`), and the
              advocate surface has no patient of its own — for a dual-role
              advocate it would silently write into THEIR OWN record while they
              browse on someone else's behalf, and the Saved list is hidden
              here anyway. So the action only exists on the patient surface. */}
          {surface === "patient" && (
            <Button
              type="button"
              size="patient"
              variant="outline"
              aria-pressed={saved}
              data-testid="detail-save"
              onClick={() => toggleSavedResource(patientId, r.id)}
            >
              {saved ? (
                <>
                  <BookmarkCheck className="mr-1 h-4 w-4" aria-hidden="true" /> {SCREEN_COPY["ui.c0ae8f6ea841"][screenLang]} </>
              ) : (
                <>
                  <Bookmark className="mr-1 h-4 w-4" aria-hidden="true" /> {SCREEN_COPY["ui.efc007a393f6"][screenLang]} </>
              )}
            </Button>
          )}
        </div>
        {!directions && (
          <p className="text-xs text-muted-foreground">
            {SCREEN_COPY["ui.d6f519fc0c3f"][screenLang]} </p>
        )}
      </Card>

      {surface === "patient" && (
        <Button asChild variant="outline" size="patient" data-testid="detail-ask-adel">
          <Link to="/adel" search={{ resource: r.id }}>
            <Sparkles className="mr-1 h-4 w-4" aria-hidden="true" /> {SCREEN_COPY["ui.48a6796b6c25"][screenLang]} {r.name}
          </Link>
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        {SCREEN_COPY["ui.126646707f74"][screenLang]} </p>
    </PatientPage>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

const MapPinFallback = MapPin;
