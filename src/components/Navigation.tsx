import { ArrowRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import GllarixIcon from "@/components/intro/GllarixIcon";
import {
  useHeroRevealed,
  useIntroActive,
  useLogoDocked,
} from "@/contexts/IntroContext";

const Navigation = () => {
  const isIntroActive = useIntroActive();
  const isLogoDocked = useLogoDocked();
  const isHeroRevealed = useHeroRevealed();
  // During the intro the flying logo hands over to this one, so it must appear instantly.
  const chromeStyle = isIntroActive
    ? {
        opacity: isHeroRevealed ? 1 : 0,
        transition: "opacity .9s ease .55s",
      }
    : undefined;
  const { pathname, hash } = useLocation();
  const navigationItems = [
    {
      label: "Home",
      to: "/",
      active: pathname === "/" && hash !== "#industries",
    },
    {
      label: "Services",
      to: "/#industries",
      active: pathname === "/" && hash === "#industries",
    },
    { label: "About us", to: "/about", active: pathname === "/about" },
    { label: "Demo", to: "/demo", active: pathname === "/demo" },
    { label: "Contact us", to: "/contact", active: pathname === "/contact" },
  ];

  const handleServicesClick = () => {
    if (pathname !== "/") {
      return;
    }

    window.requestAnimationFrame(() => {
      document
        .getElementById("industries")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <>
      {/* Top Header */}
      <nav className="fixed top-2 sm:top-5 left-2 sm:left-4 right-2 sm:right-4 z-50 bg-transparent">
        <div className="container mx-auto px-3 py-2 sm:px-6 sm:py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link
              to="/"
              data-gllarix-nav-logo
              aria-label="Gllarix home"
              className={`flex items-center ${
                isLogoDocked ? "opacity-100" : "opacity-0"
              }`}
            >
              <span
                data-gllarix-nav-icon
                className="block h-9 shrink-0 sm:h-10 md:h-12"
              >
                <GllarixIcon className="block h-full w-auto" />
              </span>
            </Link>

            {/* Book Meeting Button */}
            <Link
              to="/book-meeting"
              style={chromeStyle}
              className="group flex h-10 items-center gap-2 rounded-md border border-violet-200/25 bg-black/25 px-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl transition-colors duration-300 hover:border-cyan-100/45 hover:bg-white/10 sm:h-12 sm:px-5"
            >
              <span className="text-[10px] font-light uppercase tracking-[0.16em] sm:text-xs">
                Book a meeting
              </span>
              <ArrowRight className="h-3 w-3 text-violet-200 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-cyan-100 sm:h-4 sm:w-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Bottom Navigation */}
      <nav
        style={chromeStyle}
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.08] bg-black/55 backdrop-blur-xl"
      >
        <div className="container mx-auto px-4 py-3 sm:px-8 md:px-12">
          <div className="flex items-center justify-center md:justify-between">
            {/* Navigation Links */}
            <div className="bottom-nav-scroll flex items-center gap-4 overflow-x-auto sm:gap-6 md:gap-8">
              {navigationItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={
                    item.label === "Services"
                      ? handleServicesClick
                      : undefined
                  }
                  className={`flex shrink-0 items-center gap-1.5 text-[10px] font-light uppercase tracking-[0.12em] transition-colors hover:text-white sm:text-xs ${
                    item.active ? "text-white" : "text-white/45"
                  }`}
                >
                  {item.active ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  ) : null}
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navigation;
