import { useEffect, useState } from "react";

interface LoadingScreenProps {
  onComplete: () => void;
}

const LoadingScreen = ({ onComplete }: LoadingScreenProps) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
      setTimeout(onComplete, 600); // Wait for exit animation
    }, 2500); // Show loading for 2.5 seconds

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10 transition-all duration-600 ${
        isLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-10 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-l from-accent/20 to-primary/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>
      </div>

      {/* Logo Container */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo Animation */}
        <div 
          className={`relative transition-all duration-1000 ease-out ${
            isLoading 
              ? 'scale-100 opacity-100' 
              : 'scale-150 opacity-0'
          }`}
        >
          {/* Main Logo */}
          <div className="relative">
            <img 
              src="/Gllarix_LogoPNG.png" 
              alt="Gllarix" 
              className={`h-24 w-auto transition-all duration-1000 ease-out ${
                isLoading ? 'animate-pulse' : ''
              }`}
            />
            
            {/* Glowing Ring Effect */}
            <div 
              className={`absolute inset-0 -m-4 rounded-full bg-gradient-to-r from-primary/30 to-accent/30 blur-lg transition-all duration-1000 ${
                isLoading ? 'animate-pulse scale-100' : 'scale-150 opacity-0'
              }`}
            ></div>
          </div>
        </div>

        {/* Loading Text */}
        <div 
          className={`mt-8 text-center transition-all duration-1000 ${
            isLoading ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <h2 className="text-2xl font-bold text-foreground mb-2 animate-pulse">
            Loading Gllarix
          </h2>
          <div className="flex items-center gap-1 justify-center">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;