// §Custody handoffs — facility address + primary contact, inline.
//
// Booking History and Housing Moves used to print only the facility name,
// which forced clinicians to open the admin facility page mid-handoff.
// This cell renders the same normalized Facility record's postal address
// and coordination contact directly in the table.
import {
  AdelanteEHR,
  useEhr,
  facilityAddressLine,
  facilityKindLabel,
} from "@/lib/ehr";
import { Mail, MapPin, Phone, User } from "lucide-react";

interface Props {
  facilityId?: string;
  /** Name recorded on the row; used when the facility record is missing. */
  facilityName: string;
}

export function FacilityContactCell({ facilityId, facilityName }: Props) {
  const facility = useEhr(() => AdelanteEHR.getFacility(facilityId));
  const address = facility ? facilityAddressLine(facility) : undefined;
  const contactLine = [facility?.contactName, facility?.contactTitle]
    .filter(Boolean)
    .join(" · ");
  const contactReach = [facility?.contactPhone, facility?.contactEmail].filter(Boolean);

  return (
    <div className="min-w-[12rem] space-y-0.5">
      <div className="font-medium">{facility?.name ?? facilityName}</div>
      {facility && (
        <div className="text-xs text-muted-foreground">{facilityKindLabel(facility.kind)}</div>
      )}
      {address && (
        <div className="flex items-start gap-1 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <span>{address}</span>
        </div>
      )}
      {facility?.phone && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Phone className="h-3 w-3 shrink-0" aria-hidden />
          <span>{facility.phone}</span>
        </div>
      )}
      {contactLine && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <User className="h-3 w-3 shrink-0" aria-hidden />
          <span>{contactLine}</span>
        </div>
      )}
      {contactReach.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Mail className="h-3 w-3 shrink-0" aria-hidden />
          <span>{contactReach.join(" · ")}</span>
        </div>
      )}
      {facility && !address && !facility.phone && !contactLine && contactReach.length === 0 && (
        <div className="text-xs text-muted-foreground">No address or contact on file.</div>
      )}
    </div>
  );
}
