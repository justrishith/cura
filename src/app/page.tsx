// Landing / (design.md §S1): hero, two role CTAs, 3-step story strip, demo chip.
import Link from "next/link";
import { CheckCircle2, Mic, PhoneCall } from "lucide-react";
import { CuraMark } from "@/components/ui/CuraMark";

export const metadata = {
  title: "cura — Care between visits.",
  description:
    "Daily voice check-ins at home. When something's off, Cura makes the phone calls that matter — and the family watches it live.",
};

const STORY_STEPS = [
  {
    Icon: Mic,
    title: "Talk for 60 sec",
    body: "A plain-language daily check-in — by voice, no app skills needed.",
  },
  {
    Icon: PhoneCall,
    title: "Cura calls the doctor",
    body: "When the grade says it matters, Cura phones the office on your behalf.",
  },
  {
    Icon: CheckCircle2,
    title: "Booked & logged",
    body: "The appointment lands on the calendar — your family sees it live.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center bg-slate-50 px-4 py-16">
      {/* Hero */}
      <div className="flex w-full max-w-xl flex-col items-center text-center">
        <div className="flex items-center justify-between gap-6 self-stretch">
          <CuraMark />
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
            Demo — not medical advice
          </span>
        </div>

        <h1 className="mt-16 text-5xl font-bold tracking-tight text-slate-900">
          Care between visits.
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Cura checks in by voice every day. When something&apos;s off, it makes
          the phone calls that matter — booking the doctor&apos;s appointment
          while family watches.
        </p>

        {/* Two role CTAs — the only heavy elements here. */}
        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/patient"
            className="min-h-12 inline-flex flex-1 items-center justify-center rounded-full bg-teal-600 px-6 text-base font-semibold text-white transition-colors duration-200 ease-out hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2"
          >
            I&apos;m the patient
          </Link>
          <Link
            href="/caregiver"
            className="min-h-12 inline-flex flex-1 items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-base font-semibold text-slate-700 transition-colors duration-200 ease-out hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2"
          >
            I&apos;m the caregiver
          </Link>
        </div>
      </div>

      {/* 3-step story strip */}
      <ol className="mt-24 grid w-full max-w-xl gap-6 sm:grid-cols-3">
        {STORY_STEPS.map((step, index) => (
          <li key={step.title} className="flex flex-col items-center gap-2 text-center">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700"
            >
              <step.Icon className="h-6 w-6" strokeWidth={1.5} />
            </span>
            <p className="text-sm font-semibold text-slate-900">
              {index + 1}. {step.title}
            </p>
            <p className="text-sm text-slate-500">{step.body}</p>
          </li>
        ))}
      </ol>

      {/* Footer chip */}
      <p className="mt-20 rounded-full bg-slate-100 px-4 py-2 text-xs text-slate-500">
        Demo — not medical advice. All data mocked.
      </p>
    </main>
  );
}
