import PainSolution from "@/components/PainSolution";
import HowItWorks from "@/components/HowItWorks";
import Industries from "@/components/Industries";
import Pricing from "@/components/Pricing";
import Footer from "@/components/Footer";
import FluidGlassBackground from "@/components/FluidGlassBackground";

const HomepageSections = () => {
  return (
    <>
      <div className="connected-homepage-sections relative overflow-clip bg-black">
        <div className="pointer-events-none absolute inset-0">
          <div className="sticky top-0 h-screen overflow-hidden">
            <FluidGlassBackground variant="sections" />
          </div>
        </div>

        <div className="relative z-10">
          <PainSolution />
          <HowItWorks />
          <Industries />
          <Pricing />
        </div>
      </div>

      <Footer />
    </>
  );
};

export default HomepageSections;
