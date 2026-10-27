// Landing / (design.md §S1): hero, two role CTAs, 3-step story basin, mission,
// safety principles, the builder's note. Organic composition: split opening
// (serif statement + actions beside loose flat organic forms), a moss basin
// carrying the 3-step story with large light numerals, a pale tray across the
// basin's base, stone footer.
import Link from "next/link";
import { CuraMark } from "@/components/ui/CuraMark";
import { CuraBird } from "@/components/ui/CuraBird";
import { OrganicStage } from "@/components/ui/OrganicStage";
import { Reveal } from "@/components/ui/Reveal";

export const metadata = {
  title: "cura — Care between visits.",
  description:
    "Daily voice check-ins at home. When something's off, Cura makes the phone calls that matter — and the family watches it live.",
};

const HERO_WORDS = ["Care", "between", "visits."];

const STORY_STEPS = [
  {
    title: "Talk for 60 sec",
    body: "A plain-language daily check-in — by voice, no app skills needed.",
  },
  {
    title: "Cura calls the doctor",
    body: "When the grade says it matters, Cura phones the office on your behalf.",
  },
  {
    title: "Booked & logged",
    body: "The appointment lands on the calendar — your family sees it live.",
  },
];

const PRINCIPLES = [
  {
    title: "Humane, not transactional",
    body: "Cura knows Maria, greets her by name, and answers out loud. No forms, no dashboards, no jargon — a conversation with someone who remembers yesterday.",
  },
  {
    title: "Escalation by design",
    body: "Every turn ends with a grade. Gentle days get health tips; worrying days alert the family; worrying days that sound dangerous route to a scripted calm-down path the agent has no say in.",
  },
  {
    title: "Real phone calls",
    body: "When a doctor's office must be involved, Cura dials Twilio and speaks to a human receptionist in natural conversation — not a fake demo, not an SMS blast.",
  },
  {
    title: "The family, never in the dark",
    body: "Check-ins, grades, receipts, alerts and booked slots stream live to the caregiver dashboard — and every day can be printed as a visit summary for the actual appointment.",
  },
];

const CTA_LINK =
  "r-ctl min-h-12 inline-flex items-center justify-center px-7 text-base font-semibold transition-[background-color,transform] duration-[240ms] ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col bg-sand">
      {/* Opening split: compact serif statement + actions beside organic forms */}
      <section className="mx-auto grid w-full max-w-5xl gap-10 px-4 pb-16 pt-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
        <div className="flex flex-col items-start gap-6">
          <div className="a-rise flex w-full items-center justify-between gap-3">
            <CuraMark />
          </div>

          <h1 className="font-display text-[clamp(44px,6vw,68px)] font-semibold leading-[1.02] tracking-tight text-ink">
            {HERO_WORDS.map((word, i) => (
              <span key={i}>
                <span
                  className="wv"
                  style={{ animationDelay: `${120 + i * 110}ms` }}
                >
                  {word}
                </span>
                {i < HERO_WORDS.length - 1 ? " " : ""}
              </span>
            ))}
          </h1>
          <p
            className="a-rise d-3 max-w-[46ch] text-lg leading-[1.8] text-inkmuted"
          >
            Cura checks in by voice every day. When something&apos;s off, it makes
            the phone calls that matter — booking the doctor&apos;s appointment
            while family watches.
          </p>

          {/* Two role CTAs — the only heavy elements here. */}
          <div className="a-rise d-4 mt-2 flex w-full flex-col gap-3 sm:flex-row">
            <Link href="/patient" className={`${CTA_LINK} flex-1 bg-moss text-paper hover:bg-mosshover`}>
              I&apos;m the patient
            </Link>
            <Link
              href="/caregiver"
              className={`${CTA_LINK} flex-1 border border-hairline bg-paper text-ink hover:bg-muted`}
            >
              I&apos;m the caregiver
            </Link>
          </div>
        </div>

        <OrganicStage />
      </section>

      {/* Continuous moss basin: the process, with large light numbers */}
      <section className="w-full bg-moss px-4 pb-20 pt-14 text-paper">
        <ol className="mx-auto grid w-full max-w-5xl gap-10 sm:grid-cols-3 sm:gap-8">
          {STORY_STEPS.map((step, index) => (
            <li
              key={step.title}
              className="border-t border-paper/25 pt-5 sm:border-l sm:border-l-paper/25 sm:pl-6 sm:first:border-l-0 sm:first:pl-0 sm:border-t-0 sm:pt-0"
            >
              <Reveal delay={index * 130}>
                <div className="flex flex-col gap-3">
                  <span
                    aria-hidden="true"
                    className="a-pop font-display text-6xl font-medium leading-none text-paper/60"
                    style={{ animationDelay: `${340 + index * 130}ms` }}
                  >
                    {index + 1}
                  </span>
                  <p className="text-base font-semibold text-paper">{step.title}</p>
                  <p className="max-w-[38ch] text-[15px] leading-[1.8] text-paper/80">{step.body}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      {/* Pale helpful tray laid across the basin's base */}
      <div className="mx-auto -mt-9 w-full max-w-4xl px-4">
        <Reveal>
          <div className="r-tray flex flex-wrap items-center justify-between gap-3 border border-hairline bg-paper px-6 py-4">
            <p className="text-[13px] text-inkmuted">A 60-second voice check-in, a gentle grade, a phone call that books itself.</p>
            <p className="flex gap-4 text-[13px]">
              <Link href="/patient" className="text-clay underline-offset-4 hover:underline">
                Patient console
              </Link>
              <Link href="/caregiver" className="text-clay underline-offset-4 hover:underline">
                Caregiver dashboard
              </Link>
              <Link href="/summary" className="text-clay underline-offset-4 hover:underline">
                Visit summary
              </Link>
            </p>
          </div>
        </Reveal>
      </div>

      {/* Mission: why this exists */}
      <section className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-20 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-14">
        <div className="flex flex-col gap-4">
          <span className="text-[13px] font-semibold uppercase tracking-[0.22em] text-clay">The mission</span>
          <h2 className="font-display text-[clamp(30px,4vw,44px)] font-semibold leading-[1.12] tracking-tight text-ink">
            Aging at home should not feel like aging alone.
          </h2>
          <div className="a-bob hidden lg:block">
            <CuraBird className="h-16 w-16 -rotate-6" />
          </div>
        </div>
        <div className="flex flex-col gap-5 text-lg leading-[1.8] text-inkmuted">
          <p>
            The care system sees your parent twice a month. The person who
            actually knows how last night went — the dizziness, the skipped
            pills, the nights that turned into mornings — is nobody, because
            doing the daily check-in is a human&apos;s job, and humans get busy,
            forget, or live three time zones away.
          </p>
          <p>
            <strong className="font-semibold text-ink">Cura does the daily part.</strong>{" "}
            One minute of honest conversation, spoken — the way elders actually
            communicate. Cura listens with care, grades the day, and takes the
            follow-up actions a family would: the reassurance, the tip, the
            alert, the call to the doctor&apos;s office that books the visit.
          </p>
          <p>
            Our goal is simple: <strong className="font-semibold text-ink">no quiet
            bad days.</strong> If something is wrong, it becomes a notification,
            a receipt, and a booked appointment — before dinner, not after the
            next scheduled visit.
          </p>
        </div>
      </section>

      {/* What we believe: working principles */}
      <section className="w-full bg-paper px-4 py-20">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
          <div className="flex flex-col gap-3">
            <span className="text-[13px] font-semibold uppercase tracking-[0.22em] text-clay">What we believe</span>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">
              Useful AI speaks up at the right moment.
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {PRINCIPLES.map((p, i) => (
              <Reveal key={p.title} delay={(i % 2) * 90}>
                <article className="r-panel h-full border border-hairline bg-sand p-6">
                  <h3 className="font-display text-xl font-semibold text-ink">{p.title}</h3>
                  <p className="mt-2 text-[15px] leading-[1.8] text-inkmuted">{p.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* The builder */}
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-20">
        <span className="text-[13px] font-semibold uppercase tracking-[0.22em] text-clay">The builder</span>
        <Reveal>
          <div className="flex flex-col gap-4">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">
              Hi, I&apos;m Rishith — I built Cura to feel like family checking in.
            </h2>
            <p className="max-w-[70ch] text-lg leading-[1.8] text-inkmuted">
              Cura is my <strong className="font-semibold text-ink">NextSpark Hacks</strong>{" "}
              submission, written end-to-end in one weekend: the voice console,
              the agent loop with its tier guard, real speech replies, the
              Twilio calling chain, the caregiver dashboard, and this
              hand-built, screen-reader–friendly design system. Everything runs
              on free tiers because the point of a companion is that anyone
              could run it.
            </p>
            <p className="max-w-[70ch] text-lg leading-[1.8] text-inkmuted">
              One rule the whole product respects: <strong className="font-semibold text-ink">Cura never
              calls 911.</strong> Escalation to emergency services is a human
              decision — Cura&apos;s job is to make sure the right humans know
              quickly, clearly, and in time.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                "Gemini agent loop",
                "Native-speech replies",
                "Twilio real calls",
                "Supabase records",
                "Next.js + Web Speech",
                "All free tiers",
              ].map((chip) => (
                <span key={chip} className="rounded-full border border-hairline bg-paper px-3 py-1 text-[13px] font-medium text-inkmuted">
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* Quiet stone footer */}
      <footer className="mt-14 bg-stone px-4 py-7">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[13px] text-inkmuted">
          <CuraMark />
          <span>Not medical advice — and never calls emergency services on its own.</span>
          <span>NextSpark Hacks · Rishith</span>
        </div>
      </footer>
    </main>
  );
}
