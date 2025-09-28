import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import img from "../../public/Gllarix_Icon PNG.png";

const Navigation = () => {
  return (
    <>
      {/* Top Header */}
      <nav className="fixed top-5 left-4 right-4 z-50 bg-transparent">
        {/*bg-white/5 backdrop-blur-md rounded-full shadow-lg border
        border-white/5*/}
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="text-xl font-light text-white tracking-wider">
                <img src={img} alt="Gllarix Logo" className="h-[60px] w-auto" />
              </div>
            </div>

            {/* Contact Button */}
            <Link
              to="/contact"
              className="flex items-center gap-2 px-6 py-3 rounded-full border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary transition-all duration-300 backdrop-blur-sm"
            >
              <span className="text-sm font-medium">Contact us</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-transparent">
        <div className="container mx-auto px-12 py-8">
          <div className="flex items-center justify-between">
            {/* Navigation Links */}
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                <Link
                  to="/"
                  className="text-white hover:text-primary transition-colors text-sm font-light"
                >
                  Home
                </Link>
              </div>
              <Link
                to="/#services"
                className="text-gray-400 hover:text-primary transition-colors text-sm font-light"
              >
                Services
              </Link>

              <Link
                to="/about"
                className="text-gray-400 hover:text-primary transition-colors text-sm font-light"
              >
                About us
              </Link>
              <Link
                to="/demo"
                className="text-gray-400 hover:text-primary transition-colors text-sm font-light"
              >
                Demo
              </Link>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navigation;
