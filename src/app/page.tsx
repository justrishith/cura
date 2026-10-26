// Landing / (design.md §S1): hero, two role CTAs, 3-step story strip, demo chip.
// Organic composition: split opening (serif statement + actions beside loose
// flat organic forms), a moss basin carrying the 3-step story with large light
// numerals, a pale tray laid across the basin's base, stone footer.
// Copy and routes unchanged.
import Link from "next/link";
import { CuraMark } from "@/components/ui/CuraMark";
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
            <span className="rounded-full bg-muted px-3 py-1 text-xs text-inkmuted">
              Demo — not medical advice
            </span>
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

      {/* Pale facts tray laid across the basin's base */}
      <div className="mx-auto -mt-9 w-full max-w-4xl px-4">
        <Reveal>
          <div className="r-tray flex flex-wrap items-center justify-between gap-3 border border-hairline bg-paper px-6 py-4">
            <p className="text-[13px] text-inkmuted">Demo — not medical advice. All data mocked.</p>
            <p className="flex gap-4 text-[13px]">
              <Link href="/patient" className="text-clay underline-offset-4 hover:underline">
                Patient console
              </Link>
              <Link href="/caregiver" className="text-clay underline-offset-4 hover:underline">
                Caregiver dashboard
              </Link>
            </p>
          </div>
        </Reveal>
      </div>

      {/* Quiet stone footer */}
      <footer className="mt-14 bg-stone px-4 py-7">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[13px] text-inkmuted">
          <CuraMark />
          <span>Demo — not medical advice. All data mocked.</span>
        </div>
      </footer>
    </main>
  );
}
