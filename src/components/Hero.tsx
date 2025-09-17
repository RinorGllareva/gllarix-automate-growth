import React from 'react';
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Clock, Users, Zap, Bot, Sparkles } from "lucide-react";
import ThreeScene from './ThreeScene';

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* 3D Animated Background */}
      <ThreeScene />
      
      {/* Dark gradient overlay */}
      <div 
        className="absolute inset-0 z-10"
        style={{
          background: `
            radial-gradient(circle at 20% 80%, hsl(260, 85%, 65%, 0.1) 0%, transparent 60%),
            radial-gradient(circle at 80% 20%, hsl(280, 80%, 70%, 0.08) 0%, transparent 60%),
            radial-gradient(circle at 40% 40%, hsl(240, 70%, 55%, 0.05) 0%, transparent 60%),
            linear-gradient(135deg, hsl(0, 0%, 2%) 0%, hsl(240, 15%, 8%) 100%)
          `
        }}
      />
      
      {/* Animated particles overlay */}
      <div className="absolute inset-0 z-10 opacity-30">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            radial-gradient(circle at 25% 25%, hsl(260, 85%, 65%, 0.4) 1px, transparent 1px),
            radial-gradient(circle at 75% 75%, hsl(280, 80%, 70%, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '100px 100px',
          animation: 'float 12s ease-in-out infinite'
        }} />
      </div>

      {/* Floating tech elements */}
      <div className="absolute inset-0 z-10 overflow-hidden">
        <div className="absolute top-20 left-20 w-3 h-3 bg-primary/60 rounded-full animate-pulse">
          <div className="absolute inset-0 bg-primary/30 rounded-full animate-ping" />
        </div>
        <div className="absolute top-40 right-32 w-2 h-2 bg-accent/80 rounded-full animate-bounce" />
        <div className="absolute bottom-32 left-40 w-4 h-4 bg-secondary/50 rounded-full animate-pulse" style={{ animationDelay: '2s' }}>
          <div className="absolute inset-0 bg-secondary/20 rounded-full animate-ping" style={{ animationDelay: '2s' }} />
        </div>
        <div className="absolute bottom-20 right-20 w-3 h-3 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: '1s' }} />
      </div>

      {/* Main Content */}
      <div className="relative z-20 text-center px-6 max-w-6xl mx-auto">
        <div className="space-y-12">
          {/* Badge */}
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 backdrop-blur-md">
            <Bot className="w-5 h-5 text-primary animate-pulse" />
            <span className="text-sm font-medium text-primary tracking-wide">NEXT-GENERATION AI AUTOMATION</span>
            <Sparkles className="w-4 h-4 text-accent" />
          </div>

          {/* Main Headline */}
          <div className="space-y-8">
            <h1 className="text-6xl md:text-8xl font-bold leading-[0.9] tracking-tight">
              <div className="mb-4">
                <span className="bg-gradient-to-r from-white via-gray-100 to-white bg-clip-text text-transparent">
                  Defending
                </span>
              </div>
              <div className="mb-4">
                <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
                  the Digital
                </span>
              </div>
              <div className="flex items-center justify-center gap-6">
                <span className="bg-gradient-to-r from-white via-gray-100 to-white bg-clip-text text-transparent">
                  Future
                </span>
                <div className="w-4 h-4 bg-primary rounded-full animate-pulse" />
              </div>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground max-w-4xl mx-auto leading-relaxed font-light">
              We assist our clients in integrating <span className="text-primary font-medium">AI automation by design</span> in their digital transformation. 
              From voice agents to workflow automation, experience the future of business operations.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-primary via-accent to-secondary hover:from-primary/80 hover:via-accent/80 hover:to-secondary/80 text-white px-10 py-5 text-lg font-medium rounded-full shadow-2xl hover:shadow-primary/25 transform hover:scale-105 transition-all duration-500 backdrop-blur-sm border border-primary/20"
            >
              <Zap className="mr-3 w-5 h-5 animate-pulse" />
              Schedule Demo
              <ArrowRight className="ml-3 w-5 h-5" />
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="px-10 py-5 text-lg font-medium border-2 border-primary/40 hover:border-primary/60 bg-primary/5 hover:bg-primary/15 text-white rounded-full backdrop-blur-md transition-all duration-500 hover:shadow-lg hover:shadow-primary/20"
            >
              <Bot className="mr-3 w-5 h-5" />
              Explore AI Solutions
            </Button>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-20">
          <div className="group flex items-center justify-center gap-4 p-6 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/5 backdrop-blur-xl border border-primary/20 hover:border-primary/40 hover:bg-primary/15 transition-all duration-500 hover:scale-105">
            <div className="p-2 rounded-lg bg-primary/20 group-hover:bg-primary/30 transition-colors duration-300">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <span className="font-medium text-foreground">Enterprise Security</span>
          </div>
          <div className="group flex items-center justify-center gap-4 p-6 rounded-2xl bg-gradient-to-br from-accent/10 to-primary/5 backdrop-blur-xl border border-accent/20 hover:border-accent/40 hover:bg-accent/15 transition-all duration-500 hover:scale-105">
            <div className="p-2 rounded-lg bg-accent/20 group-hover:bg-accent/30 transition-colors duration-300">
              <Clock className="w-6 h-6 text-accent" />
            </div>
            <span className="font-medium text-foreground">24/7 Availability</span>
          </div>
          <div className="group flex items-center justify-center gap-4 p-6 rounded-2xl bg-gradient-to-br from-secondary/10 to-accent/5 backdrop-blur-xl border border-secondary/20 hover:border-secondary/40 hover:bg-secondary/15 transition-all duration-500 hover:scale-105">
            <div className="p-2 rounded-lg bg-secondary/20 group-hover:bg-secondary/30 transition-colors duration-300">
              <Users className="w-6 h-6 text-secondary" />
            </div>
            <span className="font-medium text-foreground">500+ Companies</span>
          </div>
        </div>

        {/* Performance Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
          <div className="group text-center p-8 rounded-2xl bg-gradient-to-b from-primary/10 to-primary/5 border border-primary/30 hover:border-primary/50 hover:bg-primary/15 transition-all duration-500 backdrop-blur-sm">
            <div className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-3 group-hover:scale-110 transition-transform duration-300">99.9%</div>
            <div className="text-muted-foreground font-medium">AI Uptime</div>
          </div>
          <div className="group text-center p-8 rounded-2xl bg-gradient-to-b from-secondary/10 to-secondary/5 border border-secondary/30 hover:border-secondary/50 hover:bg-secondary/15 transition-all duration-500 backdrop-blur-sm">
            <div className="text-4xl font-bold bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent mb-3 group-hover:scale-110 transition-transform duration-300">50+hrs</div>
            <div className="text-muted-foreground font-medium">Saved Weekly</div>
          </div>
          <div className="group text-center p-8 rounded-2xl bg-gradient-to-b from-accent/10 to-accent/5 border border-accent/30 hover:border-accent/50 hover:bg-accent/15 transition-all duration-500 backdrop-blur-sm">
            <div className="text-4xl font-bold bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent mb-3 group-hover:scale-110 transition-transform duration-300">SOC2</div>
            <div className="text-muted-foreground font-medium">Certified</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;