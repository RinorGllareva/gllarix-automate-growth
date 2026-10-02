import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { Plugin } from "vite";

/**
 * `virtual:atlas-knowledge`: the company files the AI co-founder searches in demo mode (A19 knowledge_docs).
 *
 * Only in `vite dev` and vitest. A production build gets an empty list: the repo is public and the bundle is served to
 * anyone, so business documents never ship in it. In Supabase mode the deploy job syncs these files (and the prompts)
 * into `knowledge_docs` on the server instead. Prompts (`spec/prompts`) are never included here: they stay server-side.
 */
const FOLDERS = ["context", "backbone", "plans"];
const FILES = ["pricing/README.md", "models/README.md"];

export const knowledgePlugin = (specDir: string): Plugin => {
  let build = false;
  const id = "virtual:atlas-knowledge";
  const resolved = `\0${id}`;
  return {
    name: "atlas-knowledge",
    configResolved(c) {
      build = c.command === "build";
    },
    resolveId: (x) => (x === id ? resolved : null),
    load(x) {
      if (x !== resolved) return null;
      if (build || !existsSync(specDir)) return "export default [];";
      const files: string[] = [];
      for (const f of FOLDERS) {
        const dir = join(specDir, f);
        if (!existsSync(dir)) continue;
        for (const name of readdirSync(dir)) if (name.endsWith(".md") && statSync(join(dir, name)).isFile()) files.push(join(dir, name));
      }
      for (const f of FILES) if (existsSync(join(specDir, f))) files.push(join(specDir, f));
      // Watch the files so edits to the spec pack reach the advisor without restarting the dev server.
      for (const p of files) this.addWatchFile(p);
      const docs = files.sort().map((p) => ({ path: relative(specDir, p).replace(/\\/g, "/"), content: readFileSync(p, "utf8") }));
      return `export default ${JSON.stringify(docs)};`;
    },
  };
};
