import { Button } from "@/components/ui/button";
import { Play, CheckCircle, ArrowRight } from "lucide-react";
import heroImage from "@/assets/hero-bg.jpg";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src={heroImage} 
          alt="AI automation technology background" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/70 to-background/90"></div>
      </div>
      
      {/* Floating Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-20 h-20 bg-primary/10 rounded-full blur-xl animate-float"></div>
        <div className="absolute top-40 right-20 w-32 h-32 bg-accent/10 rounded-full blur-2xl animate-float" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-20 left-1/4 w-24 h-24 bg-primary-glow/10 rounded-full blur-xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-6xl mx-auto text-center">
          {/* Main Headline */}
          <div className="mb-8 animate-fade-in-up">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="text-gradient">AI Agents & Automations</span>
              <br />
              <span className="text-foreground">That Run Your Business</span>
              <br />
              <span className="text-gradient-accent">While You Sleep</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground max-w-4xl mx-auto leading-relaxed">
              From calls to reservations to reminders, Gllarix helps you save time, 
              reduce human error, and capture more revenue.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-12 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <Button className="btn-hero text-lg">
              <Play className="mr-2 h-5 w-5" />
              Book a Free Demo
            </Button>
            <Button variant="outline" className="btn-outline-hero text-lg">
              Watch Demo
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          {/* Social Proof */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <div className="flex flex-wrap justify-center items-center gap-8 text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                <span>500+ Businesses Automated</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                <span>24/7 AI Support</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                <span>No Setup Fees</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
            <div className="card-feature text-center">
              <div className="text-4xl font-bold text-gradient mb-2">95%</div>
              <div className="text-muted-foreground">Accuracy Rate</div>
            </div>
            <div className="card-feature text-center">
              <div className="text-4xl font-bold text-gradient mb-2">30hrs</div>
              <div className="text-muted-foreground">Saved Per Week</div>
            </div>
            <div className="card-feature text-center">
              <div className="text-4xl font-bold text-gradient mb-2">24/7</div>
              <div className="text-muted-foreground">Always Available</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;