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
        className="w-full shrink-0 border border-line-strong bg-surface shadow-card"
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
interface ToastItem {
  id: number;
  text: string;
  tone: ToastTone;
}

const ToastContext = createContext<(text: string, tone?: ToastTone) => void>(() => undefined);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, tone: ToastTone = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <Toast key={t.id} tone={t.tone}>
            {t.text}
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
    <div className="pointer-events-auto flex min-w-72 items-center gap-3 border border-line-strong bg-surface px-4 py-3 text-[13px]">
      <span className={`h-2 w-2 shrink-0 ${dot}`} aria-hidden="true" />
      {children}
    </div>
  );
};
