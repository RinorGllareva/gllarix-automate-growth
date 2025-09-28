import { useEffect, useState } from "react";

interface LoadingScreenProps {
  onComplete: () => void;
}

const LoadingScreen = ({ onComplete }: LoadingScreenProps) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
      setTimeout(onComplete, 1000); // longer exit for smooth fade
    }, 3000); // show loading for 3s
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center 
        bg-black transition-all duration-1000
        ${isLoading ? "opacity-100" : "opacity-0 pointer-events-none"}`}
    >
      {/* Logo Container */}
      <div className="relative z-10 flex flex-col items-center">
        <div
          className={`relative transition-all duration-2000 ease-out ${
            isLoading ? "scale-100 opacity-100" : "scale-125 opacity-0"
          }`}
        >
          {/* Main Logo (Pulsing) */}
          <img
            src="/Gllarix_LogoPNG.png"
            alt="Gllarix"
            className={`h-24 w-auto transition-all duration-2000 ease-out animate-logo-pulse ${
              isLoading ? "scale-100 opacity-100" : "scale-125 opacity-0"
            }`}
          />
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
