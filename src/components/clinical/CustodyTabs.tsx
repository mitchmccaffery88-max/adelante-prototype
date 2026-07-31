// §Custody tracking — patient-scoped Booking History + Housing Moves.
//
// Ported from BaggaEMR's custody pages. Both tabs are gated on the
// `custody_tracking` record class; `readOnly` collapses the add forms but
// never the history, because custody history is context every clinical role
// needs even when they cannot edit it.
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr, type Booking } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClientDate } from "@/components/ClientDate";

const DAY_MS = 86400_000;

/** Length of stay in days, inclusive of the booking day (reference parity). */
export function lengthOfStayDays(booking: Booking, now: Date = new Date()): number {
  const end = booking.releasedAt ? new Date(booking.releasedAt) : now;
  const start = new Date(booking.bookedAt);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS));
}

const dateOnly = { year: "numeric", month: "short", day: "numeric" } as const;

export function BookingsTab({ patientId, readOnly }: { patientId: string; readOnly?: boolean }) {
  const { staffName } = useActingStaff();
  const bookings = useEhr(() => AdelanteEHR.listBookings(patientId));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    bookingNumber: "",
    facilityName: "",
    bookedAt: "",
    bookingReason: "",
  });

  const submit = () => {
    try {
      AdelanteEHR.addBooking(patientId, form, staffName);
      toast.success("Booking recorded.");
      setForm({ bookingNumber: "", facilityName: "", bookedAt: "", bookingReason: "" });
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const release = (b: Booking) => {
    try {
      AdelanteEHR.closeBooking(b.id, new Date().toISOString(), staffName);
      toast.success(`Booking ${b.bookingNumber} marked released.`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Booking episodes at partner custody facilities. Facility is free text — Adelante has no
          Facility entity yet, so cross-facility rollups are not available.
        </p>
        {!readOnly && (
          <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
            {open ? "Cancel" : "Add booking"}
          </Button>
        )}
      </div>

      {open && !readOnly && (
        <Card className="grid gap-3 p-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Booking #</Label>
            <Input
              value={form.bookingNumber}
              onChange={(e) => setForm({ ...form, bookingNumber: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Facility</Label>
            <Input
              value={form.facilityName}
              onChange={(e) => setForm({ ...form, facilityName: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Booked date</Label>
            <Input
              type="date"
              value={form.bookedAt.slice(0, 10)}
              onChange={(e) =>
                setForm({
                  ...form,
                  bookedAt: e.target.value ? new Date(`${e.target.value}T08:00`).toISOString() : "",
                })
              }
            />
          </div>
          <div>
            <Label className="text-xs">Reason (optional)</Label>
            <Input
              value={form.bookingReason}
              onChange={(e) => setForm({ ...form, bookingReason: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Button size="sm" onClick={submit}>
              Save booking
            </Button>
          </div>
        </Card>
      )}

      {bookings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No bookings recorded.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Booking #</TableHead>
              <TableHead>Facility</TableHead>
              <TableHead>Booked</TableHead>
              <TableHead>Released</TableHead>
              <TableHead>Length of stay</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.bookingNumber}</TableCell>
                <TableCell>{b.facilityName}</TableCell>
                <TableCell>
                  <ClientDate value={b.bookedAt} options={dateOnly} />
                </TableCell>
                <TableCell>
                  {b.releasedAt ? <ClientDate value={b.releasedAt} options={dateOnly} /> : "—"}
                </TableCell>
                <TableCell>{lengthOfStayDays(b)} d</TableCell>
                <TableCell>{b.bookingReason ?? "—"}</TableCell>
                <TableCell>
                  {b.releasedAt ? (
                    <Badge variant="outline">Released</Badge>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Badge>Current</Badge>
                      {!readOnly && (
                        <Button size="sm" variant="ghost" onClick={() => release(b)}>
                          Record release
                        </Button>
                      )}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export function HousingMovesTab({ patientId, readOnly }: { patientId: string; readOnly?: boolean }) {
  const { staffName } = useActingStaff();
  const bookings = useEhr(() => AdelanteEHR.listBookings(patientId));
  const moves = useEhr(() => AdelanteEHR.listHousingMoves(patientId));
  const byBooking = useMemo(() => new Map(bookings.map((b) => [b.id, b])), [bookings]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    bookingId: "",
    movedAt: "",
    facilityName: "",
    housingUnit: "",
    reason: "",
  });

  const submit = () => {
    try {
      AdelanteEHR.addHousingMove(patientId, form, staffName);
      toast.success("Housing move recorded.");
      setForm({ bookingId: "", movedAt: "", facilityName: "", housingUnit: "", reason: "" });
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Unit moves within a booking episode.
        </p>
        {!readOnly && bookings.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
            {open ? "Cancel" : "Add move"}
          </Button>
        )}
      </div>

      {open && !readOnly && (
        <Card className="grid gap-3 p-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Booking</Label>
            <Select
              value={form.bookingId}
              onValueChange={(v) => setForm({ ...form, bookingId: v })}
            >
              <SelectTrigger aria-label="Booking">
                <SelectValue placeholder="Select booking" />
              </SelectTrigger>
              <SelectContent>
                {bookings.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.bookingNumber} · {b.facilityName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Move date</Label>
            <Input
              type="date"
              value={form.movedAt.slice(0, 10)}
              onChange={(e) =>
                setForm({
                  ...form,
                  movedAt: e.target.value ? new Date(`${e.target.value}T08:00`).toISOString() : "",
                })
              }
            />
          </div>
          <div>
            <Label className="text-xs">Housing unit</Label>
            <Input
              value={form.housingUnit}
              onChange={(e) => setForm({ ...form, housingUnit: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Reason (optional)</Label>
            <Input
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Button size="sm" onClick={submit}>
              Save move
            </Button>
          </div>
        </Card>
      )}

      {moves.length === 0 ? (
        <p className="text-sm text-muted-foreground">No housing moves recorded.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Booking #</TableHead>
              <TableHead>Facility</TableHead>
              <TableHead>Housing unit</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {moves.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <ClientDate value={m.movedAt} options={dateOnly} />
                </TableCell>
                <TableCell className="font-medium">
                  {byBooking.get(m.bookingId)?.bookingNumber ?? "—"}
                </TableCell>
                <TableCell>{m.facilityName}</TableCell>
                <TableCell>{m.housingUnit}</TableCell>
                <TableCell>{m.reason ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
