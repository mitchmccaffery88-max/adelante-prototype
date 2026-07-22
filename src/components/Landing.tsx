import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ReadAloudButton } from "@/components/ReadAloudButton";
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

const readAloudText =
  "Forward starts here. Adelante helps you feel better and build a steady life after coming home, with real people in your corner. Free with Medi-Cal. Private. No judgment. How it works. Three simple steps. We walk with you. Step 1. Connect. Tell us a little about you. It takes a few minutes, and we can help you do it by phone. Step 2. Make a plan. Meet your care team. Together you build a simple 90 day plan. Step 3. Move forward. Talk to a counselor, learn new skills, and get help with daily life. What you get. Tools and people that meet you where you are. Talk to someone who gets it. Private video or phone sessions with a counselor, on your schedule. Care for your mind. Support for stress, sleep, anger, sadness, and staying sober. Help with real life. Connections for housing, food, jobs, and getting back on your feet. A plan that's yours. A simple 90 day plan built around your goals, in plain language. On your phone. Use it anywhere. No smartphone? We can help with that too. A team in your corner. Counselors and navigators who actually show up, not a chatbot. Who it's for. Adelante is for people coming home from jail or prison who want support getting steady, especially in the first few months. If you're on probation or parole, or just got out, you belong here. For partners. Work with people reentering the community? You can refer someone in minutes. Probation, parole, drug courts, reentry navigators, we're here to make it easy. Covered by Medi-Cal, no cost to you. Your information is private and protected. Judgment-free, always. Available in English. Spanish coming soon. You've already taken the hardest step. Let's take the next one together.";

export function Landing() {
  return (
    <div className="bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImg}
            alt="A person standing on a quiet road at sunrise, looking toward an open path"
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
              <Sunrise className="h-3.5 w-3.5 text-gold" />A new beginning, one step at a time
            </span>
            <h1 className="mt-5 font-display text-5xl sm:text-6xl lg:text-7xl leading-[1.05] tracking-tight">
              Forward starts here.
            </h1>
            <p className="mt-5 text-lg sm:text-xl text-navy-foreground/90 max-w-xl">
              Adelante helps you feel better and build a steady life after coming home — with real
              people in your corner.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="h-12 px-6 text-base bg-gold text-gold-foreground hover:bg-gold/90"
              >
                <Link to="/home">
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 px-6 text-base bg-transparent border-navy-foreground/40 text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground"
              >
                <Link to="/referral">I want to help someone</Link>
              </Button>
            </div>
            <p className="mt-5 text-sm text-navy-foreground/80">
              Free with Medi-Cal · Private · No judgment.
            </p>
            <div className="mt-4">
              <ReadAloudButton text={readAloudText} label="this page" />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-5 sm:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-display text-4xl sm:text-5xl text-navy">How it works</h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Three simple steps. We walk with you.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            {
              n: "1",
              icon: Phone,
              title: "Connect",
              body: "Tell us a little about you. It takes a few minutes, and we can help you do it by phone.",
            },
            {
              n: "2",
              icon: ClipboardList,
              title: "Make a plan",
              body: "Meet your care team. Together you build a simple 90-day plan.",
            },
            {
              n: "3",
              icon: ArrowRight,
              title: "Move forward",
              body: "Talk to a counselor, learn new skills, and get help with daily life.",
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

      {/* What you get */}
      <section className="bg-secondary/50 border-y">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 py-20">
          <div className="max-w-2xl">
            <h2 className="font-display text-4xl sm:text-5xl text-navy">What you get</h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Tools and people that meet you where you are.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Video,
                title: "Talk to someone who gets it",
                body: "Private video or phone sessions with a counselor, on your schedule.",
              },
              {
                icon: Brain,
                title: "Care for your mind",
                body: "Support for stress, sleep, anger, sadness, and staying sober.",
              },
              {
                icon: HandHeart,
                title: "Help with real life",
                body: "Connections for housing, food, jobs, and getting back on your feet.",
              },
              {
                icon: Sparkles,
                title: "A plan that's yours",
                body: "A simple 90-day plan built around your goals, in plain language.",
              },
              {
                icon: Smartphone,
                title: "On your phone",
                body: "Use it anywhere. No smartphone? We can help with that too.",
              },
              {
                icon: HeartHandshake,
                title: "A team in your corner",
                body: "Counselors and navigators who actually show up — not a chatbot.",
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

      {/* Who it's for */}
      <section className="mx-auto max-w-7xl px-5 sm:px-8 py-20 grid gap-8 lg:grid-cols-2">
        <Card className="p-8 sm:p-10 bg-navy text-navy-foreground border-0">
          <Users className="h-7 w-7 text-gold" />
          <h2 className="mt-4 font-display text-3xl sm:text-4xl">Who it's for</h2>
          <p className="mt-4 text-lg leading-relaxed text-navy-foreground/90">
            Adelante is for people coming home from jail or prison who want support getting steady —
            especially in the first few months. If you're on probation or parole, or just got out,
            you belong here.
          </p>
          <Button asChild className="mt-7 h-11 px-5 bg-gold text-gold-foreground hover:bg-gold/90">
            <Link to="/home">
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </Card>
        <Card className="p-8 sm:p-10 bg-card border-border/60">
          <HeartHandshake className="h-7 w-7 text-teal" />
          <h2 className="mt-4 font-display text-3xl sm:text-4xl text-navy">For partners</h2>
          <p className="mt-4 text-lg leading-relaxed text-foreground/80">
            Work with people reentering the community? You can refer someone in minutes. Probation,
            parole, drug courts, reentry navigators — we're here to make it easy.
          </p>
          <Button
            asChild
            variant="outline"
            className="mt-7 h-11 px-5 border-teal text-teal hover:bg-teal hover:text-teal-foreground"
          >
            <Link to="/referral">
              Refer someone
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </Card>
      </section>

      {/* Trust strip */}
      <section className="bg-secondary/40 border-y">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 py-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          {[
            { icon: ShieldCheck, text: "Covered by Medi-Cal — no cost to you." },
            { icon: ShieldCheck, text: "Your information is private and protected." },
            { icon: HeartHandshake, text: "Judgment-free, always." },
            { icon: MessageCircle, text: "Available in English (Spanish coming soon)." },
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
          <p className="mt-5 font-display text-3xl sm:text-4xl leading-snug">
            You've already taken the hardest step. Let's take the next one together.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-8 h-12 px-7 text-base bg-gold text-gold-foreground hover:bg-gold/90"
          >
            <Link to="/home">
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 py-10">
          <div
            role="region"
            aria-label="Crisis support"
            className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 flex flex-wrap items-center gap-3"
          >
            <Phone className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm sm:text-base">
              <span className="font-semibold text-destructive">In crisis?</span> Call or text{" "}
              <a href="tel:988" className="underline font-semibold">
                988
              </a>{" "}
              anytime. Spanish-capable.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
            <nav className="flex flex-wrap gap-x-5 gap-y-2">
              <a href="#how" className="hover:text-foreground">
                How it works
              </a>
              <Link to="/referral" className="hover:text-foreground">
                For partners
              </Link>
              <a href="#privacy" className="hover:text-foreground">
                Privacy
              </a>
              <a href="#contact" className="hover:text-foreground">
                Contact
              </a>
            </nav>
            <span>© {new Date().getFullYear()} Adelante · Tulare County Pilot</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
