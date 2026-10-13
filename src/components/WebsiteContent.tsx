import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Brain, Video, HandHeart, ClipboardList, Sunrise, Users, HeartHandshake, ShieldCheck } from "lucide-react";

export function WebsiteClosing() {
 const { t } = useI18n();
 return (<>
      {/* Closing CTA */}
      <section className="website-closing relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, var(--navy) 0%, color-mix(in oklab, var(--teal) 70%, var(--navy)) 100%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-5 sm:px-8 py-20 text-center text-navy-foreground">
          <Sunrise aria-hidden="true" className="h-9 w-9 text-gold mx-auto" />
          <h2 className="website-heading mt-5">{t("websiteReady")}</h2>
          <p className="mt-4 text-lg leading-relaxed">{t("websiteReadyBody")}</p>
          <Button
            asChild
            size="lg"
            className="mt-8 h-12 px-7 text-base"
          >
            <Link to="/start/signup">
              {t("websiteStart")}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="mt-4 sm:mt-8 sm:ml-3 min-h-12 h-auto whitespace-normal py-3 border-navy-foreground/40 bg-transparent text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground"><Link to="/advocate">{t("websiteHelp")}</Link></Button>
        </div>
      </section>

 </>);
}

export function WebsiteAbout() {
 const { t } = useI18n();
 return (<div data-testid="website-about">
      <section id="about" className="border-y bg-secondary/40 scroll-mt-40">
        <div data-testid="website-mission-grid" className="mx-auto max-w-7xl px-5 sm:px-8 py-16 sm:py-20 grid gap-10 lg:grid-cols-2 items-start">
          <div><h1 className="website-heading">{t("websiteAbout")}</h1>
          <p className="mt-6 max-w-[70ch] text-lg leading-relaxed text-foreground">{t("websiteMission")}</p></div>
          <ul className="grid gap-4" aria-label={t("websiteAbout")}>
            {(["websiteHighlightCare", "websiteHighlightWalls", "websiteHighlightDays"] as const).map((key) => <li key={key} className="rounded-lg border bg-card p-6 flex items-center gap-4"><ShieldCheck aria-hidden="true" className="size-6 shrink-0 text-primary" /><p className="font-semibold text-primary">{t(key)}</p></li>)}
          </ul>
        </div>
      </section>

      <section id="partners" className="mx-auto max-w-7xl px-5 sm:px-8 py-16 sm:py-20 scroll-mt-40">
        <h2 className="website-heading mt-5">{t("websitePartnersHeading")}</h2>
        <p className="mt-4 max-w-[70ch] text-lg leading-relaxed text-foreground">{t("websitePartnersBody")}</p>
        <Button asChild className="mt-6 min-h-12 h-auto whitespace-normal py-3"><Link to="/referral">{t("websiteReferral")}<ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link></Button>
      </section>

<div className="mx-auto max-w-7xl px-5 sm:px-8 pb-16">
          <p data-testid="website-privacy" className="mt-8 flex max-w-[70ch] gap-3 text-base leading-relaxed text-foreground">
            <ShieldCheck aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-teal" />{t("websitePrivacyLine")}
          </p>
</div><WebsiteClosing /></div>);
}

export function WebsiteTeam() {
 const { t } = useI18n();
 return (<div data-testid="website-team">
      <section id="team" className="mx-auto max-w-7xl px-5 sm:px-8 py-16 sm:py-20 scroll-mt-40">
        <h1 className="website-heading">{t("websiteTeam")}</h1>
        <p className="mt-4 max-w-[70ch] text-lg leading-relaxed text-muted-foreground">{t("websiteTeamIntro")}</p>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {([
            { title: "websiteCareTeam", roles: [[Brain, "websiteClinicians", "websiteCliniciansBody"], [Video, "websitePsychiatry", "websitePsychiatryBody"], [HandHeart, "websiteRecovery", "websiteRecoveryBody"]] },
            { title: "websiteNavigationTeam", roles: [[ClipboardList, "websiteCoordinators", "websiteCoordinatorsBody"], [Sunrise, "websiteReentry", "websiteReentryBody"]] },
            { title: "websiteResourceTeam", roles: [[Users, "websiteResources", "websiteResourcesBody"]] },
            { title: "websiteAdvocateTeam", roles: [[HeartHandshake, "websiteAdvocates", "websiteAdvocatesBody"]] },
          ] as const).map((team) => <Card key={team.title} className="p-6 sm:p-8 border-border/60">
            <h2 className="website-heading">{t(team.title)}</h2>
            <ul className="mt-6 space-y-6">
              {team.roles.map(([Icon, title, body]) => <li key={title} className="flex gap-3">
                <Icon aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-primary" />
                <p className="leading-relaxed"><strong className="font-semibold">{t(title)}:</strong> {t(body)}</p>
              </li>)}
            </ul>
          </Card>)}
        </div>
      </section>

<div className="mx-auto max-w-7xl px-5 sm:px-8 pb-16"><Link to="/" hash="find-your-fit" hashScrollIntoView={{ behavior: "smooth", block: "start" }} className="inline-flex min-h-12 items-center gap-2 text-primary underline">{t("websiteFitNav")}<ArrowRight aria-hidden="true" className="h-5 w-5" /></Link></div><WebsiteClosing /></div>);
}
