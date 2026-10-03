import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, ICONS } from "./primitives";

/** Closes on Escape and returns focus to whatever opened the overlay. */
const useOverlayFocus = (open: boolean, onClose: () => void) => {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    const first = panelRef.current?.querySelector<HTMLElement>("input, button, [href], [tabindex]:not([tabindex='-1'])");
    first?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [open, onClose]);
  return panelRef;
};

export const Modal = ({
  open,
  onClose,
  title,
  children,
  width = 560,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: number;
}) => {
  const ref = useOverlayFocus(open, onClose);
  if (!open) return null;
  return (
    // Scrolls when the dialog is taller than the window (short screens), so every button stays reachable.
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-bg-deep/80 px-4 py-[min(6rem,8vh)]" onMouseDown={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full shrink-0 border border-line-strong rounded-lg bg-surface shadow-card"
        style={{ maxWidth: width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex h-14 items-center justify-between border-b border-line px-5">
          <span className="label-caps">{title}</span>
          <button type="button" onClick={onClose} aria-label="Close" className="text-text-2 hover:text-text">
            <Icon d={ICONS.close} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

export const Drawer = ({
  open,
  onClose,
  title,
  children,
  width = 420,
  headerAction,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: number;
  headerAction?: ReactNode;
}) => {
  const ref = useOverlayFocus(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-bg-deep/60" onMouseDown={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute bottom-0 right-0 top-0 flex w-full flex-col border-l border-line-strong bg-surface"
        style={{ maxWidth: width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line px-5">
          <span className="label-caps">{title}</span>
          <div className="flex items-center gap-4">
            {headerAction}
            <button type="button" onClick={onClose} aria-label="Close" className="text-text-2 hover:text-text">
              <Icon d={ICONS.close} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

type ToastTone = "info" | "good" | "error";
/** An optional button on the toast, e.g. Undo after a delete. Toasts with an action stay 10 s. */
export interface ToastAction {
  label: string;
  run: () => void | Promise<void>;
}
interface ToastItem {
  id: number;
  text: string;
  tone: ToastTone;
  action?: ToastAction;
}

const ToastContext = createContext<(text: string, tone?: ToastTone, action?: ToastAction) => void>(() => undefined);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const drop = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (text: string, tone: ToastTone = "info", action?: ToastAction) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, text, tone, action }]);
      window.setTimeout(() => drop(id), action ? 10_000 : 4000);
    },
    [drop],
  );
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-20 right-4 z-[60] flex flex-col gap-2 lg:bottom-6 lg:right-6" aria-live="polite">
        {toasts.map((t) => (
          <Toast key={t.id} tone={t.tone}>
            <span className="min-w-0 flex-1">{t.text}</span>
            {t.action ? (
              <button
                type="button"
                className="shrink-0 rounded-md px-2 py-1 text-[13px] font-medium text-cyan hover:bg-surface-2"
                onClick={async () => {
                  drop(t.id);
                  await t.action!.run();
                }}
              >
                {t.action.label}
              </button>
            ) : null}
          </Toast>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

export const Toast = ({ tone = "info", children }: { tone?: ToastTone; children: ReactNode }) => {
  const dot = { info: "bg-cyan", good: "bg-mint", error: "bg-coral" }[tone];
  return (
    <div className="pointer-events-auto flex min-w-72 items-center gap-3 border border-line-strong rounded-lg bg-surface px-4 py-3 text-[13px]">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      {children}
    </div>
  );
};
