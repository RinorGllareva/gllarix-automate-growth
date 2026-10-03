import { Link } from "react-router-dom";
import type { Notification, NotificationType } from "@/data";
import { Drawer } from "@/components/ui/overlay";

const DOT: Record<NotificationType, string> = {
  meeting_booked: "bg-cyan",
  payment_paid: "bg-mint",
  payment_failed: "bg-coral",
  job_paused: "bg-coral",
  tier_moved: "bg-lavender",
  meeting_approval: "bg-amber",
  bdr_report: "bg-text-3",
  task: "bg-cyan",
  mention: "bg-cyan",
  briefing: "bg-lavender",
  client_health: "bg-amber",
  inbound: "bg-mint",
};

export const relativeTime = (iso: string, now = Date.now()) => {
  const mins = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  if (hours < 48) return "Yesterday";
  return `${Math.round(hours / 24)} days ago`;
};

interface NotificationsPanelProps {
  open: boolean;
  items: Notification[];
  onClose: () => void;
  onRead: (id: string) => void;
  onReadAll: () => void;
}

const NotificationsPanel = ({ open, items, onClose, onRead, onReadAll }: NotificationsPanelProps) => {
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Notifications · ${unread} new`}
      headerAction={
        unread ? (
          <button type="button" className="btn-ghost" onClick={onReadAll}>
            Mark all read
          </button>
        ) : null
      }
    >
      {items.length ? (
        <ul className="m-0 list-none p-0">
          {items.map((n) => (
            <li key={n.id} className="border-b border-line-soft">
              <Link
                to={n.href}
                onClick={() => {
                  onRead(n.id);
                  onClose();
                }}
                className={`flex gap-3 px-5 py-3.5 hover:bg-surface-2 ${n.readAt ? "opacity-70" : ""}`}
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 ${DOT[n.type]}`} aria-hidden="true" />
                <span className="flex flex-col gap-1">
                  <span className="text-[13px] leading-snug text-text">
                    {n.readAt ? null : <span className="sr-only">Unread: </span>}
                    {n.text}
                  </span>
                  <span className="text-[11px] text-text-3">{relativeTime(n.createdAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 px-5 py-8 text-[14px] text-text-2">
          No notifications yet. Bookings, payments and tasks assigned to you will show up here.
        </p>
      )}
    </Drawer>
  );
};

export default NotificationsPanel;
