import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { IntroProvider, type IntroPhase } from "@/contexts/IntroContext";

const queryClient = new QueryClient();
const INTRO_SESSION_KEY = "gllarix-intro-complete";

const GlassIntro = lazy(() => import("@/components/intro/GlassIntro"));
const Index = lazy(() => import("./pages/Index"));
const Contact = lazy(() => import("./pages/Contact"));
const About = lazy(() => import("./pages/About"));
const Demo = lazy(() => import("./pages/Demo"));
const BookMeeting = lazy(() => import("./pages/BookMeeting"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const NotFound = lazy(() => import("./pages/NotFound"));

const RouteFallback = () => (
  <div className="min-h-screen bg-black flex items-center justify-center">
    <img
      src="/Gllarix_LogoPNG.png"
      alt="Gllarix"
      className="h-20 w-auto animate-pulse"
    />
  </div>
);

// Scroll to top component
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }

    const scrollToHash = () => {
      const target = document.getElementById(hash.slice(1));

      if (!target) {
        return false;
      }

      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    };

    if (scrollToHash()) {
      return;
    }

    const observer = new MutationObserver(() => {
      if (scrollToHash()) {
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const timeout = window.setTimeout(() => observer.disconnect(), 8000);

    return () => {
      observer.disconnect();
      window.clearTimeout(timeout);
    };
  }, [pathname, hash]);

  return null;
};

const CanonicalizeUrl = () => {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!search) {
      return;
    }

    navigate({ pathname, hash }, { replace: true });
  }, [hash, navigate, pathname, search]);

  return null;
};

const RoutedExperience = () => {
  const { pathname } = useLocation();
  const [introPhase, setIntroPhase] = useState<IntroPhase>(() => {
    if (typeof window === "undefined") {
      return "done";
    }

    return sessionStorage.getItem(INTRO_SESSION_KEY) === "true"
      ? "done"
      : "playing";
  });
  const isIntroActive = pathname === "/" && introPhase !== "done";

  const handleIntroComplete = useCallback(() => {
    sessionStorage.setItem(INTRO_SESSION_KEY, "true");
    setIntroPhase("done");
  }, []);

  return (
    <IntroProvider value={isIntroActive ? introPhase : "done"}>
      <CanonicalizeUrl />
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/about" element={<About />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/book-meeting" element={<BookMeeting />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>

      {isIntroActive ? (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[100] bg-[#030208]" aria-hidden="true" />
          }
        >
          <GlassIntro
            onPhase={setIntroPhase}
            onComplete={handleIntroComplete}
          />
        </Suspense>
      ) : null}
    </IntroProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />

      <BrowserRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <RoutedExperience />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
