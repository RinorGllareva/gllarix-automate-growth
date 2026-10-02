import type { CSSProperties, ReactNode } from "react";
import { useHeroRevealed } from "@/contexts/IntroContext";
import FluidGlassBackground from "./FluidGlassBackground";

const EASE = "cubic-bezier(.16,1,.3,1)";

/** Fades and lifts in once the intro hands off to the hero. */
const revealStyle = (revealed: boolean, delay: number): CSSProperties => ({
  opacity: revealed ? 1 : 0,
  transform: revealed ? "none" : "translateY(14px)",
  transition: `opacity .9s ease ${delay}s, transform 1.1s ${EASE} ${delay}s`,
});

/** A headline line that slides up from behind its own mask. */
const MaskLine = ({
  revealed,
  delay,
  className,
  children,
}: {
  revealed: boolean;
  delay: number;
  className: string;
  children: ReactNode;
}) => (
  <span className={`block overflow-hidden pb-[0.04em] ${className}`}>
    <span
      className="block"
      style={{
        transform: revealed ? "none" : "translateY(104%)",
        transition: `transform 1.15s ${EASE} ${delay}s`,
      }}
    >
      {children}
    </span>
  </span>
);

const Hero = () => {
  const revealed = useHeroRevealed();

  return (
    <section className="relative min-h-screen overflow-hidden bg-black">
      <FluidGlassBackground />
      <div className="absolute inset-x-0 bottom-0 z-20 h-px bg-gradient-to-r from-transparent via-cyan-300/30 to-violet-300/30" />

      {/* Category Badge */}
      <div
        className="absolute left-4 top-28 z-30 sm:left-8 sm:top-36 lg:left-12"
        style={revealStyle(revealed, 0.45)}
      >
        <div className="flex items-center gap-3 text-[10px] font-light uppercase text-cyan-100/60 sm:text-xs">
          <span className="h-px w-8 bg-gradient-to-r from-cyan-200/70 to-violet-300/35" />
          <span className="tracking-[0.28em]">Autonomous operations</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-20 flex min-h-screen items-center pb-28 pt-36 sm:pb-32 sm:pt-44">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12">
          <div className="grid items-end gap-12 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-16">
            <div className="max-w-5xl">
              <h1 className="flex flex-col items-start text-white [font-family:'Helvetica_Neue',Helvetica,Arial,sans-serif]">
                <MaskLine
                  revealed={revealed}
                  delay={0.05}
                  className="text-3xl font-extralight leading-none text-white/82 sm:text-4xl md:text-5xl lg:text-6xl"
                >
                  THE
                </MaskLine>
                <MaskLine
                  revealed={revealed}
                  delay={0.14}
                  className="text-6xl font-semibold leading-[0.84] sm:text-8xl md:text-9xl lg:text-[9rem] xl:text-[10.5rem]"
                >
                  <span className="bg-gradient-to-r from-white via-white to-cyan-100 bg-clip-text text-transparent">
                    FUTURE
                  </span>
                </MaskLine>
                <MaskLine
                  revealed={revealed}
                  delay={0.24}
                  className="ml-6 mt-3 whitespace-nowrap text-4xl font-thin leading-[0.9] text-neutral-200 sm:ml-12 sm:text-5xl md:ml-20 md:text-7xl lg:ml-24 lg:text-7xl xl:ml-28 xl:text-[5.5rem]"
                >
                  RUNS ITSELF.
                </MaskLine>
              </h1>
            </div>

            <aside
              className="ml-auto max-w-[19rem] border-l border-white/20 pl-5 text-left lg:mb-2"
              style={revealStyle(revealed, 0.5)}
            >
              <p className="mb-3 text-[10px] font-light uppercase tracking-[0.3em] text-white/45">
                Precision automation
              </p>
              <h2 className="[font-family:'Helvetica_Neue',Helvetica,Arial,sans-serif] text-3xl font-extralight uppercase leading-none text-white sm:text-4xl">
                On the dot<span className="text-violet-300/75">.</span>
              </h2>
              <p className="mt-4 text-xs font-light leading-relaxed text-white/48 sm:text-sm">
                Calls, bookings, and follow-up handled continuously while your
                team moves forward.
              </p>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
