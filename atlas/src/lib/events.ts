/** Fired after anything changes today's queue (an outcome, a skip, a rebuild) so Today and the sidebar refresh at once. */
export const QUEUE_UPDATED = "atlas:queue-updated";

export const queueUpdated = () => window.dispatchEvent(new Event(QUEUE_UPDATED));
