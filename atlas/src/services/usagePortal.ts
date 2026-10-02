/**
 * UsagePortal: daily usage from the voice platform (CRM_BUILD_PROMPT M7). The fake provider is deterministic per
 * account and day, so a month always imports the same numbers. The real provider calls the platform's API server-side.
 */

export interface RawUsageDay {
  minutes: number;
  calls: number;
  afterHours: number;
  booked: number;
  missed: number;
}

export interface UsagePortal {
  dailyUsage(accountId: string, date: string): RawUsageDay;
}

/** Fake account profile: `level` scales the client's normal use; usage drops by `declineTo` from `declineFrom`. */
export interface FakeVoiceAccount {
  minutesPerDay: number;
  level: number;
  declineFrom: string | null;
  declineTo: number;
}

/** 0–1 from a string (FNV-1a). */
export const hash01 = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0xffffffff;
};

export const createFakeUsagePortal = (accounts: () => Record<string, FakeVoiceAccount>): UsagePortal => ({
  dailyUsage(accountId, date) {
    const acc = accounts()[accountId];
    if (!acc) return { minutes: 0, calls: 0, afterHours: 0, booked: 0, missed: 0 };
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const dayFactor = weekday === 0 ? 0.5 : weekday === 6 ? 0.7 : 1.1;
    const noise = 0.75 + hash01(`${accountId}:${date}`) * 0.5;
    const decline = acc.declineFrom && date >= acc.declineFrom ? acc.declineTo : 1;
    const minutes = Math.round(acc.minutesPerDay * acc.level * dayFactor * noise * decline);
    const calls = Math.round(minutes / 2.4);
    return {
      minutes,
      calls,
      afterHours: Math.round(calls * (0.2 + hash01(`ah:${accountId}:${date}`) * 0.08)),
      booked: Math.round(calls * (0.11 + hash01(`bk:${accountId}:${date}`) * 0.04) * (decline < 1 ? 0.6 : 1)),
      missed: hash01(`ms:${accountId}:${date}`) < 0.06 ? 1 : 0,
    };
  },
});
