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
    <main className="min-h-screen">
      <Navigation />
      
      <Hero />
      
      <section id="solutions">
        <PainSolution />
      </section>
      
      <section id="how-it-works">
        <HowItWorks />
      </section>
      
      <section id="industries">
        <Industries />
      </section>
      
      <section id="pricing">
        <Pricing />
      </section>
      
      <Testimonials />
      
      <FinalCTA />
      
      <Footer />
    </main>
  );
};

export default Index;
