// Dashboard primitive — one caregiver alert: level chip, message, ghost ack
// button, unread teal dot (design.md §4). Server-safe without onAck; when a
// client parent passes onAck, this renders interactive as usual.
import type { NotificationLevel } from "@/lib/types";

export interface AlertRowProps {
  level: NotificationLevel;
  message: string;
  /** Unread alerts carry a teal dot. */
  unread?: boolean;
  /** Ghost "Got it" acknowledge button; the parent owns the state. */
  onAck?: () => void;
}

const LEVEL_STYLES: Record<NotificationLevel, string> = {
  info: "bg-slate-100 text-slate-600",
  urgent: "bg-amber-50 text-amber-600",
  crisis: "bg-red-600 text-white",
};

const LEVEL_LABELS: Record<NotificationLevel, string> = {
  info: "Info",
  urgent: "Urgent",
  crisis: "Crisis",
};

export function AlertRow({ level, message, unread = false, onAck }: AlertRowProps) {
  return (
    <div
      data-testid={`alert-row-${level}`}
      className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${LEVEL_STYLES[level]}`}
          >
            {LEVEL_LABELS[level]}
          </span>
          {unread && (
            <span
              aria-hidden="true"
              data-testid="alert-row-unread-dot"
              className="h-2 w-2 rounded-full bg-teal-600"
            />
          )}
        </div>
        <p className="mt-1.5 text-sm text-slate-700">{message}</p>
      </div>
      {onAck && (
        <button
          type="button"
          onClick={onAck}
          data-testid="alert-row-ack"
          className="min-h-12 inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition-colors duration-200 ease-out hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2"
        >
          Got it
        </button>
      )}
    </div>
  );
}

export default AlertRow;
