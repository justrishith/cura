"use client";

// Dashboard primitives for the caregiver surface (design.md §4, primitives list).
// One file, small subcomponents; client because AlertRow acknowledges.
// Organic dressing: paper sheets on the sand ground, serif person heading,
// hairline rules, earth-toned semantic chips.
import { PhoneIncoming, PhoneOutgoing } from "lucide-react";
import type { Grade, NotificationLevel, RefillStatus } from "@/lib/types";
import type { ActionReceipt } from "@/lib/types";
import { ActionCard } from "./ActionCard";
import { GradeBadge } from "./GradeBadge";

/* ---------- StatusHero ---------- */

export interface StatusHeroProps {
  name: string;
  age?: number;
  /** e.g. "09:32". */
  lastCheckInLabel: string;
  grade: Grade;
  /** One-line spoken summary. */
  summary: string;
}

export function StatusHero({ name, age, lastCheckInLabel, grade, summary }: StatusHeroProps) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return (
    <section
      data-testid="status-hero"
      className="a-drop r-tray border border-hairline bg-paper p-6"
    >
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-clay font-display text-lg font-medium text-paper ${
            grade === "crisis" ? "a-ring motion-reduce:[animation:none]" : ""
          }`}
        >
          {initials || "?"}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
              {name}
              {age !== undefined && `, ${age}`}
            </h2>
            <GradeBadge grade={grade} />
          </div>
          <p className="mt-0.5 text-sm text-inkmuted">Last check-in {lastCheckInLabel}</p>
        </div>
      </div>
      {summary && <p className="mt-4 text-base leading-relaxed text-inkmuted">{summary}</p>}
    </section>
  );
}

/* ---------- AlertRow ---------- */

export interface AlertRowProps {
  level: NotificationLevel;
  message: string;
  unread?: boolean;
  acknowledged?: boolean;
  onAck?: () => void;
}

const ALERT_LEVEL_STYLES: Record<NotificationLevel, string> = {
  info: "bg-muted text-inkmuted",
  urgent: "bg-warnsoft text-warn",
  crisis: "bg-danger text-paper",
};

export function AlertRow({ level, message, unread = false, acknowledged = false, onAck }: AlertRowProps) {
  const wash = unread && !acknowledged && (level === "urgent" || level === "crisis");
  return (
    <div
      data-testid={`alert-row-${level}`}
      className={`a-drop flex items-start gap-3 rounded-xl border bg-paper p-4 transition-opacity duration-[240ms] ease-out ${acknowledged ? "border-hairline opacity-60" : "border-clay"} ${wash ? "a-wash motion-reduce:[animation:none]" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${ALERT_LEVEL_STYLES[level]}`}>
            {level.toUpperCase()}
          </span>
          {unread && (
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-moss" />
          )}
        </div>
        <p className="mt-1.5 text-sm text-inkmuted">{message}</p>
      </div>
      {onAck && (
        <button
          type="button"
          onClick={onAck}
          className="r-ctl min-h-12 inline-flex shrink-0 items-center border border-hairline bg-paper px-4 text-sm font-medium text-inkmuted transition-[background-color,transform] duration-[240ms] ease-out hover:bg-muted active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
        >
          Got it
        </button>
      )}
    </div>
  );
}

/* ---------- CheckInRow ---------- */

export interface CheckInRowProps {
  timeLabel: string;
  grade: Grade;
  symptomTags: string[];
  receipts?: ActionReceipt[];
}

export function CheckInRow({ timeLabel, grade, symptomTags, receipts = [] }: CheckInRowProps) {
  return (
    <section data-testid="checkin-row" className="a-drop border-t border-hairline pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-inkmuted">{timeLabel}</span>
        <GradeBadge grade={grade} />
        {symptomTags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-inkmuted"
          >
            {tag}
          </span>
        ))}
      </div>
      {receipts.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {receipts.map((receipt) => (
            <ActionCard key={receipt.id} receipt={receipt} muted />
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- MedCard ---------- */

export interface MedCardProps {
  name: string;
  dosage?: string | null;
  refillStatus: RefillStatus;
}

const REFILL_STYLES: Record<RefillStatus, string> = {
  ok: "bg-oksoft text-ok",
  requested: "bg-warnsoft text-warn",
  ordered: "bg-oksoft text-ok",
};

export function MedCard({ name, dosage, refillStatus }: MedCardProps) {
  return (
    <section data-testid={`med-card-${refillStatus}`} className="a-drop r-panel border border-hairline bg-paper p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-display text-lg font-medium text-ink">{name}</p>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${REFILL_STYLES[refillStatus]}`}>
          {refillStatus}
        </span>
      </div>
      {dosage && <p className="mt-0.5 text-sm text-inkmuted">{dosage}</p>}
    </section>
  );
}

/* ---------- CallLogRow ---------- */

export interface CallLogRowProps {
  direction: "in" | "out";
  destination: string;
  outcome: "booked" | "no-booking" | "urgent-alert";
  durationText?: string;
  timeLabel?: string;
}

const OUTCOME_STYLES: Record<CallLogRowProps["outcome"], string> = {
  booked: "bg-oksoft text-ok",
  "no-booking": "bg-warnsoft text-warn",
  "urgent-alert": "bg-dangersoft text-danger",
};

const OUTCOME_GLYPHS: Record<CallLogRowProps["outcome"], string> = {
  booked: "booked ✅",
  "no-booking": "no-booking ⚠️",
  "urgent-alert": "urgent alert ⚠️",
};

export function CallLogRow({ direction, destination, outcome, durationText, timeLabel }: CallLogRowProps) {
  return (
    <section data-testid={`call-log-row-${outcome}`} className="flex items-start gap-3 border-t border-hairline py-3">
      {direction === "out" ? (
        <PhoneOutgoing aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-moss" strokeWidth={1.5} />
      ) : (
        <PhoneIncoming aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-inkmuted" strokeWidth={1.5} />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
          {direction === "out" ? "Outbound" : "Inbound"} — {destination}
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${OUTCOME_STYLES[outcome]}`}>
            {OUTCOME_GLYPHS[outcome]}
          </span>
        </p>
        {(durationText || timeLabel) && (
          <p className="mt-0.5 text-xs text-inkmuted/70">
            {durationText}
            {durationText && timeLabel ? " · " : ""}
            {timeLabel}
          </p>
        )}
      </div>
    </section>
  );
}
