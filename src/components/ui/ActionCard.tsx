// C5 — the agentic receipt (design.md §4-C5). Server-safe presentational card:
// every fired tool becomes one of these, immediately (design.md §6).
// Organic dressing: pale sheets (.r-sheet) with a semantic left rule.
import {
  AlertTriangle,
  Bell,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  FileText,
  ListChecks,
  Phone,
  Pill,
} from "lucide-react";
import type { ActionReceipt, ToolName, ToolStatus } from "@/lib/types";

interface CardCopy {
  title: string;
  /** Slot text, rendered with a small calendar glyph (bookings only). */
  slot: string | null;
  /** Free-text note, rendered plain (alerts only). */
  message: string | null;
  Icon: typeof Pill;
  border: string;
  chip: string;
}

function stringPayload(
  payload: Record<string, string | number | boolean | undefined>,
  key: string,
): string | null {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function copyFor(receipt: ActionReceipt): CardCopy {
  const { tool, payload } = receipt;
  switch (tool) {
    case "log_symptom":
      return {
        title: `Symptom logged — ${stringPayload(payload, "description") ?? "noted"}`,
        slot: null,
        message: null,
        Icon: FileText,
        border: "border-l-moss",
        chip: "bg-oksoft text-ok",
      };
    case "check_meds":
      return {
        title: "Medication list checked",
        slot: null,
        message: null,
        Icon: ListChecks,
        border: "border-l-moss",
        chip: "bg-oksoft text-ok",
      };
    case "request_refill":
      return {
        title: `Refill requested — ${stringPayload(payload, "medication_name") ?? "medication"}`,
        slot: null,
        message: null,
        Icon: Pill,
        border: "border-l-warn",
        chip: "bg-warnsoft text-warn",
      };
    case "book_appointment":
      return {
        title: "Appointment booked",
        slot: stringPayload(payload, "slot"),
        message: null,
        Icon: CalendarCheck,
        border: "border-l-ok",
        chip: "bg-oksoft text-ok",
      };
    case "notify_caregiver":
      return payload.level === "urgent" || payload.level === "crisis"
        ? {
            title: "Urgent alert sent to caregiver",
            slot: null,
            message: stringPayload(payload, "message"),
            Icon: Bell,
            border: "border-l-danger",
            chip: "bg-dangersoft text-danger",
          }
        : {
            title: "Caregiver notified",
            slot: null,
            message: stringPayload(payload, "message"),
            Icon: Bell,
            border: "border-l-stone",
            chip: "bg-muted text-inkmuted",
          };
    case "crisis_alert":
      return {
        title: "Crisis alert — caregiver notified",
        slot: null,
        message: stringPayload(payload, "message"),
        Icon: AlertTriangle,
        border: "border-l-danger",
        chip: "bg-dangersoft text-danger",
      };
    case "schedule_telephone_call":
      return {
        title: `Calling ${stringPayload(payload, "provider") ?? "the doctor's office"}`,
        slot: null,
        message: null,
        Icon: Phone,
        border: "border-l-moss",
        chip: "bg-oksoft text-ok",
      };
    case "finalize_checkin":
      return {
        title: "Check-in complete",
        slot: null,
        message: null,
        Icon: CheckCircle2,
        border: "border-l-stone",
        chip: "bg-muted text-inkmuted",
      };
  }
}

const STATUS_STYLES: Record<ToolStatus, string> = {
  succeeded: "bg-oksoft text-ok",
  scheduled: "bg-warnsoft text-warn",
  failed: "bg-dangersoft text-danger",
};

const STATUS_GLYPHS: Record<ToolStatus, string> = {
  succeeded: "✅",
  scheduled: "⏳",
  failed: "⚠️",
};

/* The 200ms ease-out slide-in is design.md §2's card motion token. Keyframes can
   only live in CSS, so the rule ships with the component; every color, radius and
   spacing decision stays in Tailwind utilities. Static under reduced motion. */
const ENTER_CSS = `
@keyframes cura-slide-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.cura-entering { animation: cura-slide-in 200ms ease-out both; }
@media (prefers-reduced-motion: reduce) { .cura-entering { animation: none; } }
`;

export interface ActionCardProps {
  receipt: ActionReceipt;
  /** Adds the 200ms ease-out slide-in mount animation; static under reduced motion. */
  entering?: boolean;
  /** Reduced emphasis for nested use, e.g. inside CheckInRow. */
  muted?: boolean;
  /** Relative-time label (e.g. "2 min ago"); falls back to a hydration-safe "HH:MM". */
  timeLabel?: string;
  /** Stagger offset in ms for the mount drop animation. */
  delay?: number;
}

export function ActionCard({ receipt, entering = false, muted = false, timeLabel, delay = 0 }: ActionCardProps) {
  const { tool, status, createdAt } = receipt;
  const { title, slot, message, Icon, border, chip } = copyFor(receipt);
  const time = timeLabel ?? createdAt.slice(11, 16); // deterministic "HH:MM", hydration-safe

  return (
    <>
      {entering && <style>{ENTER_CSS}</style>}
      <div
        data-testid={`action-card-${tool}`}
        className={`r-sheet border border-hairline a-drop ${entering ? "cura-entering" : ""} ${
          muted ? `bg-paper p-3 text-sm ${border}` : `bg-paper p-4 border-l-4 ${border}`
        }`}
        style={delay ? { animationDelay: `${delay}ms` } : undefined}
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${chip}`}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className={`font-semibold ${muted ? "text-sm" : ""} text-ink`}>{title}</p>
              <span
                className={`a-stamp inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}
              >
                {STATUS_GLYPHS[status]} {status}
              </span>
            </div>
            {slot && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-inkmuted">
                <Calendar aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
                {slot}
              </p>
            )}
            {message && <p className="mt-1 text-sm text-inkmuted">{message}</p>}
            <p className="mt-1 text-xs text-inkmuted/70">
              {tool} · {time}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default ActionCard;
