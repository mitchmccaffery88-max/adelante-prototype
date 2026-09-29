// §Batch E — shown when a sign-up exactly matches an existing record. The text
// is the same whether or not a record exists: it never names, confirms or
// describes another record. A staff review item is created behind the scenes.
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function SignupVerificationHelp({ onBack }: { onBack: () => void }) {
  return (
    <Card className="space-y-3 p-6" role="status" data-testid="signup-verification-help">
      <p className="font-display text-lg text-navy">It looks like you may already have an account.</p>
      <p className="text-sm text-muted-foreground">
        To keep your information private, we can't create a second account or share details here. Try signing in, or ask
        for help to verify who you are.
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>Forgot how you sign in? Use "Sign in" and choose "Get help signing in".</li>
        <li>Call the front desk and we'll verify your identity with you.</li>
        <li>A team member will also review this and may reach out.</li>
      </ul>
      <p className="text-sm text-muted-foreground">
        Si necesita ayuda en español, llame a la recepción. <span className="text-xs">(Borrador — pendiente de revisión bilingüe)</span>
      </p>
      <Button variant="outline" onClick={onBack}>Back</Button>
    </Card>
  );
}
