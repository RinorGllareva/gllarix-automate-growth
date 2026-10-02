import { Link } from "react-router-dom";
import { Icon, ICONS } from "@/components/ui/primitives";
import { isMac } from "@/lib/hotkeys";
import { useTheme } from "@/lib/theme";

export interface PageChrome {
  /** Tracked-caps context label, e.g. "TUE 1 DEC · BDR SHIFT 08:00–16:00 VET". */
  context?: string;
  action?: { label: string; to: string };
}

interface TopBarProps extends PageChrome {
  unread: number;
  onOpenPalette: (query?: string) => void;
  onOpenNotifications: () => void;
}

/** Quick light/dark toggle (the user menu also offers "follow the system"). */
const ThemeToggle = () => {
  const { resolved, setPref } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setPref(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="flex h-10 w-10 items-center justify-center border border-line bg-surface text-text hover:border-line-button"
    >
      <Icon d={resolved === "dark" ? ICONS.sun : ICONS.moon} size={17} />
    </button>
  );
};

const TopBar = ({ context, action, unread, onOpenPalette, onOpenNotifications }: TopBarProps) => (
  <header className="sticky top-0 z-20 flex h-[72px] shrink-0 items-center gap-6 border-b border-line bg-chrome px-10">
    <label className="flex h-10 w-[380px] items-center gap-2.5 border border-line-strong bg-inset px-3 text-label focus-within:border-cyan">
      <Icon d={ICONS.search} size={16} />
      <input
        type="search"
        aria-label="Search leads, companies, deals"
        placeholder="Search leads, companies, deals"
        className="min-w-0 flex-1 border-0 bg-transparent font-sans text-[13px] text-text outline-none placeholder:text-label"
        value=""
        onFocus={() => onOpenPalette()}
        onChange={(e) => onOpenPalette(e.target.value)}
      />
      <span className="border border-line-strong bg-surface px-1.5 py-0.5 font-mono text-[11px]">{isMac() ? "⌘K" : "Ctrl K"}</span>
    </label>

    <div className="ml-auto flex items-center gap-5">
      {context ? <span className="label-caps hidden xl:inline">{context}</span> : null}
      <ThemeToggle />
      <button
        type="button"
        onClick={onOpenNotifications}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative flex h-10 w-10 items-center justify-center border border-line bg-surface text-text hover:border-line-button"
      >
        <Icon d={ICONS.bell} />
        {unread ? <span className="absolute right-2 top-2 h-1.5 w-1.5 bg-cyan" aria-hidden="true" /> : null}
      </button>
      {action ? (
        <Link to={action.to} className="btn-outline h-10">
          <span>{action.label}</span>
          <Icon d={ICONS.arrow} size={14} />
        </Link>
      ) : null}
    </div>
  </header>
);

export default TopBar;
