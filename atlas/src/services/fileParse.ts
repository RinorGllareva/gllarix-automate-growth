import Papa from "papaparse";

/** A spreadsheet-like file as a header row plus rows of text cells. */
export interface ParsedTable {
  headers: string[];
  rows: Record<string, string>[];
  /** Which sheet was read (XLSX). */
  sheet?: string;
}

export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

const cellText = (v: unknown): string => (v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));

const fromCsv = (text: string): ParsedTable => {
  const res = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
  const headers = (res.meta.fields ?? []).filter(Boolean);
  return { headers, rows: res.data.map((r) => Object.fromEntries(headers.map((h) => [h, cellText(r[h]).trim()]))) };
};

const fromJson = (text: string): ParsedTable => {
  const data = JSON.parse(text) as unknown;
  const list = Array.isArray(data) ? data : data && typeof data === "object" ? (Object.values(data as object).find(Array.isArray) as unknown[] | undefined) : undefined;
  if (!list?.length || typeof list[0] !== "object") throw new Error("The JSON needs a list of objects, e.g. [{\"name\": \"…\"}].");
  const headers = [...new Set(list.flatMap((r) => Object.keys(r as object)))];
  return { headers, rows: list.map((r) => Object.fromEntries(headers.map((h) => [h, cellText((r as Record<string, unknown>)[h]).trim()]))) };
};

// ---------------------------------------------------------------- XLSX (a zip of XML files)

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** The entries of a zip file: name → a function that returns its bytes (stored or deflated). */
const unzip = (buf: Uint8Array) => {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (u32(buf, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("That isn't a readable .xlsx file.");
  const count = u16(buf, eocd + 10);
  let p = u32(buf, eocd + 16);
  const entries = new Map<string, () => Promise<Uint8Array>>();
  for (let n = 0; n < count; n++) {
    if (u32(buf, p) !== 0x02014b50) break;
    const method = u16(buf, p + 10);
    const size = u32(buf, p + 20);
    const nameLen = u16(buf, p + 28);
    const extraLen = u16(buf, p + 30);
    const commentLen = u16(buf, p + 32);
    const local = u32(buf, p + 42);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));
    const start = local + 30 + u16(buf, local + 26) + u16(buf, local + 28);
    const raw = buf.subarray(start, start + size);
    entries.set(name, async () => {
      if (method === 0) return raw;
      if (method !== 8) throw new Error("This .xlsx uses a compression Atlas can't read. Save it as CSV instead.");
      return pipeBytes(raw, new DecompressionStream("deflate-raw"));
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
};

/** Bytes through a (de)compression stream, read by hand so it works in every browser and in tests. */
export const pipeBytes = async (bytes: Uint8Array, transform: TransformStream<Uint8Array, Uint8Array>) => {
  const reader = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(bytes);
      c.close();
    },
  })
    .pipeThrough(transform)
    .getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
};

const xml = (text: string) => new DOMParser().parseFromString(text, "application/xml");
const colIndex = (ref: string) => {
  const letters = ref.replace(/\d+/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

const fromXlsx = async (buf: ArrayBuffer): Promise<ParsedTable> => {
  const zip = unzip(new Uint8Array(buf));
  const read = async (name: string) => {
    const get = zip.get(name);
    return get ? new TextDecoder().decode(await get()) : null;
  };
  // The first sheet in the workbook's order.
  let sheetPath = "xl/worksheets/sheet1.xml";
  let sheetName = "Sheet1";
  const wb = await read("xl/workbook.xml");
  const rels = await read("xl/_rels/workbook.xml.rels");
  if (wb && rels) {
    const first = xml(wb).getElementsByTagName("sheet")[0];
    const rid = first?.getAttribute("r:id") ?? first?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    const rel = [...xml(rels).getElementsByTagName("Relationship")].find((r) => r.getAttribute("Id") === rid);
    const target = rel?.getAttribute("Target");
    if (target) sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
    sheetName = first?.getAttribute("name") ?? sheetName;
  }
  const sheet = await read(sheetPath);
  if (!sheet) throw new Error("That .xlsx has no sheet Atlas can read.");
  const sharedXml = await read("xl/sharedStrings.xml");
  const shared = sharedXml ? [...xml(sharedXml).getElementsByTagName("si")].map((si) => si.textContent ?? "") : [];
  const grid: string[][] = [];
  for (const row of [...xml(sheet).getElementsByTagName("row")]) {
    const cells: string[] = [];
    for (const c of [...row.getElementsByTagName("c")]) {
      const i = colIndex(c.getAttribute("r") ?? "A");
      const t = c.getAttribute("t");
      const v = c.getElementsByTagName("v")[0]?.textContent ?? "";
      cells[i] = t === "s" ? (shared[Number(v)] ?? "") : t === "inlineStr" ? (c.getElementsByTagName("is")[0]?.textContent ?? "") : t === "b" ? (v === "1" ? "TRUE" : "FALSE") : v;
    }
    grid.push(Array.from(cells, (x) => (x ?? "").trim()));
  }
  const nonEmpty = grid.filter((r) => r.some(Boolean));
  if (!nonEmpty.length) return { headers: [], rows: [], sheet: sheetName };
  const headers = nonEmpty[0].map((h, i) => h || `Column ${i + 1}`);
  return { headers, rows: nonEmpty.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""]))), sheet: sheetName };
};

const readBuffer = (file: Blob) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(new Error("Couldn't read that file."));
    r.readAsArrayBuffer(file);
  });

/** CSV, JSON or XLSX → headers and rows. Throws with a message for the person importing. */
export const parseTable = async (file: File): Promise<ParsedTable> => {
  if (file.size > MAX_IMPORT_BYTES) throw new Error("That file is over 20 MB. Split it and import the parts.");
  const name = file.name.toLowerCase();
  const buf = await readBuffer(file);
  if (name.endsWith(".xlsx")) return fromXlsx(buf);
  if (name.endsWith(".xls")) throw new Error("Old .xls files can't be read: save it as .xlsx or CSV.");
  const text = new TextDecoder().decode(buf);
  if (name.endsWith(".json") || /^\s*[[{]/.test(text)) return fromJson(text);
  return fromCsv(text);
};
