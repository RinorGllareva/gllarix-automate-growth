import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import img from "../../public/Gllarix_Icon PNG.png";

const Navigation = () => {
  return (
    <>
      {/* Top Header */}
      <nav className="fixed top-2 sm:top-5 left-2 sm:left-4 right-2 sm:right-4 z-50 bg-transparent">
        <div className="container mx-auto px-3 sm:px-6 py-2 sm:py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="text-xl font-light text-white tracking-wider">
                <img src={img} alt="Gllarix AI Voice Agents and Business Automation Platform" className="h-10 sm:h-12 md:h-[60px] w-auto" loading="eager" fetchPriority="high" />
              </div>
            </div>

            {/* Book Meeting Button */}
            <Link
              to="/book-meeting"
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-full border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary transition-all duration-300 backdrop-blur-sm"
            >
              <span className="text-xs sm:text-sm font-medium">Book a Meeting</span>
              <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-transparent">
        <div className="container mx-auto px-4 sm:px-8 md:px-12 py-4 sm:py-6 md:py-8">
          <div className="flex items-center justify-center md:justify-between">
            {/* Navigation Links */}
            <div className="flex items-center gap-4 sm:gap-6 md:gap-8 overflow-x-auto">
              <div className="flex items-center gap-1 shrink-0">
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                <Link
                  to="/"
                  className="text-white hover:text-primary transition-colors text-xs sm:text-sm font-light"
                >
                  Home
                </Link>
              </div>
              <Link
                to="/#industries"
                className="text-gray-400 hover:text-primary transition-colors text-xs sm:text-sm font-light shrink-0"
              >
                Services
              </Link>
              <Link
                to="/about"
                className="text-gray-400 hover:text-primary transition-colors text-xs sm:text-sm font-light shrink-0"
              >
                About us
              </Link>
              <Link
                to="/demo"
                className="text-gray-400 hover:text-primary transition-colors text-xs sm:text-sm font-light shrink-0"
              >
                Demo
              </Link>
              <Link
                to="/contact"
                className="text-gray-400 hover:text-primary transition-colors text-xs sm:text-sm font-light shrink-0"
              >
                Contact us
              </Link>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navigation;
