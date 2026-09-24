// E3 (honest version) — replaces the old "a case manager can do this with
// you by phone" promise. Adel can EXPLAIN questions; it cannot fill in intake,
// so the wording never implies it does.
import { Link } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

export function AskAdelHelp({ className }: { className?: string }) {
  const { t, lang } = useI18n();
  return (
    <div className={className} data-testid="ask-adel-help">
      <div className="flex flex-wrap items-center gap-1.5">
        <MessageSquare className="h-4 w-4 text-teal" />
        <span>{t("askAdelHelpLine")}</span>
        <Link to="/adel" className="font-medium text-teal underline underline-offset-2">
          {t("askAdelHelpLink")}
        </Link>
        {lang === "es" && (
          <Badge variant="outline" className="text-[10px]">
            {t("esPendingReviewBadge")}
          </Badge>
        )}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{t("askAdelHelpNote")}</p>
    </div>
  );
}
