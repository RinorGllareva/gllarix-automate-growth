import { useEffect, useRef, useState, type ReactNode } from "react";
import { useToast } from "@/components/ui/overlay";
import { data } from "@/data";

/**
 * Delete with Undo (page standard §3): runs a delete that returns a trash id, then shows a toast whose Undo restores
 * it. `done` reloads the page either way.
 */
export const useDeleteWithUndo = () => {
  const toast = useToast();
  return async (label: string, run: () => Promise<string>, done: () => void) => {
    try {
      const trashId = await run();
      done();
      toast(`${label} deleted`, "info", {
        label: "Undo",
        run: async () => {
          try {
            await data.restoreFromTrash(trashId);
            toast(`${label} restored`, "good");
          } catch (e) {
            toast((e as Error).message, "error");
          } finally {
            done();
          }
        },
      });
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
};

/** Run an action with a success toast and an error toast; returns whether it worked. */
export const useRun = () => {
  const toast = useToast();
  return async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast(ok, "good");
      return true;
    } catch (e) {
      toast((e as Error).message, "error");
      return false;
    }
  };
};

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  hidden?: boolean;
}

/** The ⋯ menu on rows and records: Edit, Delete and friends. Keyboard: Enter/Space opens, Esc closes. */
export const RowMenu = ({ items, label = "More actions" }: { items: MenuItem[]; label?: string }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const shown = items.filter((i) => !i.hidden);
  if (!shown.length) return null;
  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((x) => !x);
        }}
        className="flex h-7 w-7 items-center justify-center rounded-md text-text-3 hover:bg-surface-2 hover:text-text"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="19" cy="12" r="1.7" />
        </svg>
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-8 z-40 flex min-w-40 flex-col rounded-lg border border-line-strong bg-surface p-1 text-[13px] shadow-pop">
          {shown.map((i) => (
            <button
              key={i.label}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                i.onSelect();
              }}
              className={`flex h-8 items-center rounded-md px-2.5 text-left hover:bg-surface-2 ${i.danger ? "text-coral" : "text-text"}`}
            >
              {i.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

/** A small labelled field used by the edit forms. */
export const Field = ({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) => (
  <label className={`flex flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
    <span className="field-label">{label}</span>
    {children}
  </label>
);
