import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import PainSolution from "@/components/PainSolution";
import HowItWorks from "@/components/HowItWorks";
import Industries from "@/components/Industries";
import Pricing from "@/components/Pricing";
import Testimonials from "@/components/Testimonials";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <main className="min-h-screen bg-black">
      <Navigation />

      <Hero />

      <section id="services" className="min-h-screen bg-gray-900">
        <PainSolution />
      </section>

      <section id="how-it-works" className="min-h-screen bg-black">
        <HowItWorks />
      </section>

      <section id="industries" className="min-h-screen bg-gray-900">
        <Industries />
      </section>

      <section id="pricing" className="bg-black">
        <Pricing />
      </section>

      {/* <Testimonials /> */}

      {/* <FinalCTA /> */}

      <Footer />
    </main>
  );
};

export default Index;
