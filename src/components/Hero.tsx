import React, { Suspense } from 'react';
import ThreeMesh from './ThreeMesh';
const CrystalGlyph = React.lazy(() => import('./CrystalGlyph'));

const Hero = () => {
  return (
    <section className="relative min-h-screen overflow-hidden bg-black">
      {/* 3D Mesh Background */}
      <ThreeMesh />
      
      {/* Crystal G Glyph - positioned on the right */}
      <Suspense fallback={null}>
        <CrystalGlyph />
      </Suspense>
      
      {/* Scroll Indicator */}
      <div className="hidden lg:flex fixed bottom-8 left-4 lg:left-8 z-50 items-center gap-3 text-primary/60">
        <div className="w-px h-8 bg-primary/30" />
        <span className="text-sm font-light tracking-wider rotate-90 origin-left transform translate-x-8">
          Scroll <em className="text-primary/40 font-normal">to explore</em>
        </span>
      </div>

      {/* Category Badge */}
      <div className="absolute top-32 sm:top-40 left-4 sm:left-8 lg:left-12 z-30">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-light tracking-wider text-primary/60 uppercase">
          <span className="text-primary">[ </span>
          AI AUTOMATION
          <span className="text-primary"> ]</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-20 min-h-screen flex items-center">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-4xl">
            {/* Split Typography */}
            <div className="space-y-2 sm:space-y-4">
              <h1 className="text-4xl sm:text-6xl md:text-8xl lg:text-9xl xl:text-[11rem] font-bold leading-[0.85] tracking-tight">
                <div className="text-white font-extralight">
                  The FUTURE
                </div>
                <div className="text-white font-extralight -ml-1 sm:-ml-2">
                  runs ITSELF
                </div>
              </h1>
            </div>
          </div>
        </div>
        
        {/* Bottom right text - responsive positioning */}
        <div className="absolute bottom-20 sm:bottom-24 lg:bottom-32 right-4 sm:right-8 lg:right-12 max-w-xs sm:max-w-sm lg:max-w-md text-right">
          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[0.9] text-white">
              <div className="flex items-center justify-end gap-2 sm:gap-4">
                <span className="text-primary">on</span>
              </div>
              <div className="text-white font-extralight">
                the Dot
                <span className="text-primary text-4xl sm:text-5xl md:text-6xl lg:text-8xl">.</span>
              </div>
            </h2>
            
            <p className="text-sm sm:text-base text-gray-400 font-light leading-relaxed">
              We assist our clients in integrating AI automation by design in their digital transformation.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;