import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function MessagesTabs({ active }: { active: "patients" | "team" }) {
  return (
    <div className="flex gap-1.5" role="tablist" aria-label="Messages">
      <Button asChild size="sm" variant={active === "patients" ? "default" : "outline"}><Link to="/message-queue" role="tab" aria-selected={active === "patients"}>Patients</Link></Button>
      <Button asChild size="sm" variant={active === "team" ? "default" : "outline"}><Link to="/team-messages" search={{ thread: undefined }} role="tab" aria-selected={active === "team"}>Team</Link></Button>
    </div>
  );
}

