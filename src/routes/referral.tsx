import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HealthieService, useHealthie, type ReferralStatus } from "@/lib/healthie";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, MessageSquare, Send } from "lucide-react";
import { ClientDate } from "@/components/ClientDate";

export const Route = createFileRoute("/referral")({
  head: () => ({
    meta: [
      { title: "Referral Portal — Adelante" },
      {
        name: "description",
        content:
          "Refer a recently released individual to Adelante. Auto-welcome SMS within 5 minutes.",
      },
    ],
  }),
  component: ReferralPage,
});

const statusOrder: ReferralStatus[] = ["submitted", "contacted", "enrolled"];

const statusStyles: Record<ReferralStatus, string> = {
  submitted: "bg-gold/30 text-navy",
  contacted: "bg-teal/20 text-teal",
  enrolled: "bg-success/20 text-success",
};

function ReferralPage() {
  const referrals = useHealthie(() => HealthieService.listReferrals());

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    phone: "",
    email: "",
    releaseDate: "",
    referringAgency: "Kings County Probation",
    referrerName: "",
    pendingCharges: "",
    priorBhRecords: "",
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.phone || !form.releaseDate) {
      toast.error("Please complete required fields");
      return;
    }
    const r = HealthieService.createReferral(form);
    toast.success(`Referral submitted for ${r.firstName} ${r.lastName}`, {
      description: "Welcome SMS dispatched via Twilio (mock) — < 5 min SLA",
    });
    setForm({
      firstName: "",
      lastName: "",
      dob: "",
      phone: "",
      email: "",
      releaseDate: "",
      referringAgency: form.referringAgency,
      referrerName: form.referrerName,
      pendingCharges: "",
      priorBhRecords: "",
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <header className="mb-6">
        <div className="text-xs font-medium uppercase tracking-wider text-teal">
          Referral Partner Portal
        </div>
        <h1 className="font-display text-3xl text-navy mt-1">Refer someone to care</h1>
        <p className="text-muted-foreground mt-1">
          For probation officers, drug court case managers, parole agents, and correctional health staff.
        </p>
      </header>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Form */}
        <Card className="lg:col-span-3 p-6">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="First name *">
                <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </Field>
              <Field label="Last name *">
                <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </Field>
              <Field label="Date of birth">
                <Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
              </Field>
              <Field label="Phone *">
                <Input type="tel" placeholder="+1 555 555 0100" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="Email (optional)">
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label="Release date *">
                <Input type="date" value={form.releaseDate} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} />
              </Field>
              <Field label="Referring agency">
                <Input value={form.referringAgency} onChange={(e) => setForm({ ...form, referringAgency: e.target.value })} />
              </Field>
              <Field label="Your name">
                <Input value={form.referrerName} onChange={(e) => setForm({ ...form, referrerName: e.target.value })} />
              </Field>
            </div>
            <Field label="Pending charges (non-SUD detail only — see 42 CFR Part 2)">
              <Textarea
                rows={2}
                value={form.pendingCharges}
                onChange={(e) => setForm({ ...form, pendingCharges: e.target.value })}
              />
            </Field>
            <Field label="Prior behavioral-health records / notes">
              <Textarea
                rows={3}
                value={form.priorBhRecords}
                onChange={(e) => setForm({ ...form, priorBhRecords: e.target.value })}
              />
            </Field>

            <div className="rounded-lg bg-secondary/60 p-4 text-xs text-muted-foreground flex gap-3 items-start">
              <MessageSquare className="h-4 w-4 text-teal mt-0.5 shrink-0" />
              <div>
                Submitting will automatically dispatch a welcome SMS via Twilio
                within 5 minutes. SUD-related details require the patient's
                42 CFR Part 2 consent — collected during intake.
              </div>
            </div>

            <Button type="submit" size="lg" className="bg-navy text-navy-foreground hover:bg-navy/90 w-full sm:w-auto">
              <Send className="h-4 w-4 mr-2" />
              Submit referral
            </Button>
          </form>
        </Card>

        {/* Status tracker */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="font-display text-lg text-navy">Referral status</h2>
          {referrals.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-navy">
                    {r.firstName} {r.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.referringAgency} · <ClientDate value={r.createdAt} />
                  </div>
                </div>
                <Badge className={`${statusStyles[r.status]} capitalize border-0`}>
                  {r.status}
                </Badge>
              </div>
              <div className="mt-3 flex gap-1.5">
                {statusOrder.map((s, i) => {
                  const reached = statusOrder.indexOf(r.status) >= i;
                  return (
                    <div
                      key={s}
                      className={`h-1.5 flex-1 rounded-full ${reached ? "bg-teal" : "bg-border"}`}
                    />
                  );
                })}
              </div>
              {r.smsSentAt && (
                <div className="mt-2 text-xs text-success flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Welcome SMS delivered
                </div>
              )}
              {r.status !== "enrolled" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => HealthieService.advanceReferral(r.id)}
                >
                  Advance to {r.status === "submitted" ? "contacted" : "enrolled"}
                </Button>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}