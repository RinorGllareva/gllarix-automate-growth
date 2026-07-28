import type { ReactNode } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import FluidGlassBackground from "@/components/FluidGlassBackground";

interface SecondaryPageShellProps {
  children: ReactNode;
  accent?: "cyan" | "amber" | "cobalt" | "violet" | "pearl";
}

const SecondaryPageShell = ({
  children,
  accent = "violet",
}: SecondaryPageShellProps) => {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="pointer-events-none fixed inset-0 z-0">
        <FluidGlassBackground variant="secondary" palette={accent} />
      </div>

      <Navigation />
      <div className="relative z-10">{children}</div>
      <Footer transparent />
    </main>
  );
};

export default SecondaryPageShell;
