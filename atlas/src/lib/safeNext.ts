/**
 * Only internal, absolute paths are allowed as a post-login destination, so `?next=`
 * can never become an open redirect ("//evil.com", "https://…", "/\evil.com" are all rejected).
 */
export const safeNext = (next: string | null | undefined): string | null => {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  if (/[\u0000-\u001f]/.test(next)) return null;
  try {
    const url = new URL(next, "https://atlas.invalid");
    if (url.origin !== "https://atlas.invalid") return null;
    if (url.pathname === "/login") return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
};
