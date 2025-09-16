import { Button } from "@/components/ui/button";
import { Play, CheckCircle, ArrowRight, Shield, Zap, Brain } from "lucide-react";
import heroImage from "@/assets/hero-bg-professional.jpg";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Professional Background with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src={heroImage} 
          alt="Professional AI enterprise technology background" 
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-hero"></div>
      </div>
      
      {/* Subtle Professional Elements */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div className="absolute top-20 left-10 w-16 h-16 bg-primary/10 rounded-full blur-xl animate-float"></div>
        <div className="absolute top-40 right-20 w-24 h-24 bg-accent/10 rounded-full blur-2xl animate-float" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-20 left-1/4 w-20 h-20 bg-primary-glow/10 rounded-full blur-xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          {/* Main Headline */}
          <div className="mb-12 animate-fade-in-up">
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center gap-2 bg-card/50 border border-border/50 rounded-full px-4 py-2 backdrop-blur-sm">
                <Brain className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Enterprise AI Solutions</span>
              </div>
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-8 leading-tight">
              <span className="text-gradient">Secure AI Agents</span>
              <br />
              <span className="text-foreground">That Drive Business</span>
              <br />
              <span className="text-gradient-accent">Growth & Efficiency</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed font-medium">
              Enterprise-grade AI automation platform delivering reliable voice agents, 
              secure business workflows, and intelligent automations for forward-thinking companies.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <Button className="btn-hero text-lg px-8 py-6">
              <Play className="mr-2 h-5 w-5" />
              Schedule Demo
            </Button>
            <Button variant="outline" className="btn-outline-hero text-lg px-8 py-6">
              View Solutions
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="animate-fade-in-up mb-16" style={{ animationDelay: '0.4s' }}>
            <div className="flex flex-wrap justify-center items-center gap-8 text-muted-foreground">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-accent" />
                <span className="font-medium">Enterprise Security</span>
              </div>
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-accent" />
                <span className="font-medium">24/7 Reliability</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-accent" />
                <span className="font-medium">500+ Companies Trust Us</span>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
            <div className="card-feature text-center hover-lift">
              <div className="text-3xl font-bold text-gradient mb-2">99.7%</div>
              <div className="text-muted-foreground font-medium">Uptime Guarantee</div>
            </div>
            <div className="card-feature text-center hover-lift">
              <div className="text-3xl font-bold text-gradient mb-2">40+hrs</div>
              <div className="text-muted-foreground font-medium">Saved Weekly</div>
            </div>
            <div className="card-feature text-center hover-lift">
              <div className="text-3xl font-bold text-gradient mb-2">SOC2</div>
              <div className="text-muted-foreground font-medium">Compliant</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;