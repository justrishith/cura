"use client";

// Dashboard primitives for the caregiver surface (design.md §4, primitives list).
// One file, small subcomponents; client because AlertRow acknowledges.
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
    <section data-testid="status-hero" className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-teal-50 text-lg font-bold text-teal-700"
        >
          {initials || "?"}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {name}
              {age !== undefined && `, ${age}`}
            </h2>
            <GradeBadge grade={grade} />
          </div>
          <p className="mt-0.5 text-sm text-slate-500">Last check-in {lastCheckInLabel}</p>
        </div>
      </div>
      {summary && <p className="mt-4 text-base text-slate-700">{summary}</p>}
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
  info: "bg-slate-100 text-slate-600",
  urgent: "bg-amber-50 text-amber-700",
  crisis: "bg-red-600 text-white",
};

export function AlertRow({ level, message, unread = false, acknowledged = false, onAck }: AlertRowProps) {
  return (
    <div
      data-testid={`alert-row-${level}`}
      className={`flex items-start gap-3 rounded-2xl border bg-white p-4 transition-opacity duration-200 ease-out ${acknowledged ? "border-slate-200 opacity-60" : "border-teal-200"}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${ALERT_LEVEL_STYLES[level]}`}>
            {level.toUpperCase()}
          </span>
          {unread && (
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-teal-600" />
          )}
        </div>
        <p className="mt-1.5 text-sm text-slate-700">{message}</p>
      </div>
      {onAck && (
        <button
          type="button"
          onClick={onAck}
          className="min-h-12 inline-flex shrink-0 items-center rounded-full border border-slate-200 px-4 text-sm font-medium text-slate-600 transition-colors duration-200 ease-out hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2"
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
    <section data-testid="checkin-row" className="border-t border-slate-200 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-500">{timeLabel}</span>
        <GradeBadge grade={grade} />
        {symptomTags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600"
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
  ok: "bg-green-50 text-green-700",
  requested: "bg-amber-50 text-amber-700",
  ordered: "bg-green-50 text-green-800",
};

export function MedCard({ name, dosage, refillStatus }: MedCardProps) {
  return (
    <section data-testid={`med-card-${refillStatus}`} className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-base font-semibold text-slate-900">{name}</p>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${REFILL_STYLES[refillStatus]}`}>
          {refillStatus}
        </span>
      </div>
      {dosage && <p className="mt-0.5 text-sm text-slate-500">{dosage}</p>}
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
  booked: "bg-green-50 text-green-700",
  "no-booking": "bg-amber-50 text-amber-700",
  "urgent-alert": "bg-red-50 text-red-600",
};

const OUTCOME_GLYPHS: Record<CallLogRowProps["outcome"], string> = {
  booked: "booked ✅",
  "no-booking": "no-booking ⚠️",
  "urgent-alert": "urgent alert ⚠️",
};

export function CallLogRow({ direction, destination, outcome, durationText, timeLabel }: CallLogRowProps) {
  return (
    <section data-testid={`call-log-row-${outcome}`} className="flex items-start gap-3 border-t border-slate-200 py-3">
      {direction === "out" ? (
        <PhoneOutgoing aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" strokeWidth={1.5} />
      ) : (
        <PhoneIncoming aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" strokeWidth={1.5} />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
          {direction === "out" ? "Outbound" : "Inbound"} — {destination}
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${OUTCOME_STYLES[outcome]}`}>
            {OUTCOME_GLYPHS[outcome]}
          </span>
        </p>
        {(durationText || timeLabel) && (
          <p className="mt-0.5 text-xs text-slate-400">
            {durationText}
            {durationText && timeLabel ? " · " : ""}
            {timeLabel}
          </p>
        )}
      </div>
    </section>
  );
}
