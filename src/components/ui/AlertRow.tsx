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
  info: "bg-muted text-inkmuted",
  urgent: "bg-warnsoft text-warn",
  crisis: "bg-danger text-paper",
};

const LEVEL_LABELS: Record<NotificationLevel, string> = {
  info: "Info",
  urgent: "Urgent",
  crisis: "Crisis",
};

export function AlertRow({ level, message, unread = false, onAck }: AlertRowProps) {
  const wash = unread && (level === "urgent" || level === "crisis");
  return (
    <div
      data-testid={`alert-row-${level}`}
      className={`a-drop flex items-start gap-3 r-panel border border-hairline bg-paper p-4 ${wash ? "a-wash" : ""}`}
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
            className="h-2 w-2 rounded-full bg-moss"
            />
          )}
        </div>
        <p className="mt-1.5 text-sm text-inkmuted">{message}</p>
      </div>
      {onAck && (
        <button
          type="button"
          onClick={onAck}
          data-testid="alert-row-ack"
          className="r-ctl min-h-12 inline-flex shrink-0 items-center border border-hairline bg-paper px-4 text-sm font-medium text-inkmuted transition-[background-color,transform] duration-[240ms] ease-out hover:bg-muted active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
        >
          Got it
        </button>
      )}
    </div>
  );
}

export default AlertRow;
