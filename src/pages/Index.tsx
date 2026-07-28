import { lazy, Suspense, useEffect, useState } from "react";
import Navigation from "@/components/Navigation";
import { useIntroActive } from "@/contexts/IntroContext";

const Hero = lazy(() => import("@/components/Hero"));
const HomepageSections = lazy(() => import("@/components/HomepageSections"));

const Index = () => {
  const isIntroActive = useIntroActive();
  const [showHomepageSections, setShowHomepageSections] = useState(false);

  useEffect(() => {
    if (isIntroActive) {
      return;
    }

    const timer = window.setTimeout(() => {
      setShowHomepageSections(true);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [isIntroActive]);

  return (
    <main className="min-h-screen bg-black">
      <Navigation />

      {isIntroActive ? (
        <div className="min-h-screen bg-black" aria-hidden="true" />
      ) : (
        <>
          <Suspense fallback={<div className="min-h-screen bg-black" aria-hidden="true" />}>
            <Hero />
          </Suspense>

          {showHomepageSections ? (
            <Suspense fallback={null}>
              <HomepageSections />
            </Suspense>
          ) : null}
        </>
      )}
    </main>
  );
};

export default Index;
