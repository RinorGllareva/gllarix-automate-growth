/**
 * TelephonyProvider: browser calling behind an interface so Twilio Client can replace the fake later (A3, M3).
 * The fake never dials anything: it simulates ringing → connected and produces a fake recording URL.
 */
export type CallStatus = "ready" | "ringing" | "connected" | "ended";

export interface CallHandle {
  id: string;
  hangUp(): void;
  setMuted(muted: boolean): void;
  setHeld(held: boolean): void;
  sendDigits(digits: string): void;
}

export interface CallEvents {
  onStatus(status: CallStatus): void;
}

export interface CallResult {
  durationS: number;
  /** Recording is kept for calls over 60 s (the opener carries the notice). */
  recordingUrl: string | null;
}

export interface TelephonyProvider {
  readonly name: string;
  readonly available: boolean;
  /** Places a manually dialed call (no autodialer). Resolves when the call ends. */
  call(toE164: string, events: CallEvents): { handle: CallHandle; ended: Promise<CallResult> };
}

export const RECORD_AFTER_S = 60;

export const createFakeTelephony = (opts: { ringMs?: number; now?: () => number } = {}): TelephonyProvider => {
  const ringMs = opts.ringMs ?? 1800;
  const now = opts.now ?? Date.now;
  return {
    name: "Fake (no real calls)",
    available: true,
    call(toE164, events) {
      const id = `fake-${Math.random().toString(36).slice(2, 10)}`;
      let connectedAt: number | null = null;
      let finish: (r: CallResult) => void = () => undefined;
      const ended = new Promise<CallResult>((resolve) => {
        finish = resolve;
      });
      events.onStatus("ringing");
      const timer = setTimeout(() => {
        connectedAt = now();
        events.onStatus("connected");
      }, ringMs);
      const handle: CallHandle = {
        id,
        hangUp() {
          clearTimeout(timer);
          const durationS = connectedAt ? Math.round((now() - connectedAt) / 1000) : 0;
          events.onStatus("ended");
          finish({ durationS, recordingUrl: durationS > RECORD_AFTER_S ? `fake-recording://${id}?to=${encodeURIComponent(toE164)}` : null });
        },
        setMuted: () => undefined,
        setHeld: () => undefined,
        sendDigits: () => undefined,
      };
      return { handle, ended };
    },
  };
};

export const telephony: TelephonyProvider = createFakeTelephony();
