import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

const wordmarkSrc = "/Gllarix_NamePNG.png";

const INTRO_DURATION_MS = 4300;
const HANDOFF_DURATION_MS = 820;
const ICON_HANDOFF_DELAY_S = 0.26;
const ICON_HANDOFF_DURATION_S = 0.5;
const ASSEMBLY_DURATION_S = 3.15;
const ICON_SHIFT_DELAY_S = 3.05;
const ICON_SHIFT_DURATION_S = 0.82;
const WORDMARK_REVEAL_DELAY_S = 3.22;
const WORDMARK_REVEAL_DURATION_S = 0.7;
const SETTLE_DURATION_S = 3.65;
const GLOW_DURATION_S = 4.2;
const getLogoShift = () => {
  if (window.innerWidth < 640) {
    return -89;
  }

  if (window.innerWidth < 768) {
    return -116;
  }

  return -135;
};

interface LoadingScreenProps {
  forceMotion?: boolean;
  onComplete: () => void;
}

interface HandoffTransform {
  x: number;
  y: number;
  scale: number;
}

const logoPieces = [
  {
    id: "top-left",
    src: "/logo-pieces/piece-1.png",
    from: { x: "-38vw", y: "-35vh", rotate: -10 },
    delay: 0,
  },
  {
    id: "top-right",
    src: "/logo-pieces/piece-2.png",
    from: { x: "38vw", y: "-38vh", rotate: 10 },
    delay: 0.08,
  },
  {
    id: "left",
    src: "/logo-pieces/piece-3.png",
    from: { x: "-44vw", y: "-3vh", rotate: -8 },
    delay: 0.18,
  },
  {
    id: "right",
    src: "/logo-pieces/piece-4.png",
    from: { x: "44vw", y: "3vh", rotate: 8 },
    delay: 0.18,
  },
  {
    id: "bottom-left",
    src: "/logo-pieces/piece-5.png",
    from: { x: "-34vw", y: "38vh", rotate: 10 },
    delay: 0.08,
  },
  {
    id: "bottom-right",
    src: "/logo-pieces/piece-6.png",
    from: { x: "34vw", y: "40vh", rotate: -10 },
    delay: 0,
  },
] as const;

const introAssets = [
  ...logoPieces.map((piece) => piece.src),
  wordmarkSrc,
];

const LoadingScreen = ({
  forceMotion = false,
  onComplete,
}: LoadingScreenProps) => {
  const prefersReducedMotion = useReducedMotion();
  const shouldReduceMotion = Boolean(prefersReducedMotion && !forceMotion);
  const iconRef = useRef<HTMLDivElement>(null);
  const [logoShift] = useState(getLogoShift);
  const [assetsReady, setAssetsReady] = useState(false);
  const [isHandoff, setIsHandoff] = useState(false);
  const [handoff, setHandoff] = useState<HandoffTransform>({
    x: 0,
    y: 0,
    scale: 1,
  });

  const beginHandoff = useCallback(() => {
    const source = iconRef.current?.getBoundingClientRect();
    const target = document
      .querySelector<HTMLElement>("[data-gllarix-nav-icon]")
      ?.getBoundingClientRect();

    if (source && target) {
      setHandoff({
        x:
          logoShift +
          target.left +
          target.width / 2 -
          (source.left + source.width / 2),
        y: target.top + target.height / 2 - (source.top + source.height / 2),
        scale: target.width / source.width,
      });
    }

    setIsHandoff(true);
  }, [logoShift]);

  useEffect(() => {
    let cancelled = false;

    const decodeImage = (src: string) =>
      new Promise<void>((resolve) => {
        const image = new Image();
        const finish = () => resolve();

        image.onload = () => {
          image.decode().catch(() => undefined).finally(finish);
        };
        image.onerror = finish;
        image.src = src;

        if (image.complete) {
          image.decode().catch(() => undefined).finally(finish);
        }
      });

    Promise.all(introAssets.map(decodeImage)).then(() => {
      if (!cancelled) {
        requestAnimationFrame(() => setAssetsReady(true));
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!assetsReady) {
      return;
    }

    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    const introTimer = window.setTimeout(
      beginHandoff,
      shouldReduceMotion ? 700 : INTRO_DURATION_MS,
    );
    const completeTimer = window.setTimeout(
      onComplete,
      shouldReduceMotion
        ? 1050
        : INTRO_DURATION_MS + HANDOFF_DURATION_MS,
    );

    return () => {
      window.clearTimeout(introTimer);
      window.clearTimeout(completeTimer);
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [assetsReady, beginHandoff, onComplete, shouldReduceMotion]);

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden"
      role="status"
      aria-label="Gllarix is loading"
    >
      <motion.div
        className="absolute inset-0 bg-black"
        initial={{ opacity: 1 }}
        animate={{ opacity: isHandoff ? 0 : 1 }}
        transition={{
          duration: shouldReduceMotion ? 0.2 : 0.55,
          delay: isHandoff && !shouldReduceMotion ? 0.2 : 0,
          ease: [0.4, 0, 0.2, 1],
        }}
      />

      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          ref={iconRef}
          className="relative h-[116px] w-[110px] sm:h-[148px] sm:w-[140px] md:h-[174px] md:w-[165px] will-change-transform"
          animate={{
            x: isHandoff
              ? handoff.x
              : shouldReduceMotion
                ? logoShift
                : assetsReady
                  ? logoShift
                  : 0,
            y: isHandoff ? handoff.y : 0,
            scale: isHandoff ? handoff.scale : 1,
          }}
          transition={
            isHandoff
              ? {
                  duration: shouldReduceMotion
                    ? 0.25
                    : ICON_HANDOFF_DURATION_S,
                  delay: shouldReduceMotion ? 0 : ICON_HANDOFF_DELAY_S,
                  ease: [0.65, 0, 0.2, 1],
                }
              : shouldReduceMotion
                ? { duration: 0.3, ease: "easeOut" }
                : {
                    delay: ICON_SHIFT_DELAY_S,
                    duration: ICON_SHIFT_DURATION_S,
                    ease: [0.22, 1, 0.36, 1],
                  }
          }
        >
          <motion.div
            className="absolute -inset-10 rounded-full bg-primary/30 blur-3xl"
            initial={{ opacity: 0, scale: 0.65 }}
            animate={
              shouldReduceMotion
                ? { opacity: 0 }
                : assetsReady
                  ? {
                      opacity: [0, 0, 0.56, 0.16, 0],
                      scale: [0.72, 0.72, 1.18, 1.08, 1.12],
                    }
                  : { opacity: 0, scale: 0.72 }
            }
            transition={{
              duration: GLOW_DURATION_S,
              times: [0, 0.52, 0.62, 0.78, 1],
              ease: "easeOut",
            }}
          />

          <motion.div
            className="relative h-full w-full"
            animate={
              shouldReduceMotion
                ? { opacity: 1, scale: 1 }
                : assetsReady
                  ? { scale: [1, 1, 1.055, 0.992, 1] }
                  : { scale: 1 }
            }
            transition={{
              duration: SETTLE_DURATION_S,
              times: [0, 0.65, 0.75, 0.86, 1],
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {logoPieces.map((piece) => (
              <motion.img
                key={piece.id}
                src={piece.src}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="absolute inset-0 h-full w-full object-contain will-change-transform"
                initial={
                  shouldReduceMotion
                    ? { opacity: 1 }
                    : {
                        opacity: 0,
                        x: piece.from.x,
                        y: piece.from.y,
                        rotate: piece.from.rotate,
                        scale: 0.96,
                      }
                }
                animate={
                  assetsReady
                    ? { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }
                    : {
                        opacity: 0,
                        x: piece.from.x,
                        y: piece.from.y,
                        rotate: piece.from.rotate,
                        scale: 0.96,
                      }
                }
                transition={
                  shouldReduceMotion
                    ? { duration: 0.15 }
                    : {
                        delay: piece.delay,
                        duration: ASSEMBLY_DURATION_S,
                        ease: [0.25, 0.1, 0.25, 1],
                      }
                }
                style={{ backfaceVisibility: "hidden" }}
              />
            ))}
          </motion.div>
        </motion.div>

        <div className="pointer-events-none absolute left-[calc(50%-24px)] top-[calc(50%-4px)] w-[168px] -translate-y-1/2 sm:left-[calc(50%-34px)] sm:top-[calc(50%-5px)] sm:w-[220px] md:left-[calc(50%-39px)] md:top-[calc(50%-6px)] md:w-[256px]">
          <motion.div
            className="overflow-hidden"
            initial={{ opacity: 0, clipPath: "inset(0 100% 0 0)" }}
            animate={{
              opacity: !assetsReady ? 0 : 1,
              clipPath: isHandoff
                ? "inset(0 100% 0 0)"
                : "inset(0 0% 0 0)",
              x: isHandoff ? -12 : 0,
            }}
            transition={
              isHandoff
                ? {
                    duration: shouldReduceMotion ? 0.15 : 0.42,
                    ease: [0.4, 0, 1, 1],
                  }
                : {
                    delay: shouldReduceMotion
                      ? 0.15
                      : WORDMARK_REVEAL_DELAY_S,
                    duration: shouldReduceMotion
                      ? 0.25
                      : WORDMARK_REVEAL_DURATION_S,
                    ease: [0.22, 1, 0.36, 1],
                  }
            }
          >
            <motion.img
              src={wordmarkSrc}
              alt="Gllarix"
              className="block h-auto w-full"
              initial={{ x: shouldReduceMotion ? 0 : -72 }}
              animate={{ x: isHandoff ? -72 : 0 }}
              transition={
                isHandoff
                  ? {
                      duration: shouldReduceMotion ? 0.15 : 0.42,
                      ease: [0.4, 0, 1, 1],
                    }
                  : {
                      delay: shouldReduceMotion
                        ? 0.15
                        : WORDMARK_REVEAL_DELAY_S,
                      duration: shouldReduceMotion
                        ? 0.25
                        : WORDMARK_REVEAL_DURATION_S,
                      ease: [0.16, 1, 0.3, 1],
                    }
              }
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
