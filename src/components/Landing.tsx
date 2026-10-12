import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowRight,
  Phone,
  Video,
  Brain,
  HandHeart,
  ClipboardList,
  Smartphone,
  ShieldCheck,
  HeartHandshake,
  Sparkles,
  Sunrise,
  Users,
  MessageCircle,
} from "lucide-react";
import heroImg from "@/assets/hero-sunrise.jpg";
import "./website.css";

export function Landing() {
  const { t, lang } = useI18n();
  useEffect(() => {
    const redirectLegacy = () => {
      if (window.location.hash !== "#who-its-for") return;
      window.history.replaceState(window.history.state, "", "#find-your-fit");
      document.getElementById("find-your-fit")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    };
    redirectLegacy();
    window.addEventListener("hashchange", redirectLegacy);
    return () => window.removeEventListener("hashchange", redirectLegacy);
  }, []);
  useEffect(() => {
    document.title = t("websiteTitle");
    for (const attr of ["name", "property"]) {
      for (const key of ["description", "og:title", "og:description", "twitter:title", "twitter:description"]) {
        document.querySelector(`meta[${attr}="${key}"]`)?.setAttribute("content", t(key.endsWith("title") ? "websiteTitle" : "websiteDescription"));
      }
    }
  }, [lang, t]);
  return (
    <div className="bg-background" data-testid="public-landing">
      {lang === "es" && <p className="border-b px-5 py-2 text-sm text-muted-foreground text-center">{t("websiteDraft")}</p>}
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImg}
            alt={t("websiteHeroAlt")}
            width={1920}
            height={1080}
            className="h-full w-full object-cover"
          />
          {/* Illustrated brand-gradient fallback layer (visible if image fails to load) */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{
              background:
                "linear-gradient(135deg, var(--navy) 0%, var(--teal) 55%, var(--gold) 100%)",
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(100deg, color-mix(in oklab, var(--navy) 78%, transparent) 0%, color-mix(in oklab, var(--navy) 35%, transparent) 55%, transparent 100%)",
            }}
          />
        </div>

        <div className="relative mx-auto max-w-7xl px-5 sm:px-8 py-20 sm:py-28 lg:py-36">
          <div className="max-w-2xl text-navy-foreground">
            <span className="inline-flex items-center gap-2 rounded-full bg-navy-foreground/15 backdrop-blur px-3 py-1 text-xs font-medium">
              <Sunrise className="h-3.5 w-3.5 text-gold" />{t("websiteHeroEyebrow")}
            </span>
            <p className="mt-5 font-display text-2xl">{t("websiteBrand")}</p>
            <h1 className="mt-3 font-display text-5xl sm:text-6xl lg:text-7xl leading-[1.05] tracking-normal">
              {t("websiteHeroHeading")}
            </h1>
            <p className="mt-5 text-lg sm:text-xl text-navy-foreground/90 max-w-xl">
              {t("websiteHeroBody")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="h-12 px-6 text-base bg-gold text-gold-foreground hover:bg-gold/90"
              >
                <Link to="/start/signup">
                  {t("websiteStart")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 px-6 text-base bg-transparent border-navy-foreground/40 text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground"
              >
                <Link to="/advocate">{t("websiteHelp")}</Link>
              </Button>
            </div>
            <p className="mt-5 text-sm text-navy-foreground/80">
              {t("websiteHeroNote")}
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-7xl px-5 sm:px-8 py-20 scroll-mt-40">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-display text-4xl sm:text-5xl text-navy">{t("websiteHow")}</h2>
          <p className="mt-3 text-lg text-muted-foreground">
            {t("websiteHowIntro")}
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            {
              n: "1",
              icon: Phone,
              title: t("websiteConnect"),
              // E3 — Adel explains questions; it never fills intake in.
              body: t("landingConnectBody"),
            },
            {
              n: "2",
              icon: ClipboardList,
              title: t("websitePlan"),
              body: t("websitePlanBody"),
            },
            {
              n: "3",
              icon: ArrowRight,
              title: t("websiteForward"),
              body: t("websiteForwardBody"),
            },
          ].map((s) => (
            <Card
              key={s.n}
              className="p-7 border-border/60 shadow-none hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-teal/15 text-teal grid place-items-center">
                  <s.icon className="h-5 w-5" />
                </div>
                <span className="font-display text-2xl text-navy/40">{s.n}</span>
              </div>
              <h3 className="mt-4 font-display text-2xl text-navy">{s.title}</h3>
              <p className="mt-2 text-base text-foreground/75 leading-relaxed">{s.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section id="about" className="border-y bg-secondary/40 scroll-mt-40">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 py-16 sm:py-20">
          <h2 className="font-display text-3xl sm:text-4xl text-primary">{t("websiteAbout")}</h2>
          <p className="mt-6 max-w-[70ch] text-lg leading-relaxed text-foreground/85">{t("websiteMission")}</p>
          <blockquote className="mt-8 border-l-4 border-primary pl-5 font-display text-2xl sm:text-3xl text-primary">“{t("websiteQuote")}”</blockquote>
        </div>
      </section>

      <section id="team" className="mx-auto max-w-7xl px-5 sm:px-8 py-16 sm:py-20 scroll-mt-40">
        <h2 className="font-display text-3xl sm:text-4xl text-primary">{t("websiteTeam")}</h2>
        <p className="mt-4 max-w-[70ch] text-lg leading-relaxed text-muted-foreground">{t("websiteTeamIntro")}</p>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {([
            { title: "websiteCareTeam", roles: [[Brain, "websiteClinicians", "websiteCliniciansBody"], [Video, "websitePsychiatry", "websitePsychiatryBody"], [HandHeart, "websiteRecovery", "websiteRecoveryBody"]] },
            { title: "websiteNavigationTeam", roles: [[ClipboardList, "websiteCoordinators", "websiteCoordinatorsBody"], [Sunrise, "websiteReentry", "websiteReentryBody"]] },
            { title: "websiteResourceTeam", roles: [[Users, "websiteResources", "websiteResourcesBody"]] },
            { title: "websiteAdvocateTeam", roles: [[HeartHandshake, "websiteAdvocates", "websiteAdvocatesBody"]] },
          ] as const).map((team) => <Card key={team.title} className="p-6 sm:p-8 border-border/60">
            <h3 className="font-display text-xl text-primary">{t(team.title)}</h3>
            <ul className="mt-6 space-y-6">
              {team.roles.map(([Icon, title, body]) => <li key={title} className="flex gap-3">
                <Icon aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-primary" />
                <p className="leading-relaxed"><strong className="font-semibold">{t(title)}:</strong> {t(body)}</p>
              </li>)}
            </ul>
          </Card>)}
        </div>
      </section>

      <section id="find-your-fit" className="border-y bg-secondary/40 scroll-mt-40">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 py-16 sm:py-20">
          <h2 className="font-display text-3xl sm:text-4xl text-primary">{t("websiteFit")}</h2>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {([
              [Brain, "websiteAnyone", "websiteAnyoneBody", "/start/signup", "websiteStart"],
              [Sunrise, "websiteComingHome", "websiteComingHomeBody", "/start/signup", "websiteStart"],
              [HeartHandshake, "websiteLovedOnes", "websiteLovedOnesBody", "/advocate", "websiteHelp"],
            ] as const).map(([Icon, title, body, to, label]) => <Card key={title} className="flex flex-col p-6 sm:p-8 border-border/60">
              <Icon aria-hidden="true" className="h-7 w-7 text-primary" />
              <h3 className="mt-5 font-display text-xl text-primary">{t(title)}</h3>
              <p className="mt-3 flex-1 text-lg leading-relaxed text-foreground/85">{t(body)}</p>
              <Button asChild className="mt-6 min-h-12 h-auto whitespace-normal py-3"><Link to={to}>{t(label)}<ArrowRight className="h-4 w-4 shrink-0" /></Link></Button>
            </Card>)}
          </div>
        </div>
      </section>

      {/* What you get */}
      <section id="what-you-get" className="bg-secondary/50 border-y scroll-mt-40">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 py-20">
          <div className="max-w-2xl">
            <h2 className="font-display text-4xl sm:text-5xl text-navy">{t("websiteWhat")}</h2>
            <p className="mt-3 text-lg text-muted-foreground">
              {t("websiteWhatIntro")}
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Video,
                title: t("websiteTalk"),
                body: t("websiteTalkBody"),
              },
              {
                icon: Brain,
                title: t("websiteMind"),
                body: t("websiteMindBody"),
              },
              {
                icon: HandHeart,
                title: t("websiteLife"),
                body: t("websiteLifeBody"),
              },
              {
                icon: Sparkles,
                title: t("websiteYourPlan"),
                body: t("websiteYourPlanBody"),
              },
              {
                icon: Smartphone,
                title: t("websitePhone"),
                body: t("websitePhoneBody"),
              },
              {
                icon: HeartHandshake,
                title: t("websiteCorner"),
                body: t("websiteCornerBody"),
              },
            ].map((c) => (
              <Card key={c.title} className="p-6 bg-card border-border/60 shadow-none">
                <div className="h-11 w-11 rounded-xl bg-gold/25 text-navy grid place-items-center">
                  <c.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-xl text-navy">{c.title}</h3>
                <p className="mt-2 text-[15px] text-foreground/75 leading-relaxed">{c.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="bg-secondary/40 border-y">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 py-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          {[
            { icon: ShieldCheck, text: t("websiteTrustCoverage") },
            { icon: ShieldCheck, text: t("websiteTrustPrivacy") },
            { icon: HeartHandshake, text: t("websiteTrustJudgment") },
            { icon: MessageCircle, text: t("websiteTrustLanguage") },
          ].map((b) => (
            <div key={b.text} className="flex items-start gap-3">
              <span className="h-9 w-9 rounded-full bg-teal/15 text-teal grid place-items-center shrink-0">
                <b.icon className="h-4 w-4" />
              </span>
              <p className="text-foreground/80 pt-1.5 leading-snug">{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, var(--navy) 0%, color-mix(in oklab, var(--teal) 70%, var(--navy)) 100%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-5 sm:px-8 py-20 text-center text-navy-foreground">
          <Sunrise className="h-9 w-9 text-gold mx-auto" />
          <h2 className="mt-5 font-display text-3xl sm:text-4xl leading-snug">{t("websiteReady")}</h2>
          <p className="mt-4 text-lg leading-relaxed">{t("websiteReadyBody")}</p>
          <Button
            asChild
            size="lg"
            className="mt-8 h-12 px-7 text-base bg-gold text-gold-foreground hover:bg-gold/90"
          >
            <Link to="/start/signup">
              {t("websiteStart")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="mt-4 sm:mt-8 sm:ml-3 min-h-12 h-auto whitespace-normal py-3 border-navy-foreground/40 bg-transparent text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground"><Link to="/advocate">{t("websiteHelp")}</Link></Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 py-10">
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
            <nav className="flex flex-wrap gap-x-5 gap-y-2">
              <a href="#how-it-works" className="hover:text-foreground">
                {t("websiteHow")}
              </a>
              <Link to="/referral" className="hover:text-foreground">
                {t("websitePartners")}
              </Link>
              <a href="#privacy" className="hover:text-foreground">
                {t("websitePrivacy")}
              </a>
              <a href="#contact" className="hover:text-foreground">
                {t("websiteContact")}
              </a>
            </nav>
            <span>© {new Date().getFullYear()} {t("websiteBrand")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
