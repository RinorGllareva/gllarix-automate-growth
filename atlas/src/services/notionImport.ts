/**
 * Notion "Export → Markdown & CSV" (unzipped) → pages with titles, nesting and links between them.
 * Notion names every page "Title <32 hex id>.md"; a page's children sit in a folder with the same name.
 * Databases arrive as CSV: those are skipped here (tasks come in through Tasks › Import).
 */
export interface ExportFile {
  /** Path inside the export, "/"-separated, e.g. "Wiki 1a2b…/Sales playbook 3c4d….md". */
  path: string;
  text: string;
}

export interface ParsedPage {
  /** Path without ".md": the page's identity inside this export. */
  key: string;
  title: string;
  notionId: string | null;
  parentKey: string | null;
  /** Body with Notion links still pointing at export paths (rewritten by linkTargets). */
  body: string;
  /** Keys of other pages this one links to, in order. */
  links: string[];
}

const ID = /\s+([0-9a-f]{32})$/i;

const splitName = (name: string) => {
  const m = name.match(ID);
  return { title: (m ? name.slice(0, m.index) : name).trim() || "Untitled", id: m ? m[1].toLowerCase() : null };
};

/** Resolve "../Other%20Page%20abc.md" against the folder of `from`. */
const resolve = (from: string, href: string) => {
  const parts = from.split("/").slice(0, -1);
  for (const seg of decodeURIComponent(href).split("/")) {
    if (seg === "..") parts.pop();
    else if (seg && seg !== ".") parts.push(seg);
  }
  return parts.join("/");
};

export const parseNotionExport = (files: ExportFile[]) => {
  const md = files.filter((f) => /\.md$/i.test(f.path)).map((f) => ({ ...f, path: f.path.replace(/\\/g, "/").replace(/^\/+/, "") }));
  const skipped = files.filter((f) => !/\.md$/i.test(f.path)).map((f) => f.path);
  const keys = new Set(md.map((f) => f.path.replace(/\.md$/i, "")));
  const pages: ParsedPage[] = md.map((f) => {
    const key = f.path.replace(/\.md$/i, "");
    const name = key.split("/").pop()!;
    const { title: fileTitle, id } = splitName(name);
    const dir = key.split("/").slice(0, -1).join("/");
    let body = f.text.replace(/\r\n/g, "\n");
    // Notion puts the title as the first "# " line: use it (it keeps punctuation the filename lost) and drop it.
    const first = body.match(/^\s*#\s+(.+)\n?/);
    const title = first ? first[1].trim() : fileTitle;
    if (first) body = body.slice(first[0].length).replace(/^\n+/, "");
    const links: string[] = [];
    body = body
      // Images can't come along in demo mode: leave a visible marker.
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt: string, src: string) => `[image: ${alt || decodeURIComponent(src).split("/").pop()}]`)
      .replace(/\[([^\]]+)\]\(([^)]+?\.md)\)/g, (m, text: string, href: string) => {
        if (/^https?:/i.test(href)) return m;
        const target = resolve(f.path, href).replace(/\.md$/i, "");
        if (!keys.has(target)) return `${text} (not in this export)`;
        links.push(target);
        return `[${text}](notion:${target})`;
      });
    return { key, title, notionId: id, parentKey: keys.has(dir) ? dir : null, body: body.trim(), links };
  });
  return { pages, skipped };
};

/** Swap the "notion:<key>" placeholders for real Atlas doc links once every page has an id. */
export const linkTargets = (body: string, idForKey: (key: string) => string | undefined) =>
  body.replace(/\]\(notion:([^)]+)\)/g, (m, key: string) => {
    const id = idForKey(key);
    return id ? `](/docs/${id})` : m;
  });
