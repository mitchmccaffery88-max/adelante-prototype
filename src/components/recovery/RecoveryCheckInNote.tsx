// §B7 — optional private text box under the recovery check-in question.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { RECOVERY_NOTE_MAX, myRecoveryCheckInNote, saveRecoveryCheckInNote } from "@/lib/recoveryCheckInNotes";

const COPY = {
  en: {
    label: "Want to add anything? (optional, private)",
    share: "Share with my care team",
    shareHint: "Only care team members allowed by your privacy choices can see it.",
    save: "Save",
    saved: "Saved — only you can see this.",
    savedShared: "Saved and shared with your care team.",
    danger: "If you're in danger right now, tap",
    help: "I need help now",
  },
  es: {
    label: "¿Quiere agregar algo? (opcional, privado)",
    share: "Compartir con mi equipo de cuidado",
    shareHint: "Solo lo verán las personas de su equipo que sus opciones de privacidad permitan.",
    save: "Guardar",
    saved: "Guardado — solo usted puede verlo.",
    savedShared: "Guardado y compartido con su equipo.",
    danger: "Si está en peligro ahora mismo, toque",
    help: "Necesito ayuda ahora",
  },
};

export function RecoveryCheckInNote({ patientId, lessonId }: { patientId: string; lessonId: string }) {
  const { lang } = useI18n();
  const c = lang === "es" ? COPY.es : COPY.en;
  const prev = myRecoveryCheckInNote(patientId, lessonId);
  const [text, setText] = useState(prev?.text ?? "");
  const [shared, setShared] = useState(prev?.shared ?? false);
  return (
    <div className="mt-3 space-y-2 rounded-lg border p-3" data-testid="recovery-checkin-note">
      <label className="block text-sm font-medium">
        {c.label}
        <Textarea
          aria-label={c.label}
          maxLength={RECOVERY_NOTE_MAX}
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="mt-1"
        />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1 h-4 w-4" checked={shared} onChange={(e) => setShared(e.target.checked)} />
        <span>
          {c.share}
          <span className="block text-xs text-muted-foreground">{c.shareHint}</span>
        </span>
      </label>
      <p className="text-xs text-muted-foreground">
        {c.danger}{" "}
        <Link to="/crisis" className="font-medium underline">
          {c.help}
        </Link>
        .
      </p>
      <Button
        size="sm"
        variant="outline"
        disabled={!text.trim()}
        onClick={() => {
          saveRecoveryCheckInNote({ patientId, lessonId, text, shared });
          toast.success(shared ? c.savedShared : c.saved);
        }}
      >
        {c.save}
      </Button>
    </div>
  );
}
