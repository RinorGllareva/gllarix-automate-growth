/**
 * EmailProvider: the Gmail API (Google Workspace inboxes) plugs in behind this interface, from a server-side
 * Edge Function holding the OAuth tokens. The fake provider never sends anything; it records messages
 * and lets demo mode simulate replies so reply detection can be tested end to end.
 */
export interface OutgoingEmail {
  from: string;
  fromName: string;
  to: string;
  subject: string;
  body: string;
  /** RFC 8058 one-click unsubscribe. */
  listUnsubscribeUrl: string;
}

export interface SentEmail {
  messageId: string;
  threadId: string;
}

export interface IncomingReply {
  threadId: string;
  from: string;
  receivedAt: string;
  snippet: string;
}

export interface EmailProvider {
  readonly name: string;
  send(email: OutgoingEmail): Promise<SentEmail>;
  /** Replies received since a moment (polled by the sender job). */
  repliesSince(since: string): Promise<IncomingReply[]>;
}

export interface FakeMailbox {
  sent: (OutgoingEmail & SentEmail & { at: string })[];
  replies: IncomingReply[];
}

export const createFakeEmailProvider = (box: () => FakeMailbox, now: () => number = Date.now): EmailProvider => ({
  name: "Fake mailbox (no real email)",
  async send(email) {
    const id = Math.random().toString(36).slice(2, 10);
    const sent = { messageId: `fake-msg-${id}`, threadId: `fake-thread-${id}` };
    box().sent.push({ ...email, ...sent, at: new Date(now()).toISOString() });
    return sent;
  },
  async repliesSince(since) {
    // At or after: the sender ignores replies it has already applied, so overlap is safe and nothing is missed.
    return box().replies.filter((r) => r.receivedAt >= since);
  },
});
