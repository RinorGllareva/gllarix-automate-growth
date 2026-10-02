import type { Notification, User } from "../types";

/**
 * Fake seed data for demo mode. Founders use their own first names; everyone else is fictional.
 * Emails use the reserved .test domain so nothing can ever be sent to them.
 */
export const SEED_USERS: User[] = [
  { id: "u-rinor", name: "Rinor", email: "rinor@atlas.test", role: "admin", timezone: "Europe/Belgrade", dailyCapacity: null, active: true },
  { id: "u-cofounder", name: "Artin", email: "artin@atlas.test", role: "admin", timezone: "Europe/Belgrade", dailyCapacity: 80, active: true },
  { id: "u-bdr", name: "Diego Marín", email: "diego@atlas.test", role: "bdr", timezone: "America/Caracas", dailyCapacity: 150, active: true },
  { id: "u-implementer", name: "Lena Kraus", email: "lena@atlas.test", role: "implementer", timezone: "Europe/Zurich", dailyCapacity: null, active: true },
  { id: "u-viewer", name: "Accountant", email: "books@atlas.test", role: "viewer", timezone: "Europe/Belgrade", dailyCapacity: null, active: true },
  { id: "u-paused", name: "Former BDR", email: "former@atlas.test", role: "bdr", timezone: "America/Bogota", dailyCapacity: 150, active: false },
];

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

const forAdmins = (n: Omit<Notification, "id" | "userId">, i: number): Notification[] =>
  SEED_USERS.filter((u) => u.role === "admin").map((u) => ({ ...n, id: `n-${i}-${u.id}`, userId: u.id }));

export const SEED_NOTIFICATIONS: Notification[] = [
  ...forAdmins({ type: "meeting_booked", text: "BDR booked a meeting · Harbor Air Services, Thu 11:00 ET", href: "/meetings", createdAt: minutesAgo(4), readAt: null }, 1),
  ...forAdmins({ type: "payment_paid", text: "Deposit paid · Bluewater Plumbing · $300", href: "/clients", createdAt: minutesAgo(62), readAt: null }, 2),
  ...forAdmins({ type: "job_paused", text: "Places import paused · monthly cost cap reached", href: "/admin/jobs", createdAt: minutesAgo(130), readAt: null }, 3),
  ...forAdmins({ type: "meeting_approval", text: "Meeting waiting for approval · Coastal Comfort HVAC", href: "/meetings", createdAt: minutesAgo(60 * 22), readAt: minutesAgo(60 * 20) }, 4),
  ...forAdmins({ type: "bdr_report", text: "Daily BDR report is ready", href: "/reports", createdAt: minutesAgo(60 * 26), readAt: minutesAgo(60 * 25) }, 5),
  { id: "n-6", userId: "u-bdr", type: "tier_moved", text: "Summit Roofing Co. moved to tier A (66 → 74)", href: "/leads", createdAt: minutesAgo(15), readAt: null },
  { id: "n-7", userId: "u-bdr", type: "task", text: "Call back Ridgeway Heating & Air at 16:30 ET", href: "/today", createdAt: minutesAgo(48), readAt: null },
  { id: "n-8", userId: "u-implementer", type: "client_health", text: "Bluewater Plumbing health dropped to 58", href: "/clients", createdAt: minutesAgo(90), readAt: null },
];
