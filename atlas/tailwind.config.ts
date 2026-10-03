import type { Config } from "tailwindcss";

// Every color maps to a token in src/styles/tokens.css — never hard-code hex values in components.
// color-mix with <alpha-value> makes opacity modifiers work on token colors (e.g. bg-bg-deep/80, border-amber/40).
const token = (name: string) => `color-mix(in srgb, var(--${name}) calc(<alpha-value> * 100%), transparent)`;
const names = [
  "chrome", "bg", "bg-deep", "surface", "surface-2", "inset", "line", "line-soft", "line-strong", "line-button", "text", "text-2", "text-3", "label",
  "ice", "ice-ink", "cyan", "mint", "lavender", "amber", "coral", "blue", "teal", "orange", "pink", "lime", "cyan-line", "amber-line", "app",
];

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    // Raycast rhythm: 6px small controls, 8px buttons and inputs, 12px cards, 16px floating panels.
    borderRadius: { none: "0", DEFAULT: "6px", sm: "4px", md: "6px", lg: "8px", xl: "12px", "2xl": "16px", full: "9999px" },
    extend: {
      colors: {
        ...Object.fromEntries(names.map((n) => [n, token(n)])),
        // Status fills (already translucent; follow the theme).
        "cyan-tint": "var(--cyan-tint)",
        "mint-tint": "var(--mint-tint)",
        "lavender-tint": "var(--lavender-tint)",
        "amber-tint": "var(--amber-tint)",
        "coral-tint": "var(--coral-tint)",
      },
      boxShadow: { card: "var(--card-shadow)", pop: "var(--pop-shadow)" },
      fontFamily: { sans: ["var(--font)"], mono: ["var(--mono)"] },
      letterSpacing: { label: "var(--label-tracking)" },
      transitionDuration: { DEFAULT: "150ms" },
    },
  },
  plugins: [],
} satisfies Config;
