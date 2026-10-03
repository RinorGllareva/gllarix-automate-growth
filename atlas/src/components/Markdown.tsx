import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Safe Markdown for docs: headings, lists (bullets, numbers, checkboxes), quotes, code blocks, tables, rules, and
 * inline bold, italic, code and links. Everything is rendered as React text: no raw HTML ever reaches the page.
 */
const inline = (text: string, key: string): ReactNode[] => {
  const out: ReactNode[] = [];
  // Order matters: code first (its content isn't formatted), then links, bold, italic.
  const re = /(`[^`]+`)|(\[([^\]]+)\]\(([^)\s]+)\))|(\*\*([^*]+)\*\*)|(\*([^*\s][^*]*)\*|(?<!\w)_([^_]+)_(?!\w))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${n++}`;
    if (m[1]) out.push(<code key={k} className="rounded bg-inset px-1 py-0.5 font-mono text-[0.9em] text-text">{m[1].slice(1, -1)}</code>);
    else if (m[2]) {
      const href = m[4];
      out.push(
        href.startsWith("/") ? (
          <Link key={k} to={href} className="text-cyan underline decoration-cyan/40 underline-offset-2 hover:decoration-cyan">
            {m[3]}
          </Link>
        ) : /^(https?:|mailto:)/i.test(href) ? (
          <a key={k} href={href} target="_blank" rel="noreferrer" className="text-cyan underline decoration-cyan/40 underline-offset-2 hover:decoration-cyan">
            {m[3]}
          </a>
        ) : (
          m[3]
        ),
      );
    } else if (m[5]) out.push(<strong key={k} className="font-semibold text-text">{m[6]}</strong>);
    else out.push(<em key={k}>{m[8] ?? m[9]}</em>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
};

const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

const Markdown = ({ text, empty }: { text: string; empty?: ReactNode }) => {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const k = `b${i}`;
    if (/^```/.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      out.push(<pre key={k} className="m-0 overflow-x-auto rounded-lg bg-inset p-3 font-mono text-[12px] leading-relaxed text-text">{code.join("\n")}</pre>);
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)/);
    if (h) {
      const Tag = (["h2", "h3", "h4"] as const)[h[1].length - 1];
      const size = ["text-[22px]", "text-[18px]", "text-[15px]"][h[1].length - 1];
      out.push(<Tag key={k} className={`m-0 mt-3 font-semibold leading-snug tracking-[-0.01em] text-text first:mt-0 ${size}`}>{inline(h[2], k)}</Tag>);
      i++;
      continue;
    }
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      out.push(<hr key={k} className="my-1 border-0 border-t border-line" />);
      i++;
      continue;
    }
    if (isTableRow(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) rows.push(cells(lines[i++]));
      out.push(
        <div key={k} className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-[13px]">
            <thead className="bg-surface-2/60 text-left text-text-3">
              <tr>
                {head.map((c, j) => (
                  <th key={j} className="px-3 py-2 font-medium">
                    {inline(c, `${k}h${j}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-t border-line-soft">
                  {r.map((c, j) => (
                    <td key={j} className="px-3 py-2 align-top">
                      {inline(c, `${k}r${ri}c${j}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ""));
      out.push(<blockquote key={k} className="m-0 border-l-2 border-line-strong pl-3 text-text-2">{inline(quote.join(" "), k)}</blockquote>);
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        const m = lines[i].match(/^\s*(?:[-*]|\d+\.)\s+(\[( |x)\]\s+)?(.*)/i)!;
        items.push(
          <li key={i} className={m[1] ? "flex list-none items-start gap-2 -ml-5" : ""}>
            {m[1] ? <input type="checkbox" readOnly checked={m[2].toLowerCase() === "x"} className="pointer-events-none mt-1 h-3.5 w-3.5" aria-label={m[2].toLowerCase() === "x" ? "Done" : "Not done"} /> : null}
            <span>{inline(m[3], `${k}-${i}`)}</span>
          </li>,
        );
        i++;
      }
      const cls = "m-0 flex flex-col gap-1 pl-5";
      out.push(ordered ? <ol key={k} className={`${cls} list-decimal`}>{items}</ol> : <ul key={k} className={`${cls} list-disc`}>{items}</ul>);
      continue;
    }
    if (line.trim()) {
      const para: string[] = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|\s*[-*]\s|\s*\d+\.\s|\s*>|\s*\|)/.test(lines[i])) para.push(lines[i++]);
      if (!para.length) para.push(lines[i++]);
      out.push(<p key={k} className="m-0">{inline(para.join(" "), k)}</p>);
      continue;
    }
    i++;
  }
  return <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-text-2">{out.length ? out : (empty ?? null)}</div>;
};

export default Markdown;
