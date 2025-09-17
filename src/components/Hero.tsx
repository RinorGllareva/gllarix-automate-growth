import React from 'react';
import ThreeMesh from './ThreeMesh';

const Hero = () => {
  return (
    <section className="relative min-h-screen overflow-hidden bg-black">
      {/* 3D Mesh Background */}
      <ThreeMesh />
      
      {/* Scroll Indicator */}
      <div className="fixed bottom-8 left-8 z-50 flex items-center gap-3 text-primary/60">
        <div className="w-px h-8 bg-primary/30" />
        <span className="text-sm font-light tracking-wider rotate-90 origin-left transform translate-x-8">
          Scroll <em className="text-primary/40 font-normal">to explore</em>
        </span>
      </div>

      {/* Category Badge */}
      <div className="absolute top-40 left-12 z-30">
        <div className="flex items-center gap-2 text-sm font-light tracking-wider text-primary/60 uppercase">
          <span className="text-primary">[ </span>
          AI AUTOMATION
          <span className="text-primary"> ]</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-20 min-h-screen flex items-center">
        <div className="container mx-auto px-12">
          <div className="max-w-4xl">
            {/* Split Typography */}
            <div className="space-y-4">
              <h1 className="text-8xl md:text-9xl lg:text-[12rem] font-bold leading-[0.85] tracking-tight">
                <div className="text-white font-extralight">
                  Defending
                </div>
                <div className="text-white font-extralight -ml-2">
                  the Digital
                </div>
              </h1>
            </div>
            
            {/* Bottom right text */}
            <div className="absolute bottom-32 right-12 max-w-md text-right">
              <div className="space-y-8">
                <h2 className="text-6xl md:text-7xl font-bold leading-[0.9] text-white">
                  <div className="flex items-center justify-end gap-4">
                    <span className="text-primary">on</span>
                  </div>
                  <div className="text-white font-extralight">
                    the Dot
                    <span className="text-primary text-8xl">.</span>
                  </div>
                </h2>
                
                <p className="text-base text-gray-400 font-light leading-relaxed">
                  We assist our clients in integrating AI automation by design in their digital transformation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;