interface LiquidGlassBackgroundProps {
  variant: "hero" | "footer" | "sections" | "secondary";
}

const LiquidGlassBackground = ({
  variant,
}: LiquidGlassBackgroundProps) => (
  <div
    className={`liquid-glass-background liquid-glass-background--${variant}`}
    aria-hidden="true"
  />
);

export default LiquidGlassBackground;
