// §Facility & Custody reorg — the de-emphasized secondary section of the
// Population Health dashboard.
//
// Rendered ONLY for roles that clear `custody_tracking`; the parent computes
// nothing when the gate fails, so a role without facility access never
// receives this data — it is not a hidden div.
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdelanteEHR } from "@/lib/ehr";

export type FacilityBookingStat = ReturnType<typeof AdelanteEHR.facilityBookingStats>[number];

export function FacilityCustodySection({
  stats,
  shiftCounts,
}: {
  stats: FacilityBookingStat[];
  shiftCounts: number;
}) {
  const bookings = stats.reduce((n, s) => n + s.bookings, 0);
  const current = stats.reduce((n, s) => n + s.currentlyBooked, 0);
  const moves = stats.reduce((n, s) => n + s.housingMoves, 0);

  return (
    <section aria-labelledby="facility-custody-heading" className="pt-2">
      <div className="mb-2 flex items-center gap-2">
        <h2
          id="facility-custody-heading"
          className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          Facility &amp; custody
        </h2>
        <Badge variant="outline" className="text-[10px]">
          Secondary
        </Badge>
      </div>
      <Card className="bg-muted/30 p-4">
        <p className="text-xs text-muted-foreground">
          Custody-site volume, referenced far less often than the outpatient program metrics
          above. Booking counts are episodes, not people.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Booking episodes", value: bookings },
            { label: "Currently booked", value: current },
            { label: "Housing moves", value: moves },
            { label: "Locked shift counts", value: shiftCounts },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-lg font-semibold text-navy">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
        {stats.length > 0 && (
          <Table className="mt-3">
            <TableHeader>
              <TableRow>
                <TableHead>Facility</TableHead>
                <TableHead className="text-right">Bookings</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Housing moves</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((s) => (
                <TableRow key={s.facility.id}>
                  <TableCell>{s.facility.name}</TableCell>
                  <TableCell className="text-right">{s.bookings}</TableCell>
                  <TableCell className="text-right">{s.currentlyBooked}</TableCell>
                  <TableCell className="text-right">{s.housingMoves}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </section>
  );
}