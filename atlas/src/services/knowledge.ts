/**
 * Knowledge search for the AI co-founder (A19). Supabase mode uses Postgres full-text search over `knowledge_docs`;
 * demo mode runs the same idea in the browser: documents split into passages under their headings, ranked with BM25.
 */

export interface KnowledgeDoc {
  path: string;
  content: string;
}

export interface Passage {
  path: string;
  heading: string;
  text: string;
  score: number;
}

const STOP = new Set(
  "a an and are as at be by can do does for from has have how i if in into is it its of on or our should so than that the their them then there these this to us was we what when which who why will with would you your about any all also been but each more most no not only per than up".split(" "),
);
const SYNONYM: Record<string, string> = { swiss: "switzerland", ch: "switzerland", clawback: "claw", clawed: "claw", uae: "dubai", gulf: "dubai", emails: "email", cancel: "cancel", cancels: "cancel", cancelled: "cancel", canceled: "cancel", mobiles: "mobile", competitor: "competitor", competitors: "competitor" };

const stem = (w: string) => {
  if (SYNONYM[w]) return SYNONYM[w];
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && w.endsWith("es") && !w.endsWith("ses")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  return w;
};

export const tokenize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[`*_|#>]/g, " ")
    .split(/[^a-z0-9€$.%]+/)
    .map((w) => w.replace(/^\.+|\.+$/g, ""))
    .filter((w) => w && !STOP.has(w))
    .map(stem);

/** Split a markdown file into passages: one per heading section, long sections and tables in pieces. */
export const chunk = (doc: KnowledgeDoc): Omit<Passage, "score">[] => {
  const out: Omit<Passage, "score">[] = [];
  let heading = doc.path;
  let buf: string[] = [];
  const flush = () => {
    const text = buf.join("\n").trim();
    buf = [];
    if (!text) return;
    // Tables: header + up to 8 rows per passage. Prose: ~700 characters per passage.
    const lines = text.split("\n");
    let piece: string[] = [];
    let tableHead: string[] = [];
    const push = () => {
      const t = piece.join("\n").trim();
      if (t) out.push({ path: doc.path, heading, text: t });
      piece = [];
    };
    for (const line of lines) {
      const isRow = line.trim().startsWith("|");
      if (isRow && /^\|[\s|:-]+\|$/.test(line.trim())) {
        tableHead = [piece.pop() ?? "", line];
        piece.push(...tableHead);
        continue;
      }
      piece.push(line);
      const size = piece.join("\n").length;
      if ((isRow && piece.length >= 10) || (!isRow && size > 700 && line.trim() === "")) {
        push();
        if (isRow) piece.push(...tableHead);
      }
    }
    if (piece.length > tableHead.length || !tableHead.length) push();
  };
  for (const line of doc.content.split("\n")) {
    const h = line.match(/^#{1,4}\s+(.*)/);
    if (h) {
      flush();
      heading = h[1].trim();
      continue;
    }
    buf.push(line);
  }
  flush();
  return out;
};

export interface KnowledgeIndex {
  docs: KnowledgeDoc[];
  search(query: string, opts?: { limit?: number; paths?: string[] }): Passage[];
}

/** BM25 over passages (k1 1.2, b 0.75); the heading and file name count as part of the passage. */
export const buildIndex = (docs: KnowledgeDoc[]): KnowledgeIndex => {
  const passages = docs.flatMap(chunk).map((p) => ({ ...p, tokens: tokenize(`${p.heading} ${p.path.replace(/[_/.-]/g, " ")} ${p.text}`) }));
  const df = new Map<string, number>();
  for (const p of passages) for (const t of new Set(p.tokens)) df.set(t, (df.get(t) ?? 0) + 1);
  const avg = passages.reduce((n, p) => n + p.tokens.length, 0) / Math.max(1, passages.length);
  const N = passages.length;
  return {
    docs,
    search(query, opts = {}) {
      const q = [...new Set(tokenize(query))];
      const scored: Passage[] = [];
      for (const p of passages) {
        if (opts.paths && !opts.paths.some((x) => p.path.startsWith(x))) continue;
        const tf = new Map<string, number>();
        for (const t of p.tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
        let score = 0;
        for (const t of q) {
          const f = tf.get(t);
          if (!f) continue;
          const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
          score += idf * ((f * 2.2) / (f + 1.2 * (0.25 + (0.75 * p.tokens.length) / avg)));
        }
        if (score > 0) scored.push({ path: p.path, heading: p.heading, text: p.text.length > 600 ? `${p.text.slice(0, 600)}…` : p.text, score: Math.round(score * 100) / 100 });
      }
      return scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, opts.limit ?? 5);
    },
  };
};

/** Core context sent with every question (prompt-cached): context/00–08, the latest context update and the decision log. */
export const coreContext = (docs: KnowledgeDoc[]) => {
  const core = docs.filter((d) => /^context\/0[0-8]_/.test(d.path));
  const updates = docs.filter((d) => /^context\/\d{4}-\d{2}-\d{2}_CONTEXT_UPDATE\.md$/.test(d.path)).sort((a, b) => b.path.localeCompare(a.path));
  return updates.length ? [...core, updates[0]] : core;
};

const fnv = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
};

/** "context 2026-09-28 · 3f9a1c22": the latest update's date and a hash of the core files (shown under answers). */
export const knowledgeVersion = (docs: KnowledgeDoc[]) => {
  const core = coreContext(docs);
  if (!core.length) return "not synced";
  const date = core.map((d) => d.path.match(/(\d{4}-\d{2}-\d{2})/)?.[1]).filter(Boolean).sort().pop() ?? "—";
  return `context ${date} · ${fnv(core.map((d) => d.path + d.content).join("\n")).slice(0, 8)}`;
};

export interface ParsedDecision {
  title: string;
  date: string;
  owner: string;
  status: string;
  reason: string;
  expectedImpact: string;
  reviewDate: string;
}

/** The `context/07` decision log: "**Decision:** … **Date:** … · **Owner:** … · **Status:** …" blocks. */
export const parseDecisionLog = (md: string): ParsedDecision[] => {
  const log = md.split(/^## Decision log\s*$/m)[1]?.split(/^## /m)[0] ?? "";
  return log
    .split(/(?=\*\*Decision:\*\*)/)
    .filter((b) => b.startsWith("**Decision:**"))
    .map((b) => {
      const field = (name: string) => b.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*([^·\\n]+)`))?.[1].trim() ?? "";
      return {
        title: field("Decision"),
        date: field("Date"),
        owner: field("Owner"),
        status: field("Status"),
        reason: field("Reason"),
        expectedImpact: field("Expected metric impact"),
        reviewDate: field("Review date"),
      };
    });
};
