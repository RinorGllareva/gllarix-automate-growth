/**
 * A tiny text-only PDF writer (A4, Helvetica, wrapped lines, several pages). Enough for signed contracts in demo mode;
 * no dependency and no network. Characters outside Latin-1 are replaced, "€" becomes "EUR".
 */
const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 56;
const SIZE = 10;
const LEADING = 14;
// Helvetica at 10 pt averages ~5 pt per character: a safe wrap width.
const CHARS_PER_LINE = Math.floor((PAGE_W - 2 * MARGIN) / (SIZE * 0.5));
const LINES_PER_PAGE = Math.floor((PAGE_H - 2 * MARGIN) / LEADING);

export interface PdfBlock {
  text: string;
  /** Headings are bold and get a blank line before them. */
  heading?: boolean;
}

const latin1 = (s: string) =>
  s
    .replace(/€ ?/g, "EUR ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/·/g, "-")
    .replace(/[^\x0A\x20-\x7E\xA0-\xFF]/g, "?");

const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

export const wrap = (text: string, width = CHARS_PER_LINE) => {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (!para.trim()) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of para.split(/\s+/)) {
      if (!line) line = word;
      else if (line.length + 1 + word.length <= width) line += ` ${word}`;
      else {
        out.push(line);
        line = word;
      }
      while (line.length > width) {
        out.push(line.slice(0, width));
        line = line.slice(width);
      }
    }
    out.push(line);
  }
  return out;
};

/** Builds the PDF and returns it as a base64 string (for a data: URL). */
export const textPdf = (title: string, blocks: PdfBlock[]): string => {
  const lines: { text: string; bold: boolean }[] = [{ text: latin1(title), bold: true }, { text: "", bold: false }];
  for (const b of blocks) {
    if (b.heading) lines.push({ text: "", bold: false });
    for (const l of wrap(latin1(b.text))) lines.push({ text: l, bold: !!b.heading });
  }
  const pages: (typeof lines)[] = [];
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) pages.push(lines.slice(i, i + LINES_PER_PAGE));

  // Objects: 1 catalog, 2 pages, 3 font, 4 bold font, then a page + content pair per page.
  const objs: string[] = [];
  const pageIds = pages.map((_, i) => 5 + i * 2);
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  pages.forEach((pl, i) => {
    const ops = ["BT", `${MARGIN} ${PAGE_H - MARGIN} Td`, `${LEADING} TL`];
    for (const l of pl) ops.push(`/${l.bold ? "F2" : "F1"} ${SIZE} Tf (${escape(l.text)}) Tj T*`);
    ops.push("ET", `BT /F1 8 Tf ${PAGE_W - MARGIN - 40} 30 Td (Page ${i + 1} of ${pages.length}) Tj ET`);
    const stream = ops.join("\n");
    objs[pageIds[i]] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageIds[i] + 1} 0 R >>`;
    objs[pageIds[i] + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  // Every character is one byte (Latin-1), so string offsets are byte offsets.
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objs.length; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objs[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objs.length; id++) out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return btoa(out);
};

/** SHA-256 of the contract text, shown on the signature page so anyone can check the text wasn't changed. */
export const sha256Hex = async (text: string) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
};
