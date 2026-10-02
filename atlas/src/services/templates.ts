import { TEMPLATE_VARIABLES } from "@/config/emailTemplates";

export type TemplateVars = Partial<Record<(typeof TEMPLATE_VARIABLES)[number]["key"], string>>;

const VAR = /{{\s*([a-z_.]+)\s*}}/g;
/** Text that must be written before anything is sent. */
const PLACEHOLDER = /\[TO WRITE[^\]]*\]/;

/** Fill {{variables}}; unknown or empty ones become "[MISSING: name]" so the sender can refuse them. */
export const renderTemplate = (text: string, vars: TemplateVars) =>
  text.replace(VAR, (_, key: string) => {
    const value = vars[key as keyof TemplateVars];
    return value && value.trim() ? value : `[MISSING: ${key}]`;
  });

/** Problems that stop a rendered message from being sent. */
export const unfinishedParts = (rendered: string) => {
  const problems: string[] = [];
  const todo = rendered.match(PLACEHOLDER);
  if (todo) problems.push(`Template still has "${todo[0]}"`);
  const missing = [...rendered.matchAll(/\[MISSING: ([a-z_.]+)\]/g)].map((m) => m[1]);
  if (missing.length) problems.push(`No value for ${[...new Set(missing)].join(", ")}`);
  return problems;
};

/** Saving a template: it must carry the unsubscribe link and use only known variables (admin/05_CADENCES.md). */
export const validateTemplate = (subject: string, body: string) => {
  const errors: string[] = [];
  if (!subject.trim()) errors.push("Add a subject.");
  if (!/{{\s*unsubscribe_url\s*}}/.test(body)) errors.push("Every template needs the {{unsubscribe_url}} variable.");
  const known = new Set<string>(TEMPLATE_VARIABLES.map((v) => v.key));
  const unknown = [...`${subject}\n${body}`.matchAll(VAR)].map((m) => m[1]).filter((k) => !known.has(k));
  if (unknown.length) errors.push(`Unknown variable${unknown.length > 1 ? "s" : ""}: ${[...new Set(unknown)].map((k) => `{{${k}}}`).join(", ")}`);
  return errors;
};
