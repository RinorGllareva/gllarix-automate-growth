/** Port of config/dispositions.yaml (CRM_BUILD_PROMPT A7): one-click outcomes, each with an automatic next action. */
export type DispositionKey =
  | "no_answer"
  | "voicemail"
  | "gatekeeper"
  | "wrong_number"
  | "not_interested"
  | "call_back"
  | "send_info"
  | "meeting_booked"
  | "do_not_contact";

export interface Disposition {
  key: DispositionKey;
  hotkey: string;
  label: string;
  /** Plain-English effect, shown as a hint. */
  effect: string;
  /** Counts as a call attempt. */
  attempt: boolean;
  /** Counts as a conversation (reached a person who could decide) for KPIs. */
  conversation: boolean;
  tone?: "ice" | "coral";
}

export const DISPOSITIONS: Disposition[] = [
  { key: "no_answer", hotkey: "1", label: "No answer", effect: "+1 attempt · next call per cadence", attempt: true, conversation: false },
  { key: "voicemail", hotkey: "2", label: "Voicemail", effect: "+1 attempt · next call per cadence · no voicemail drop", attempt: true, conversation: false },
  { key: "gatekeeper", hotkey: "3", label: "Gatekeeper", effect: "+1 attempt · retry next business day in the other window", attempt: true, conversation: false },
  { key: "wrong_number", hotkey: "4", label: "Wrong number", effect: "Phone marked invalid · sent to re-enrichment · out of today's queue", attempt: true, conversation: false },
  { key: "not_interested", hotkey: "5", label: "Not interested", effect: "Stage Nurture · email in 90 days where legal", attempt: true, conversation: true },
  { key: "call_back", hotkey: "6", label: "Call back", effect: "Callback task at the lead's local time", attempt: true, conversation: true },
  { key: "send_info", hotkey: "7", label: "Send info", effect: "Email task now · call in 2 business days", attempt: true, conversation: true },
  { key: "meeting_booked", hotkey: "8", label: "Meeting booked", effect: "Creates the meeting · stage Meeting booked · cadence stops", attempt: true, conversation: true, tone: "ice" },
  { key: "do_not_contact", hotkey: "9", label: "Do not contact", effect: "Opt-out list · all cadences stop · stage Lost", attempt: true, conversation: true, tone: "coral" },
];

export const dispositionByKey = (key: string) => DISPOSITIONS.find((d) => d.key === key);
export const dispositionByLabel = (label: string) => DISPOSITIONS.find((d) => d.label === label);
